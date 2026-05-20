"""Invoices and payments (fee collection)."""
from sqlalchemy import Column, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.sql import func
from app.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.id"), nullable=False, index=True)
    fee_structure_id = Column(String, ForeignKey("fee_structures.id"), nullable=True)
    period_label = Column(String(50), nullable=False)
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    issued_on = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    discount = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), nullable=False)
    status = Column(String, default="pending")  # pending, partial, paid, overdue, cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(String, primary_key=True, index=True)
    invoice_id = Column(String, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(String, nullable=True)
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, index=True)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    method = Column(String, default="cash")
    transaction_ref = Column(String(100), nullable=True)
    paid_at = Column(DateTime(timezone=True), server_default=func.now())
    received_by_id = Column(String, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
