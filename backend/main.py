from fastapi import FastAPI, Depends, File, UploadFile, Form, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from models import Article, Order, OrderItem, OrderItemSale, User
from auth import get_password_hash, verify_password, create_access_token, get_current_user
from typing import Optional, List
import os
import io
import uuid
import requests
from datetime import datetime, timedelta
import csv
import json
from dotenv import load_dotenv
from sqlalchemy import text, func
from pydantic import BaseModel, EmailStr
from PIL import Image
from pillow_heif import register_heif_opener

register_heif_opener()
load_dotenv()

# Versión de la App
APP_VERSION = "1.0.0"

# Crear tablas
Base.metadata.create_all(bind=engine)

# Migraciones y semilla de datos
def run_migrations():
    columns = [
        ("articles", "purchase_price", "FLOAT"),
        ("articles", "recommended_price", "FLOAT"),
        ("articles", "user_id", "INTEGER REFERENCES users(id)"),
        ("orders", "updated_at", "DATETIME"),
        ("orders", "user_id", "INTEGER REFERENCES users(id)"),
        ("order_items", "quantity", "INTEGER DEFAULT 1"),
        ("order_items", "article_id", "INTEGER REFERENCES articles(id)"),
        ("orders", "platform", "STRING"),
        ("articles", "category", "STRING"),
        # User Menu V1 Columns
        ("users", "profile_photo", "STRING"),
        ("users", "currency", "STRING DEFAULT 'EUR'"),
        ("users", "language", "STRING DEFAULT 'ES'"),
        ("users", "theme", "STRING DEFAULT 'AMOLED'"),
        ("users", "animation_level", "STRING DEFAULT 'full'"),
        ("users", "neon_glow", "BOOLEAN DEFAULT 1"),
        ("users", "compact_mode", "BOOLEAN DEFAULT 0"),
        ("users", "haptics", "BOOLEAN DEFAULT 1"),
        ("users", "accent_color", "STRING DEFAULT '#7B2CBF'"),
        ("users", "business_name", "STRING"),
        ("users", "platform", "STRING"),
        ("users", "product_type", "STRING")
    ]
    
    with engine.connect() as conn:
        for table, col, col_type in columns:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
                print(f"Added column {col} to {table}")
            except Exception:
                pass 

run_migrations()

def seed_admin_and_assign_data():
    db = SessionLocal()
    try:
        admin_pass = os.getenv("APP_PASSWORD", "245242")
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                hashed_password=get_password_hash(admin_pass)
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print("Admin user created.")

        db.query(Article).filter(Article.user_id == None).update({Article.user_id: admin.id})
        db.query(Order).filter(Order.user_id == None).update({Order.user_id: admin.id})
        
        # SYNC: Ensure OrderItemSales match Quantity exactly
        items = db.query(OrderItem).all()
        for item in items:
            sales = db.query(OrderItemSale).filter(OrderItemSale.order_item_id == item.id).order_by(OrderItemSale.id).all()
            needed = (item.quantity or 1)
            
            # If we have too many, delete the extras (prefer deleting unsold ones)
            if len(sales) > needed:
                to_delete = len(sales) - needed
                deleted_count = 0
                # First try to delete unsold ones
                for s in sales:
                    if s.sell_price is None and deleted_count < to_delete:
                        db.delete(s)
                        deleted_count += 1
                # If still need to delete, delete any
                if deleted_count < to_delete:
                    for s in sales:
                        if deleted_count < to_delete:
                            # Re-fetch because some might be deleted
                            db.delete(s)
                            deleted_count += 1
            
            # If we have too few, add them
            elif len(sales) < needed:
                for _ in range(needed - len(sales)):
                    db.add(OrderItemSale(order_item_id=item.id))
        
        db.commit()
    except Exception as e:
        print(f"Migration error: {e}")
        db.rollback()
    finally:
        db.close()

seed_admin_and_assign_data()

