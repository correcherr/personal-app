from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base

class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    price = Column(Float)
    date = Column(String)
    image_url = Column(String)
    link = Column(String, nullable=True)
    description = Column(String, nullable=True)

    images = relationship("ArticleImage", cascade="all, delete-orphan", lazy="joined")

class ArticleImage(Base):
    __tablename__ = "article_images"

    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("articles.id"))
    image_url = Column(String)

from datetime import datetime

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    date = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("OrderItem", cascade="all, delete-orphan", lazy="joined")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    name = Column(String)
    buy_price = Column(Float)
    sell_price = Column(Float, nullable=True)
