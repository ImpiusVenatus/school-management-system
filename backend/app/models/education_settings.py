"""Education Settings (single row config)."""
from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.sql import func
from app.database import Base


class EducationSettings(Base):
    __tablename__ = "education_settings"

    id = Column(String, primary_key=True, default="Education Settings")
    current_academic_year_id = Column(String, nullable=True)
    current_academic_term_id = Column(String, nullable=True)
    attendance_freeze_date = Column(String, nullable=True)
    validate_batch = Column(Boolean, default=False)
    validate_course = Column(Boolean, default=False)
    user_creation_skip = Column(Boolean, default=False)
    attendance_based_on_course_schedule = Column(Boolean, default=True)
    school_college_name_abbreviation = Column(String, nullable=True)
    school_college_logo = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
