"""Student Group, Student Group Student, Student Group Instructor."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class StudentGroup(Base):
    __tablename__ = "student_groups"

    id = Column(String, primary_key=True, index=True)
    student_group_name = Column(String, unique=True, nullable=False)
    academic_year_id = Column(String, nullable=False)
    academic_term_id = Column(String, nullable=True)
    group_based_on = Column(String, nullable=False)  # Batch, Course, Activity
    program_id = Column(String, nullable=True)
    batch_id = Column(String, nullable=True)
    course_id = Column(String, nullable=True)
    student_category_id = Column(String, nullable=True)
    max_strength = Column(Integer, nullable=True)
    disabled = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    students = relationship(
        "StudentGroupStudent", back_populates="student_group", cascade="all, delete-orphan"
    )
    instructors = relationship(
        "StudentGroupInstructor", back_populates="student_group", cascade="all, delete-orphan"
    )


class StudentGroupStudent(Base):
    __tablename__ = "student_group_students"

    id = Column(String, primary_key=True, index=True)
    parent_id = Column(String, ForeignKey("student_groups.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    student_name = Column(String, nullable=True)
    group_roll_number = Column(Integer, nullable=True)
    active = Column(Boolean, default=True)
    idx = Column(Integer, default=0)

    student_group = relationship("StudentGroup", back_populates="students")
    student = relationship("Student", backref="student_group_members")


class StudentGroupInstructor(Base):
    __tablename__ = "student_group_instructors"

    id = Column(String, primary_key=True, index=True)
    parent_id = Column(String, ForeignKey("student_groups.id", ondelete="CASCADE"), nullable=False)
    instructor_id = Column(String, ForeignKey("instructors.id", ondelete="CASCADE"), nullable=False)
    idx = Column(Integer, default=0)

    student_group = relationship("StudentGroup", back_populates="instructors")
    instructor = relationship("Instructor", backref="student_groups")
