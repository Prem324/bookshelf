from sqlalchemy import Column, Integer, String

from database import Base


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True)
    title = Column(String)
    author = Column(String)
    year = Column(Integer, nullable=True)
    isbn = Column(String(32), nullable=True)
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    owner_id = Column(Integer)
