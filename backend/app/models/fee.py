"""Fee Category, Fee Structure, Fee Component, Fee Schedule, Fee Schedule Student Group."""
from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class FeeCategory(Base):
    __tablename__ = "fee_categories"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class FeeStructure(Base):
    __tablename__ = "fee_structures"

    id = Column(String, primary_key=True, index=True)
    program_id = Column(String, nullable=False)
    student_category_id = Column(String, nullable=True)
    academic_year_id = Column(String, nullable=False)
    academic_term_id = Column(String, nullable=True)
    total_amount = Column(Float, default=0)
    receivable_account = Column(String, nullable=True)
    cost_center = Column(String, nullable=True)
    company = Column(String, nullable=True)
    docstatus = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    components = relationship(
        "FeeComponent", back_populates="fee_structure", cascade="all, delete-orphan"
    )


class FeeComponent(Base):
    __tablename__ = "fee_components"

    id = Column(String, primary_key=True, index=True)
    parent_id = Column(String, ForeignKey("fee_structures.id", ondelete="CASCADE"), nullable=False)
    fees_category_id = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    amount = Column(Float, nullable=False)
    item_id = Column(String, nullable=True)
    discount = Column(Float, default=0)
    total = Column(Float, nullable=True)
    idx = Column(Integer, default=0)

    fee_structure = relationship("FeeStructure", back_populates="components")


class FeeSchedule(Base):
    __tablename__ = "fee_schedules"

    id = Column(String, primary_key=True, index=True)
    fee_structure_id = Column(String, ForeignKey("fee_structures.id", ondelete="CASCADE"), nullable=False)
    posting_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    program_id = Column(String, nullable=True)
    academic_year_id = Column(String, nullable=False)
    academic_term_id = Column(String, nullable=True)
    student_category_id = Column(String, nullable=True)
    total_amount = Column(Float, default=0)
    grand_total = Column(Float, default=0)
    send_email = Column(Boolean, default=False)
    status = Column(
        String, default="Draft"
    )  # Draft, Cancelled, Invoice Pending, Order Pending, In Process, Invoice Created, Order Created, Failed
    receivable_account = Column(String, nullable=True)
    cost_center = Column(String, nullable=True)
    company = Column(String, nullable=True)
    docstatus = Column(Integer, default=0)
    error_log = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    fee_structure = relationship("FeeStructure", backref="fee_schedules")
    student_groups = relationship(
        "FeeScheduleStudentGroup", back_populates="fee_schedule", cascade="all, delete-orphan"
    )


class FeeScheduleStudentGroup(Base):
    __tablename__ = "fee_schedule_student_groups"

    id = Column(String, primary_key=True, index=True)
    parent_id = Column(String, ForeignKey("fee_schedules.id", ondelete="CASCADE"), nullable=False)
    student_group_id = Column(String, nullable=False)
    total_students = Column(Integer, nullable=True)
    idx = Column(Integer, default=0)

    fee_schedule = relationship("FeeSchedule", back_populates="student_groups")
