"""InstructorAssignment: teacher assignment to group/schedule with history and removal."""
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class InstructorAssignment(Base):
    __tablename__ = "instructor_assignments"

    id = Column(String, primary_key=True, index=True)
    instructor_id = Column(String, ForeignKey("instructors.id", ondelete="CASCADE"), nullable=False)
    student_group_id = Column(String, ForeignKey("student_groups.id", ondelete="CASCADE"), nullable=True)
    course_schedule_id = Column(String, nullable=True)  # optional link to specific schedule
    academic_year_id = Column(String, nullable=False)
    role = Column(String, default="teacher")  # teacher, advisor
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    removed_at = Column(DateTime(timezone=True), nullable=True)
    removal_reason = Column(Text, nullable=True)
    replaced_by_instructor_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    instructor = relationship("Instructor", backref="assignments")
    student_group = relationship("StudentGroup", backref="instructor_assignments")
