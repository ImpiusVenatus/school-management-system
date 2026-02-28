"""Student Attendance and Student Leave Application."""
from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class StudentAttendance(Base):
    __tablename__ = "student_attendances"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    student_name = Column(String, nullable=True)
    course_schedule_id = Column(String, nullable=True)
    student_group_id = Column(String, nullable=True)
    date = Column(Date, nullable=False)
    status = Column(String, nullable=False)  # Present, Absent, Leave
    leave_application_id = Column(String, nullable=True)
    docstatus = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    student = relationship("Student", backref="attendances")


class StudentLeaveApplication(Base):
    __tablename__ = "student_leave_applications"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    student_name = Column(String, nullable=True)
    from_date = Column(Date, nullable=False)
    to_date = Column(Date, nullable=False)
    total_leave_days = Column(Float, nullable=True)
    attendance_based_on = Column(String, default="Student Group")  # Student Group, Course Schedule
    student_group_id = Column(String, nullable=True)
    course_schedule_id = Column(String, nullable=True)
    mark_as_present = Column(Boolean, default=False)
    reason = Column(String, nullable=True)
    docstatus = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    student = relationship("Student", backref="leave_applications")
