"""Invoices and payments API."""
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models import Invoice, InvoiceItem, Payment, Student, FeeStructure, FeeComponent, StudentGroupStudent
from app.core.auth import get_current_user, require_permission
from app.models import User
from app.services.id_gen import new_id

router = APIRouter(prefix="/invoices", tags=["invoices"])


class InvoiceItemIn(BaseModel):
    description: str
    amount: float
    category_id: str | None = None


class InvoiceCreate(BaseModel):
    student_id: str
    period_label: str
    due_date: date
    items: list[InvoiceItemIn]
    discount: float = 0
    fee_structure_id: str | None = None


class PaymentCreate(BaseModel):
    invoice_id: str
    amount: float
    method: str = "cash"
    transaction_ref: str | None = None
    notes: str | None = None


class GenerateInvoicesRequest(BaseModel):
    fee_structure_id: str
    period_label: str
    due_date: date
    student_group_id: str | None = None


def _update_invoice_status(inv: Invoice, db: Session):
    paid = sum((p.amount for p in db.query(Payment).filter(Payment.invoice_id == inv.id).all()), Decimal(0))
    total = Decimal(str(inv.total))
    if paid >= total:
        inv.status = "paid"
    elif paid > 0:
        inv.status = "partial"
    elif inv.due_date < date.today():
        inv.status = "overdue"
    else:
        inv.status = "pending"
    db.commit()


@router.get("")
def list_invoices(
    student_id: str | None = None,
    status: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoices.read")),
):
    q = db.query(Invoice)
    if student_id:
        q = q.filter(Invoice.student_id == student_id)
    if status:
        q = q.filter(Invoice.status == status)
    rows = q.offset(skip).limit(limit).all()
    return [
        {
            "id": r.id,
            "student_id": r.student_id,
            "period_label": r.period_label,
            "due_date": str(r.due_date),
            "total": float(r.total),
            "status": r.status,
        }
        for r in rows
    ]


@router.post("")
def create_invoice(
    body: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("fees.manage")),
):
    subtotal = sum(i.amount for i in body.items)
    total = subtotal - body.discount
    iid = new_id("INV")
    inv = Invoice(
        id=iid,
        student_id=body.student_id,
        fee_structure_id=body.fee_structure_id,
        period_label=body.period_label,
        issued_on=date.today(),
        due_date=body.due_date,
        subtotal=subtotal,
        discount=body.discount,
        total=total,
        status="pending",
    )
    db.add(inv)
    for item in body.items:
        db.add(InvoiceItem(id=new_id("INI"), invoice_id=iid, category_id=item.category_id, description=item.description, amount=item.amount))
    db.commit()
    return {"id": iid, "total": total, "status": "pending"}


@router.post("/generate-from-structure")
def generate_invoices(
    body: GenerateInvoicesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("fees.manage")),
):
    fs = db.query(FeeStructure).filter(FeeStructure.id == body.fee_structure_id).first()
    if not fs:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    comps = db.query(FeeComponent).filter(FeeComponent.parent_id == body.fee_structure_id).all()
    items = [InvoiceItemIn(description=c.description or c.fees_category_id, amount=float(c.total or c.amount), category_id=c.fees_category_id) for c in comps]
    if not items:
        raise HTTPException(status_code=400, detail="Fee structure has no components")
    student_ids: list[str] = []
    if body.student_group_id:
        links = db.query(StudentGroupStudent).filter(StudentGroupStudent.parent_id == body.student_group_id, StudentGroupStudent.active == True).all()
        student_ids = [l.student_id for l in links]
    else:
        student_ids = [s.id for s in db.query(Student).filter(Student.enabled == True).limit(500).all()]
    created = []
    for sid in student_ids:
        if db.query(Invoice).filter(Invoice.student_id == sid, Invoice.period_label == body.period_label).first():
            continue
        subtotal = sum(i.amount for i in items)
        iid = new_id("INV")
        inv = Invoice(
            id=iid, student_id=sid, fee_structure_id=body.fee_structure_id, period_label=body.period_label,
            issued_on=date.today(), due_date=body.due_date, subtotal=subtotal, discount=0, total=subtotal, status="pending",
        )
        db.add(inv)
        for item in items:
            db.add(InvoiceItem(id=new_id("INI"), invoice_id=iid, category_id=item.category_id, description=item.description, amount=item.amount))
        created.append(iid)
    db.commit()
    return {"created": len(created), "invoice_ids": created}


@router.post("/payments")
def collect_payment(
    body: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.collect")),
):
    inv = db.query(Invoice).filter(Invoice.id == body.invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    pid = new_id("PAY")
    db.add(Payment(
        id=pid, invoice_id=body.invoice_id, amount=body.amount, method=body.method,
        transaction_ref=body.transaction_ref, received_by_id=current_user.id, notes=body.notes,
    ))
    db.commit()
    _update_invoice_status(inv, db)
    return {"id": pid, "invoice_status": inv.status}
