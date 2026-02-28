"""Academic Year and Term."""
from sqlalchemy import Column, Date, DateTime, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class AcademicYear(Base):
    __tablename__ = "academic_years"

    id = Column(String, primary_key=True, index=True)
    academic_year_name = Column(String, unique=True, nullable=False)
    year_start_date = Column(Date, nullable=False)
    year_end_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AcademicTerm(Base):
    __tablename__ = "academic_terms"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, unique=True, nullable=True)
    academic_year_id = Column(String, nullable=False)  # FK resolved in router
    term_name = Column(String, nullable=False)
    term_start_date = Column(Date, nullable=False)
    term_end_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
