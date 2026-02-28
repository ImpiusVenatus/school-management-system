"""Student, Guardian, StudentGuardian."""
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(String, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    middle_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    student_name = Column(String, nullable=True)  # computed/full name
    student_email_id = Column(String, unique=True, nullable=False)
    student_mobile_number = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    blood_group = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    nationality = Column(String, nullable=True)
    joining_date = Column(Date, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    student_applicant_id = Column(String, nullable=True)
    enabled = Column(Boolean, default=True)
    # Address
    address_line_1 = Column(String, nullable=True)
    address_line_2 = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    pincode = Column(String, nullable=True)
    country = Column(String, nullable=True)
    # Exit
    date_of_leaving = Column(Date, nullable=True)
    leaving_certificate_number = Column(String, nullable=True)
    reason_for_leaving = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", backref="student")
    guardians_link = relationship("StudentGuardian", back_populates="student", cascade="all, delete-orphan")


class Guardian(Base):
    __tablename__ = "guardians"

    id = Column(String, primary_key=True, index=True)
    guardian_name = Column(String, nullable=False)
    email_address = Column(String, nullable=True)
    mobile_number = Column(String, nullable=True)
    alternate_number = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    user_id = Column(String, nullable=True)
    education = Column(String, nullable=True)
    occupation = Column(String, nullable=True)
    designation = Column(String, nullable=True)
    work_address = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    students_link = relationship("StudentGuardian", back_populates="guardian", cascade="all, delete-orphan")


class StudentGuardian(Base):
    __tablename__ = "student_guardians"

    id = Column(String, primary_key=True, index=True)
    parent_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    guardian_id = Column(String, ForeignKey("guardians.id", ondelete="CASCADE"), nullable=False)
    guardian_name = Column(String, nullable=True)
    relation = Column(String, nullable=True)  # Mother, Father, Others
    idx = Column(Integer, default=0)

    student = relationship("Student", back_populates="guardians_link")
    guardian = relationship("Guardian", back_populates="students_link")
