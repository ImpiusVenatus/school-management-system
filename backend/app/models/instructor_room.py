"""Instructor and Room."""
from sqlalchemy import Column, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Instructor(Base):
    __tablename__ = "instructors"

    id = Column(String, primary_key=True, index=True)
    instructor_name = Column(String, nullable=False)
    employee_id = Column(String, nullable=True)
    department_id = Column(String, ForeignKey("academic_departments.id", ondelete="SET NULL"), nullable=True, index=True)
    department = Column(String, nullable=True)
    designation_id = Column(String, ForeignKey("teacher_designations.id", ondelete="SET NULL"), nullable=True, index=True)
    designation = Column(String, nullable=True)
    academic_department = relationship("AcademicDepartment", foreign_keys=[department_id])
    teacher_designation = relationship("TeacherDesignation", foreign_keys=[designation_id])
    gender = Column(String, nullable=True)
    status = Column(String, default="Active")  # Active, Left
    termination_date = Column(Date, nullable=True)
    termination_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Room(Base):
    __tablename__ = "rooms"

    id = Column(String, primary_key=True, index=True)
    room_name = Column(String, nullable=False)
    room_number = Column(String, nullable=True)
    seating_capacity = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