UPLOAD_DIR = "uploads"
PROFILES_DIR = os.path.join(UPLOAD_DIR, "profiles")
for d in [UPLOAD_DIR, PROFILES_DIR]:
    if not os.path.exists(d):
        os.makedirs(d)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir uploads locales por compatibilidad, aunque ahora usaremos Supabase
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

def upload_to_supabase(file_bytes: bytes, bucket: str, file_path: str, content_type: str = "image/jpeg"):
    """Sube un archivo a Supabase Storage mediante su REST API."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    if not supabase_url or not supabase_key:
        print("ERROR: Credenciales de Supabase no configuradas en .env")
        return None
        
    url = f"{supabase_url}/storage/v1/object/{bucket}/{file_path}"
    headers = {
        "Authorization": f"Bearer {supabase_key}",
        "apikey": supabase_key,
        "Content-Type": content_type
    }
    
    response = requests.post(url, headers=headers, data=file_bytes)
    if response.status_code == 200:
        return f"{supabase_url}/storage/v1/object/public/{bucket}/{file_path}"
    else:
        print(f"Supabase upload error: {response.text}")
        return None

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# SCHEMAS
class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    username: str
    password: str

class UserProfileUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    currency: Optional[str] = None
    language: Optional[str] = None
    theme: Optional[str] = None
    animation_level: Optional[str] = None
    neon_glow: Optional[bool] = None
    compact_mode: Optional[bool] = None
    haptics: Optional[bool] = None
    accent_color: Optional[str] = None
    business_name: Optional[str] = None
    platform: Optional[str] = None
    product_type: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class StatsResponse(BaseModel):
    total_profit: float
    month_profit: float
    sold_products_count: int
    active_products_count: int
    average_roi: float

# AUTH ENDPOINTS
@app.post("/api/auth/register", response_model=Token)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user_data.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
    
    new_user = User(
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(data={"sub": new_user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "profile_photo": current_user.profile_photo,
        "currency": current_user.currency,
        "language": current_user.language,
        "theme": current_user.theme,
        "animation_level": current_user.animation_level,
        "neon_glow": current_user.neon_glow,
        "compact_mode": current_user.compact_mode,
        "haptics": current_user.haptics,
        "accent_color": current_user.accent_color,
        "business_name": current_user.business_name,
        "platform": current_user.platform,
        "product_type": current_user.product_type
    }

@app.get("/api/users/check-username")
def check_username(username: str, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == username).first()
    return {"available": existing is None}

# USER MANAGEMENT
@app.put("/api/users/me")
def update_user_profile(payload: UserProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Re-obtener el usuario en la sesión actual para evitar errores de persistencia
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if payload.username:
        existing = db.query(User).filter(User.username == payload.username, User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="El nombre de usuario ya está en uso")
        user.username = payload.username
    
    if payload.email is not None: user.email = payload.email
    if payload.currency is not None: user.currency = payload.currency
    if payload.language is not None: user.language = payload.language
    if payload.animation_level is not None: user.animation_level = payload.animation_level
    if payload.neon_glow is not None: user.neon_glow = payload.neon_glow
    if payload.compact_mode is not None: user.compact_mode = payload.compact_mode
    if payload.haptics is not None: user.haptics = payload.haptics
    if payload.accent_color is not None: user.accent_color = payload.accent_color
    if payload.theme is not None: user.theme = payload.theme
    if payload.business_name is not None: user.business_name = payload.business_name
    if payload.platform is not None: user.platform = payload.platform
    if payload.product_type is not None: user.product_type = payload.product_type
    
    db.commit()
    db.refresh(user)
    return user

@app.put("/api/users/me/password")
def change_password(payload: PasswordChange, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")
    
    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"ok": True}

@app.post("/api/users/me/photo")
async def upload_profile_photo(image: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        user = db.query(User).filter(User.id == current_user.id).first()
        user_profile_dir = os.path.join(PROFILES_DIR, str(user.id))
        if not os.path.exists(user_profile_dir):
            os.makedirs(user_profile_dir)
            
        filename = f"avatar_{uuid.uuid4().hex[:8]}.jpg"
        file_path = os.path.join(user_profile_dir, filename)
        
        contents = await image.read()
        img = Image.open(io.BytesIO(contents))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        # Redimensionar a 400x400 para ahorrar espacio
        img.thumbnail((400, 400))
        
        # Guardar en memoria
        output = io.BytesIO()
        img.save(output, format="JPEG", quality=85)
        file_bytes = output.getvalue()
        
        filename = f"profiles/{user.id}/avatar_{uuid.uuid4().hex[:8]}.jpg"
        
        image_url = upload_to_supabase(file_bytes, "hustle-uploads", filename)
        if not image_url:
            raise Exception("No se pudo subir la imagen a la nube")
            
        user.profile_photo = image_url
        db.commit()
        return {"profile_photo": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users/me/stats", response_model=StatsResponse)
def get_user_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 1. Total Profit
    # Profit = SUM(sell_price) - SUM(buy_price * quantity) de los items vendidos
    # Pero cada item tiene múltiples ventas. 
    # Profit = SUM(sales.sell_price) - (item.buy_price * item.quantity)
    
    orders = db.query(Order).filter(Order.user_id == current_user.id).all()
    total_profit = 0
    month_profit = 0
    sold_count = 0
    active_count = 0
    total_investment_sold = 0
    
    now = datetime.utcnow()
    this_month_start = datetime(now.year, now.month, 1)

    for order in orders:
        for item in order.items:
            item_cost = item.buy_price * item.quantity
            item_revenue = 0
            item_sold_in_order = 0
            
            for sale in item.sales:
                if sale.sell_price is not None:
                    item_revenue += sale.sell_price
                    item_sold_in_order += 1
                    sold_count += 1
                    # ROI calculation helper
                    total_investment_sold += item.buy_price
                    
                    if sale.sold_at and sale.sold_at >= this_month_start:
                        month_profit += (sale.sell_price - item.buy_price)
                else:
                    active_count += 1
            
            # El beneficio total es la suma de los beneficios de cada unidad vendida
            # Beneficio de una unidad = sell_price - buy_price
            for sale in item.sales:
                if sale.sell_price is not None:
                    total_profit += (sale.sell_price - item.buy_price)

    avg_roi = (total_profit / total_investment_sold * 100) if total_investment_sold > 0 else 0
    
    return {
        "total_profit": total_profit,
        "month_profit": month_profit,
        "sold_products_count": sold_count,
        "active_products_count": active_count,
        "average_roi": avg_roi
    }

# EXPORT / IMPORT
@app.get("/api/users/me/export/csv")
def export_csv(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Pedido", "Fecha Pedido", "Artículo", "Cantidad", "Costo Unitario", "Precio Venta", "Beneficio Unidad", "Fecha Venta"])
    
    orders = db.query(Order).filter(Order.user_id == current_user.id).all()
    for order in orders:
        for item in order.items:
            for sale in item.sales:
                profit = (sale.sell_price - item.buy_price) if sale.sell_price is not None else 0
                writer.writerow([
                    order.name, 
                    order.date, 
                    item.name, 
                    1, 
                    item.buy_price, 
                    sale.sell_price if sale.sell_price is not None else "",
                    profit if sale.sell_price is not None else "",
                    sale.sold_at.strftime("%Y-%m-%d") if sale.sold_at else ""
                ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=hustle_export_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@app.get("/api/users/me/export/json")
def export_json(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    orders = db.query(Order).filter(Order.user_id == current_user.id).all()
    data = []
    for order in orders:
        order_dict = {
            "name": order.name,
            "date": order.date,
            "items": []
        }
        for item in order.items:
            item_dict = {
                "name": item.name,
                "buy_price": item.buy_price,
                "quantity": item.quantity,
                "sales": [
                    {"sell_price": s.sell_price, "sold_at": s.sold_at.isoformat() if s.sold_at else None} 
                    for s in item.sales
                ]
            }
            order_dict["items"].append(item_dict)
        data.append(order_dict)
    
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": f"attachment; filename=hustle_backup_{datetime.now().strftime('%Y%m%d')}.json"}
    )

@app.post("/api/users/me/import")
async def import_json(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        contents = await file.read()
        data = json.loads(contents)
        
        if not isinstance(data, list):
            raise HTTPException(status_code=400, detail="Formato JSON inválido")
            
        for order_data in data:
            order = Order(
                user_id=current_user.id,
                name=order_data.get("name", "Importado"),
                date=order_data.get("date", datetime.now().strftime("%Y-%m-%d"))
            )
            db.add(order)
            db.flush()
            
            for item_data in order_data.get("items", []):
                # Buscar artículo base por nombre para el usuario
                art_name = item_data.get("name")
                article = db.query(Article).filter(Article.name == art_name, Article.user_id == current_user.id).first()
                article_id = article.id if article else None
                
                item = OrderItem(
                    order_id=order.id,
                    article_id=article_id,
                    name=art_name,
                    buy_price=item_data.get("buy_price", 0),
                    quantity=item_data.get("quantity", 1)
                )
                db.add(item)
                db.flush()
                
                for sale_data in item_data.get("sales", []):
                    sale = OrderItemSale(
                        order_item_id=item.id,
                        sell_price=sale_data.get("sell_price"),
                        sold_at=datetime.fromisoformat(sale_data["sold_at"]) if sale_data.get("sold_at") else None
                    )
                    db.add(sale)
                    
        db.commit()
        return {"ok": True, "message": "Datos importados correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en la importación: {str(e)}")

@app.get("/api/app/version")
def get_version():
    return {"version": APP_VERSION}

# ARTICLES
@app.get("/api/articles")
def get_articles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Article).filter(Article.user_id == current_user.id).all()

@app.post("/api/articles")
async def create_article(
    name: str = Form(...),
    purchase_price: float = Form(...),
    recommended_price: Optional[float] = Form(None),
    category: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    image_url = None
    if image:
        try:
            contents = await image.read()
            img = Image.open(io.BytesIO(contents))
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            output = io.BytesIO()
            img.save(output, format="JPEG", quality=85)
            file_bytes = output.getvalue()
            
            filename = f"articles/{uuid.uuid4().hex}.jpg"
            image_url = upload_to_supabase(file_bytes, "hustle-uploads", filename)
        except Exception as e:
            print(f"Error uploading article image: {e}")

    article = Article(
        user_id=current_user.id,
        name=name,
        purchase_price=purchase_price,
        recommended_price=recommended_price,
        image_url=image_url,
        date=datetime.now().strftime("%Y-%m-%d")
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article

# ORDERS
@app.get("/api/orders")
def get_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Order).filter(Order.user_id == current_user.id).order_by(Order.date.desc(), Order.id.desc()).all()

@app.post("/api/orders")
def create_order(name: str = Form(...), platform: Optional[str] = Form(None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_order = Order(
        name=name,
        platform=platform,
        user_id=current_user.id,
        date=datetime.now().strftime("%Y-%m-%d")
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order

@app.delete("/api/orders/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).first()
    if order:
        db.delete(order)
        db.commit()
    return {"ok": True}

class OrderItemCreate(BaseModel):
    name: str
    buy_price: float
    article_id: Optional[int] = None
    quantity: int = 1

@app.post("/api/orders/{order_id}/items")
def add_order_item(order_id: int, payload: OrderItemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=403, detail="No tienes acceso a este pedido")

    article_id = payload.article_id
    qty_to_add = payload.quantity if payload.quantity > 0 else 1

    if not article_id:
        existing_art = db.query(Article).filter(Article.name == payload.name, Article.user_id == current_user.id).first()
        if existing_art:
            article_id = existing_art.id
            
    existing_item = db.query(OrderItem).filter(
        OrderItem.order_id == order_id,
        OrderItem.name == payload.name,
        OrderItem.buy_price == payload.buy_price,
        OrderItem.article_id == article_id
    ).first()
    
    if existing_item:
        existing_item.quantity += qty_to_add
        for _ in range(qty_to_add):
            db.add(OrderItemSale(order_item_id=existing_item.id))
        item = existing_item
    else:
        item = OrderItem(
            order_id=order_id,
            article_id=article_id,
            name=payload.name,
            buy_price=payload.buy_price,
            quantity=qty_to_add
        )
        db.add(item)
        db.flush()
        for _ in range(qty_to_add):
            db.add(OrderItemSale(order_item_id=item.id))
    
    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item

class OrderItemUpdate(BaseModel):
    buy_price: float

@app.put("/api/orders/items/{item_id}")
def update_order_item(item_id: int, payload: OrderItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(OrderItem).join(Order).filter(OrderItem.id == item_id, Order.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado o sin acceso")
    
    item.buy_price = payload.buy_price
    order = db.query(Order).filter(Order.id == item.order_id).first()
    if order:
        order.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(item)
    return item

class SaleUpdate(BaseModel):
    sell_price: Optional[float] = None

@app.put("/api/orders/items/sales/{sale_id}")
def update_item_sale(sale_id: int, payload: SaleUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sale = db.query(OrderItemSale).join(OrderItem).join(Order).filter(OrderItemSale.id == sale_id, Order.user_id == current_user.id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada o sin acceso")
    
    sale.sell_price = payload.sell_price
    sale.sold_at = datetime.utcnow() if payload.sell_price is not None else None
        
    item = db.query(OrderItem).filter(OrderItem.id == sale.order_item_id).first()
    if item:
        order = db.query(Order).filter(Order.id == item.order_id).first()
        if order:
            order.updated_at = datetime.utcnow()
            
    db.commit()
    db.refresh(sale)
    return sale

@app.delete("/api/orders/items/{item_id}")
def delete_order_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(OrderItem).join(Order).filter(OrderItem.id == item_id, Order.user_id == current_user.id).first()
    if item:
        order = db.query(Order).filter(Order.id == item.order_id).first()
        if order:
            order.updated_at = datetime.utcnow()
        db.delete(item)
        db.commit()
    return {"ok": True}

# --- STATISTICS ENDPOINTS ---

@app.get("/api/stats/overview")
def get_stats_overview(period: str = "30d", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        now = datetime.now()
        if period == "7d": threshold = now - timedelta(days=7)
        elif period == "30d": threshold = now - timedelta(days=30)
        elif period == "3m": threshold = now - timedelta(days=90)
        elif period == "1y": threshold = now - timedelta(days=365)
        else: threshold = datetime(2000, 1, 1)

        # Explicitly join and select needed fields to avoid ambiguity
        query = db.query(OrderItemSale, OrderItem.buy_price).join(OrderItem, OrderItemSale.order_item_id == OrderItem.id).join(Order, OrderItem.order_id == Order.id).filter(
            Order.user_id == current_user.id
        )
        results = query.all()

        total_revenue = 0
        total_cost = 0
        period_revenue = 0
        period_cost = 0

        for sale, buy_price in results:
            bp = buy_price if buy_price is not None else 0
            sp = sale.sell_price if sale.sell_price is not None else 0
            
            if sp > 0:
                item = db.query(OrderItem).filter(OrderItem.id == sale.order_item_id).first()
                print(f"DEBUG SALE: Item={item.name if item else 'Unknown'}, Sell={sp}, Buy={bp}, Profit={sp-bp}")
                total_revenue += sp
                total_cost += bp
                
                if sale.sold_at and sale.sold_at >= threshold:
                    period_revenue += sp
                    period_cost += bp
        
        profit = total_revenue - total_cost
        period_profit = period_revenue - period_cost
        roi = (profit / total_cost * 100) if total_cost > 0 else 0
        
        sold_count = len([s for s, _ in results if s.sell_price and s.sell_price > 0])
        active_items = db.query(OrderItem).join(Order).filter(Order.user_id == current_user.id).count() - sold_count

        return {
            "total_profit": profit,
            "period_profit": period_profit,
            "period_percentage": 18.4, 
            "items_sold": sold_count,
            "active_items": max(0, active_items),
            "average_roi": roi
        }
    except Exception as e:
        print(f"Error in stats overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats/profit-chart")
def get_profit_chart(period: str = "30d", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        days_map = {"7d": 7, "30d": 30, "3m": 90, "1y": 365, "all": 365}
        days = days_map.get(period, 30)
        
        # Si es "all", buscamos la primera venta
        if period == "all":
            first_sale = db.query(OrderItemSale).join(OrderItem).join(Order).filter(Order.user_id == current_user.id).order_by(OrderItemSale.sold_at.asc()).first()
            if first_sale and first_sale.sold_at:
                days = (datetime.now() - first_sale.sold_at).days + 1
            else:
                days = 30

        start_date = (datetime.now() - timedelta(days=days-1)).replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Obtener todas las ventas del periodo
        sales = db.query(OrderItemSale, OrderItem.buy_price)\
            .join(OrderItem).join(Order)\
            .filter(Order.user_id == current_user.id)\
            .filter(OrderItemSale.sold_at >= start_date)\
            .filter(OrderItemSale.sell_price != None)\
            .all()

        # Agrupar por fecha
        daily_data = {}
        for sale, buy_price in sales:
            date_str = sale.sold_at.strftime("%Y-%m-%d")
            profit = sale.sell_price - buy_price
            daily_data[date_str] = daily_data.get(date_str, 0) + profit

        # Construir el array completo incluyendo días sin ventas
        result = []
        cumulative_profit = 0
        for i in range(days):
            d = (start_date + timedelta(days=i))
            d_str = d.strftime("%Y-%m-%d")
            d_label = d.strftime("%d/%m")
            
            day_profit = daily_data.get(d_str, 0)
            cumulative_profit += day_profit
            
            # Para la gráfica de "Crecimiento" enviamos el acumulado
            result.append({
                "date": d_label, 
                "profit": round(cumulative_profit, 2),
                "daily": round(day_profit, 2)
            })

        return result
    except Exception as e:
        print(f"Error in profit chart: {e}")
        return []

@app.get("/api/stats/top-products")
def get_top_products(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    top = []
    articles = db.query(Article).filter(Article.user_id == current_user.id).all()
    for art in articles:
        sales = db.query(OrderItemSale).join(OrderItem).filter(OrderItem.article_id == art.id).all()
        art_revenue = sum(s.sell_price for s in sales if s.sell_price)
        art_cost = sum(db.query(OrderItem).filter(OrderItem.id == s.order_item_id).first().buy_price for s in sales if s.sell_price)
        art_profit = art_revenue - art_cost
        if art_profit > 0:
            top.append({
                "name": art.name,
                "profit": art_profit,
                "image": art.image_url
            })
    return sorted(top, key=lambda x: x["profit"], reverse=True)[:5]

@app.get("/api/stats/recent-activity")
def get_recent_activity(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    activity = []
    sales = db.query(OrderItemSale).join(OrderItem).join(Order).filter(Order.user_id == current_user.id).filter(OrderItemSale.sell_price != None).order_by(OrderItemSale.sold_at.desc()).limit(10).all()
    for s in sales:
        item = db.query(OrderItem).filter(OrderItem.id == s.order_item_id).first()
        activity.append({
            "type": "sale",
            "label": f"{item.name} sold",
            "amount": s.sell_price - item.buy_price,
            "date": s.sold_at.strftime("%H:%M") if s.sold_at else "---"
        })
    return activity
