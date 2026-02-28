"""Course Schedule."""
from sqlalchemy import Column, Date, DateTime, ForeignKey, Time, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class CourseSchedule(Base):
    __tablename__ = "course_schedules"

    id = Column(String, primary_key=True, index=True)
    student_group_id = Column(String, ForeignKey("student_groups.id", ondelete="CASCADE"), nullable=False)
    instructor_id = Column(String, ForeignKey("instructors.id", ondelete="CASCADE"), nullable=False)
    instructor_name = Column(String, nullable=True)
    program_id = Column(String, nullable=True)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    schedule_date = Column(Date, nullable=False)
    room_id = Column(String, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)
    from_time = Column(Time, nullable=False)
    to_time = Column(Time, nullable=False)
    title = Column(String, nullable=True)
    class_schedule_color = Column(String, default="blue")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    student_group = relationship("StudentGroup", backref="course_schedules")
    instructor = relationship("Instructor", backref="course_schedules")
    course = relationship("Course", backref="course_schedules")
    room = relationship("Room", backref="course_schedules")
