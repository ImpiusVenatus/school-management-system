"""Program and Course masters + ProgramCourse link."""
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Program(Base):
    __tablename__ = "programs"

    id = Column(String, primary_key=True, index=True)
    program_name = Column(String, unique=True, nullable=False)
    program_abbreviation = Column(String, nullable=True)
    department = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    courses = relationship("ProgramCourse", back_populates="program", cascade="all, delete-orphan")


class ProgramCourse(Base):
    __tablename__ = "program_courses"

    id = Column(String, primary_key=True, index=True)
    parent_id = Column(String, ForeignKey("programs.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    course_name = Column(String, nullable=True)  # denormalized
    required = Column(Boolean, default=True)
    idx = Column(Integer, default=0)

    program = relationship("Program", back_populates="courses")
    course = relationship("Course", back_populates="programs")


class Course(Base):
    __tablename__ = "courses"

    id = Column(String, primary_key=True, index=True)
    course_name = Column(String, unique=True, nullable=False)
    department = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    default_grading_scale_id = Column(String, nullable=True)  # FK to grading_scale
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    programs = relationship("ProgramCourse", back_populates="course", cascade="all, delete-orphan")
    assessment_criteria = relationship(
        "CourseAssessmentCriteria", back_populates="course", cascade="all, delete-orphan"
    )


class CourseAssessmentCriteria(Base):
    __tablename__ = "course_assessment_criteria"

    id = Column(String, primary_key=True, index=True)
    parent_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    assessment_criteria_id = Column(String, nullable=False)
    weightage = Column(Float, nullable=False)
    idx = Column(Integer, default=0)

    course = relationship("Course", back_populates="assessment_criteria")
