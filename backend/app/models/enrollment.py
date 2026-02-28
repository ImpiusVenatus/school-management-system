"""Program Enrollment, Program Enrollment Course, Course Enrollment."""
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ProgramEnrollment(Base):
    __tablename__ = "program_enrollments"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    student_name = Column(String, nullable=True)
    program_id = Column(String, ForeignKey("programs.id", ondelete="CASCADE"), nullable=False)
    academic_year_id = Column(String, nullable=False)
    academic_term_id = Column(String, nullable=True)
    enrollment_date = Column(Date, nullable=False)
    student_category_id = Column(String, nullable=True)
    student_batch_name = Column(String, nullable=True)
    school_house_id = Column(String, nullable=True)
    boarding_student = Column(Boolean, default=False)
    grade_level = Column(String, nullable=True)  # e.g. "10"
    section_name = Column(String, nullable=True)  # e.g. "A"
    student_advisor_id = Column(String, nullable=True)  # FK to Instructor
    docstatus = Column(Integer, default=0)  # 0 Draft, 1 Submitted, 2 Cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    student = relationship("Student", backref="program_enrollments")
    courses = relationship(
        "ProgramEnrollmentCourse", back_populates="program_enrollment", cascade="all, delete-orphan"
    )
    course_enrollments = relationship(
        "CourseEnrollment", back_populates="program_enrollment", cascade="all, delete-orphan"
    )


class ProgramEnrollmentCourse(Base):
    __tablename__ = "program_enrollment_courses"

    id = Column(String, primary_key=True, index=True)
    parent_id = Column(String, ForeignKey("program_enrollments.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    course_name = Column(String, nullable=True)
    idx = Column(Integer, default=0)

    program_enrollment = relationship("ProgramEnrollment", back_populates="courses")
    course = relationship("Course", backref="program_enrollment_courses")


class CourseEnrollment(Base):
    __tablename__ = "course_enrollments"

    id = Column(String, primary_key=True, index=True)
    program_enrollment_id = Column(
        String, ForeignKey("program_enrollments.id", ondelete="CASCADE"), nullable=False
    )
    student_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    student_name = Column(String, nullable=True)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    enrollment_date = Column(Date, nullable=False)
    program_id = Column(String, nullable=True)  # denormalized
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    program_enrollment = relationship("ProgramEnrollment", back_populates="course_enrollments")
    student = relationship("Student", backref="course_enrollments")
    course = relationship("Course", backref="course_enrollments")
