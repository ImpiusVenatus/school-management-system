"""Education Settings (single row config)."""
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
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
    school_type = Column(String, default="program")  # program | k12
    academic_year_start_month = Column(Integer, default=4)  # 1=Jan, 4=Apr, 6=Jun, 9=Sep
    school_code = Column(String(20), nullable=True)
    tagline = Column(String(255), nullable=True)
    affiliation_board = Column(String(80), nullable=True)
    registration_number = Column(String(80), nullable=True)
    recognition_year = Column(String(10), nullable=True)
    address = Column(Text, nullable=True)
    phone = Column(String(40), nullable=True)
    email = Column(String(120), nullable=True)
    website = Column(String(255), nullable=True)
    brand_color = Column(String(20), nullable=True)
    notification_config = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
