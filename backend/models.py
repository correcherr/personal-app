from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String)
    profile_photo = Column(String, nullable=True)
    currency = Column(String, default="EUR")
    language = Column(String, default="ES")
    theme = Column(String, default="dark-amoled")
    animation_level = Column(String, default="full") # full, reduced, none
    neon_glow = Column(Boolean, default=True)
    compact_mode = Column(Boolean, default=False)
    haptics = Column(Boolean, default=True)
    accent_color = Column(String, default="#7B2CBF") # Default Purple
    business_name = Column(String, nullable=True)
    platform = Column(String, nullable=True)
    product_type = Column(String, nullable=True)

    articles = relationship("Article", back_populates="owner")
    orders = relationship("Order", back_populates="owner")

class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String)
    category = Column(String, nullable=True)
    purchase_price = Column(Float, nullable=True) # Red
    recommended_price = Column(Float, nullable=True) # Yellow
    date = Column(String)
    image_url = Column(String, nullable=True)

    owner = relationship("User", back_populates="articles")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String)
    platform = Column(String, nullable=True)
    date = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="orders")
    items = relationship("OrderItem", cascade="all, delete-orphan", lazy="joined")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    article_id = Column(Integer, ForeignKey("articles.id"), nullable=True)
    name = Column(String)
    buy_price = Column(Float) # The actual purchase price for this order (Red)
    quantity = Column(Integer, default=1)
    
    article = relationship("Article", lazy="joined")
    sales = relationship("OrderItemSale", cascade="all, delete-orphan", lazy="joined")

class OrderItemSale(Base):
    __tablename__ = "order_item_sales"

    id = Column(Integer, primary_key=True, index=True)
    order_item_id = Column(Integer, ForeignKey("order_items.id"))
    sell_price = Column(Float, nullable=True) # Final sale price (Green)
    sold_at = Column(DateTime, nullable=True)
