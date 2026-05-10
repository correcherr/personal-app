from fastapi import FastAPI, Depends, File, UploadFile, Form
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from models import Article, ArticleImage, Order, OrderItem
from typing import Optional
from datetime import datetime
import shutil
import os
from dotenv import load_dotenv

load_dotenv()

# Crear tablas (añade columnas nuevas automáticamente con SQLite)
Base.metadata.create_all(bind=engine)

# Migración suave: añadir columna link si no existe
from sqlalchemy import text
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE articles ADD COLUMN link TEXT"))
        conn.commit()
except Exception:
    pass  # Ya existe

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE articles ADD COLUMN description TEXT"))
        conn.commit()
except Exception:
    pass  # Ya existe

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE orders ADD COLUMN updated_at DATETIME"))
        conn.commit()
except Exception:
    pass  # Ya existe

if not os.path.exists("uploads"):
    os.makedirs("uploads")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "API funcionando"}

@app.get("/api/articles")
def get_articles(db: Session = Depends(get_db)):
    return db.query(Article).all()

@app.post("/api/articles")
def create_article(
    name: str = Form(...),
    price: float = Form(...),
    image: UploadFile = File(...),
    link: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    file_path = f"uploads/{image.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    article = Article(
        name=name,
        price=price,
        date=datetime.now().strftime("%Y-%m-%d"),
        image_url=file_path,
        link=link if link and link.strip() else None
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article

@app.put("/api/articles/{article_id}")
def update_article(
    article_id: int,
    name: str = Form(...),
    price: float = Form(...),
    image: Optional[UploadFile] = File(None),
    link: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Artículo no encontrado")

    article.name = name
    article.price = price
    article.link = link if link and link.strip() else None

    if image and image.filename:
        file_path = f"uploads/{image.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        article.image_url = file_path

    db.commit()
    db.refresh(article)
    return article

@app.delete("/api/articles/{article_id}")
def delete_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Artículo no encontrado")

    if article.image_url and os.path.exists(article.image_url):
        os.remove(article.image_url)

    db.delete(article)
    db.commit()
    return {"message": "Artículo eliminado"}

from pydantic import BaseModel
class DescriptionUpdate(BaseModel):
    description: str

class LoginRequest(BaseModel):
    password: str

@app.post("/api/auth/login")
def login(payload: LoginRequest):
    correct_password = os.environ.get("APP_PASSWORD")
    if not correct_password:
        correct_password = "ADMIN" # Fallback if .env is missing, but NOT the user's password
        
    if payload.password == correct_password:
        return {"token": "ok"}
    from fastapi import HTTPException
    raise HTTPException(status_code=401, detail="Contraseña incorrecta")

@app.put("/api/articles/{article_id}/description")
def update_article_description(
    article_id: int,
    payload: DescriptionUpdate,
    db: Session = Depends(get_db)
):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    
    article.description = payload.description
    db.commit()
    db.refresh(article)
    return article

@app.post("/api/articles/{article_id}/images")
def add_article_image(
    article_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Artículo no encontrado")

    file_path = f"uploads/{image.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    new_image = ArticleImage(article_id=article_id, image_url=file_path)
    db.add(new_image)
    db.commit()
    db.refresh(article) # To get the updated images list
    return article

@app.delete("/api/articles/images/{image_id}")
def delete_article_image(
    image_id: int,
    db: Session = Depends(get_db)
):
    image = db.query(ArticleImage).filter(ArticleImage.id == image_id).first()
    if not image:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Imagen no encontrada")

    if image.image_url and os.path.exists(image.image_url):
        os.remove(image.image_url)

    db.delete(image)
    db.commit()
    return {"message": "Imagen eliminada"}

# ════════════════════════════════════════
# ORDERS & PROFITS
# ════════════════════════════════════════

@app.get("/api/orders")
def get_orders(db: Session = Depends(get_db)):
    # Sort by updated_at descending, fallback to id descending
    return db.query(Order).order_by(Order.updated_at.desc(), Order.id.desc()).all()

class OrderCreate(BaseModel):
    name: Optional[str] = None

@app.post("/api/orders")
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    count = db.query(Order).count()
    new_order = Order(
        name=payload.name if payload.name else f"Pedido {count + 1}",
        date=datetime.now().strftime("%Y-%m-%d"),
        updated_at=datetime.utcnow()
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order

@app.delete("/api/orders/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if order:
        db.delete(order)
        db.commit()
    return {"ok": True}

class OrderItemCreate(BaseModel):
    name: str
    buy_price: float

@app.post("/api/orders/{order_id}/items")
def add_order_item(order_id: int, payload: OrderItemCreate, db: Session = Depends(get_db)):
    item = OrderItem(
        order_id=order_id,
        name=payload.name,
        buy_price=payload.buy_price
    )
    db.add(item)
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if order:
        order.updated_at = datetime.utcnow()
        
    db.commit()
    db.refresh(item)
    return item

class OrderItemUpdate(BaseModel):
    name: Optional[str] = None
    buy_price: Optional[float] = None
    sell_price: Optional[float] = None

@app.put("/api/orders/items/{item_id}")
def update_order_item(item_id: int, payload: OrderItemUpdate, db: Session = Depends(get_db)):
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Item not found")
    
    if payload.name is not None:
        item.name = payload.name
    if payload.buy_price is not None:
        item.buy_price = payload.buy_price
    if payload.sell_price is not None:
        item.sell_price = payload.sell_price

    order = db.query(Order).filter(Order.id == item.order_id).first()
    if order:
        order.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(item)
    return item

@app.delete("/api/orders/items/{item_id}")
def delete_order_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if item:
        order = db.query(Order).filter(Order.id == item.order_id).first()
        if order:
            order.updated_at = datetime.utcnow()
        db.delete(item)
        db.commit()
    return {"ok": True}
