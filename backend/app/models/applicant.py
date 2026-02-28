"""Student Applicant (admission application)."""
from sqlalchemy import Boolean, Column, Date, DateTime, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class StudentApplicant(Base):
    __tablename__ = "student_applicants"

    id = Column(String, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    middle_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    title = Column(String, nullable=True)
    application_date = Column(Date, nullable=True)
    application_status = Column(String, default="Applied")  # Applied, Approved, Rejected, Admitted
    program_id = Column(String, nullable=False)
    academic_year_id = Column(String, nullable=False)
    academic_term_id = Column(String, nullable=True)
    student_category_id = Column(String, nullable=True)
    student_admission_id = Column(String, nullable=True)
    student_email_id = Column(String, unique=True, nullable=True)
    student_mobile_number = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)
    nationality = Column(String, nullable=True)
    paid = Column(Boolean, default=False)
    address_line_1 = Column(String, nullable=True)
    address_line_2 = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    pincode = Column(String, nullable=True)
    country = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
