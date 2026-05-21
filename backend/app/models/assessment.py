"""Assessment Group, Criteria, Plan, Result, Grading Scale."""
from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class AssessmentGroup(Base):
    __tablename__ = "assessment_groups"

    id = Column(String, primary_key=True, index=True)
    assessment_group_name = Column(String, nullable=False)
    is_group = Column(Integer, default=0)
    parent_assessment_group_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AssessmentCriteria(Base):
    __tablename__ = "assessment_criteria"

    id = Column(String, primary_key=True, index=True)
    criteria_name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class GradingScale(Base):
    __tablename__ = "grading_scales"

    id = Column(String, primary_key=True, index=True)
    grading_scale_name = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)
    calculation_rules = Column(Text, nullable=True)
    updated_by_name = Column(String(120), nullable=True)
    docstatus = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    intervals = relationship(
        "GradingScaleInterval", back_populates="grading_scale", cascade="all, delete-orphan"
    )


class GradingScaleInterval(Base):
    __tablename__ = "grading_scale_intervals"

    id = Column(String, primary_key=True, index=True)
    parent_id = Column(String, ForeignKey("grading_scales.id", ondelete="CASCADE"), nullable=False)
    grade_code = Column(String, nullable=False)
    threshold = Column(Float, default=0)  # percentage
    grade_description = Column(Text, nullable=True)
    gpa_points = Column(Float, nullable=True)
    color = Column(String(20), nullable=True)
    idx = Column(Integer, default=0)

    grading_scale = relationship("GradingScale", back_populates="intervals")


class AssessmentPlan(Base):
    __tablename__ = "assessment_plans"

    id = Column(String, primary_key=True, index=True)
    student_group_id = Column(String, ForeignKey("student_groups.id", ondelete="CASCADE"), nullable=False)
    assessment_name = Column(String, nullable=True)
    assessment_group_id = Column(String, nullable=False)
    grading_scale_id = Column(String, nullable=False)
    program_id = Column(String, nullable=True)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    academic_year_id = Column(String, nullable=True)
    academic_term_id = Column(String, nullable=True)
    schedule_date = Column(Date, nullable=False)
    room_id = Column(String, nullable=True)
    examiner_id = Column(String, nullable=True)
    examiner_name = Column(String, nullable=True)
    from_time = Column(Time, nullable=True)
    to_time = Column(Time, nullable=True)
    supervisor_id = Column(String, nullable=True)
    supervisor_name = Column(String, nullable=True)
    maximum_assessment_score = Column(Float, nullable=False)
    docstatus = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    student_group = relationship("StudentGroup", backref="assessment_plans")
    course = relationship("Course", backref="assessment_plans")
    criteria = relationship(
        "AssessmentPlanCriteria", back_populates="assessment_plan", cascade="all, delete-orphan"
    )


class AssessmentPlanCriteria(Base):
    __tablename__ = "assessment_plan_criteria"

    id = Column(String, primary_key=True, index=True)
    parent_id = Column(String, ForeignKey("assessment_plans.id", ondelete="CASCADE"), nullable=False)
    assessment_criteria_id = Column(String, nullable=False)
    maximum_score = Column(Float, nullable=False)
    idx = Column(Integer, default=0)

    assessment_plan = relationship("AssessmentPlan", back_populates="criteria")


class AssessmentResult(Base):
    __tablename__ = "assessment_results"

    id = Column(String, primary_key=True, index=True)
    assessment_plan_id = Column(String, ForeignKey("assessment_plans.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    student_name = Column(String, nullable=True)
    student_group_id = Column(String, nullable=True)
    assessment_group_id = Column(String, nullable=True)
    grading_scale_id = Column(String, nullable=True)
    maximum_score = Column(Float, nullable=True)
    total_score = Column(Float, nullable=True)
    grade = Column(String, nullable=True)
    comment = Column(Text, nullable=True)
    docstatus = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assessment_plan = relationship("AssessmentPlan", backref="results")
    student = relationship("Student", backref="assessment_results")
    details = relationship(
        "AssessmentResultDetail", back_populates="assessment_result", cascade="all, delete-orphan"
    )


class AssessmentResultDetail(Base):
    __tablename__ = "assessment_result_details"

    id = Column(String, primary_key=True, index=True)
    parent_id = Column(String, ForeignKey("assessment_results.id", ondelete="CASCADE"), nullable=False)
    assessment_criteria_id = Column(String, nullable=False)
    maximum_score = Column(Float, nullable=True)
    score = Column(Float, nullable=False)
    grade = Column(String, nullable=True)
    idx = Column(Integer, default=0)

    assessment_result = relationship("AssessmentResult", back_populates="details")
