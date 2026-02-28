"""Notices and notice categories."""
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class NoticeCategory(Base):
    __tablename__ = "notice_categories"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=True)
    idx = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    notices = relationship("Notice", back_populates="category")


class Notice(Base):
    __tablename__ = "notices"

    id = Column(String, primary_key=True, index=True)
    category_id = Column(String, ForeignKey("notice_categories.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    created_by_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    pinned = Column(Boolean, default=False)
    valid_from = Column(Date, nullable=True)
    valid_until = Column(Date, nullable=True)

    category = relationship("NoticeCategory", back_populates="notices")
