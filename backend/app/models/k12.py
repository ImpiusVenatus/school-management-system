"""K-12 academic structure: classes, sections, subjects, enrollments."""
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class K12Class(Base):
    __tablename__ = "k12_classes"
    __table_args__ = (UniqueConstraint("academic_year_id", "name", name="uq_k12_class_year_name"),)

    id = Column(String, primary_key=True, index=True)
    academic_year_id = Column(String, ForeignKey("academic_years.id"), nullable=False)
    name = Column(String(50), nullable=False)
    numeric_level = Column(Integer, nullable=True)
    grading_scale_id = Column(String, ForeignKey("grading_scales.id", ondelete="SET NULL"), nullable=True)
    timetable_weekdays = Column(String(32), nullable=True)  # JSON array 0=Mon … 6=Sun
    timetable_periods_per_day = Column(Integer, nullable=True)
    timetable_period_minutes = Column(Integer, nullable=True)
    timetable_break_minutes = Column(Integer, nullable=True)
    timetable_break_after_period = Column(Integer, nullable=True)
    timetable_start_time = Column(Time, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    sections = relationship("K12Section", back_populates="school_class", cascade="all, delete-orphan")
    class_subjects = relationship("K12ClassSubject", back_populates="school_class", cascade="all, delete-orphan")


class K12Section(Base):
    __tablename__ = "k12_sections"
    __table_args__ = (UniqueConstraint("class_id", "name", name="uq_k12_section_class_name"),)

    id = Column(String, primary_key=True, index=True)
    class_id = Column(String, ForeignKey("k12_classes.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)
    class_teacher_id = Column(String, ForeignKey("instructors.id"), nullable=True)
    capacity = Column(Integer, default=40)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    school_class = relationship("K12Class", back_populates="sections")
    enrollments = relationship("K12StudentEnrollment", back_populates="section")


class K12Subject(Base):
    __tablename__ = "k12_subjects"

    id = Column(String, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    is_optional = Column(Boolean, default=False)
    department_id = Column(String, ForeignKey("academic_departments.id", ondelete="SET NULL"), nullable=True)
    grades_label = Column(String(30), nullable=True)
    periods_per_week = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    department = relationship("AcademicDepartment", foreign_keys=[department_id])


class K12ClassSubject(Base):
    __tablename__ = "k12_class_subjects"
    __table_args__ = (UniqueConstraint("class_id", "subject_id", name="uq_k12_class_subject"),)

    class_id = Column(String, ForeignKey("k12_classes.id", ondelete="CASCADE"), primary_key=True)
    subject_id = Column(String, ForeignKey("k12_subjects.id", ondelete="CASCADE"), primary_key=True)
    full_marks = Column(Integer, default=100)
    pass_marks = Column(Integer, default=40)

    school_class = relationship("K12Class", back_populates="class_subjects")
    subject = relationship("K12Subject")


class K12StudentEnrollment(Base):
    __tablename__ = "k12_student_enrollments"
    __table_args__ = (UniqueConstraint("student_id", "academic_year_id", name="uq_k12_student_year"),)

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    section_id = Column(String, ForeignKey("k12_sections.id"), nullable=False)
    academic_year_id = Column(String, ForeignKey("academic_years.id"), nullable=False)
    roll_no = Column(String(20), nullable=True)
    enrolled_on = Column(Date, nullable=True)
    status = Column(String, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    section = relationship("K12Section", back_populates="enrollments")


class K12TimetableSlot(Base):
    __tablename__ = "k12_timetable_slots"

    id = Column(String, primary_key=True, index=True)
    class_id = Column(String, ForeignKey("k12_classes.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id = Column(String, ForeignKey("k12_sections.id", ondelete="CASCADE"), nullable=True)
    subject_id = Column(String, ForeignKey("k12_subjects.id", ondelete="CASCADE"), nullable=False)
    instructor_id = Column(String, ForeignKey("instructors.id", ondelete="SET NULL"), nullable=True)
    room_id = Column(String, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday … 6=Sunday
    period_index = Column(Integer, nullable=True)  # 0-based period in the day grid
    from_time = Column(Time, nullable=False)
    to_time = Column(Time, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class K12TeacherSubject(Base):
    __tablename__ = "k12_teacher_subjects"
    __table_args__ = (UniqueConstraint("teacher_id", "subject_id", name="uq_k12_teacher_subject"),)

    teacher_id = Column(String, ForeignKey("instructors.id", ondelete="CASCADE"), primary_key=True)
    subject_id = Column(String, ForeignKey("k12_subjects.id", ondelete="CASCADE"), primary_key=True)
