"""Fee Structure, Fee Schedule, Fee Categories API."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import FeeStructure, FeeComponent, FeeSchedule, FeeScheduleStudentGroup, FeeCategory
from app.schemas.fee import FeeStructureCreate, FeeStructureResponse, FeeScheduleCreate, FeeScheduleResponse, FeeComponentItem
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id

router = APIRouter(prefix="/fees", tags=["fees"])


class FeeCategoryResponse(BaseModel):
    id: str
    name: str
    code: str | None = None
    default_frequency: str | None = None
    taxable_percent: float | None = None
    refundable: bool = False
    is_active: bool = True
    description: str | None = None
    structure_count: int = 0

    class Config:
        from_attributes = True


class FeeCategoryCreate(BaseModel):
    name: str
    code: str | None = None
    default_frequency: str | None = "Monthly"
    taxable_percent: float | None = None
    refundable: bool = False
    description: str | None = None


class FeeCategoryUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    default_frequency: str | None = None
    taxable_percent: float | None = None
    refundable: bool | None = None
    is_active: bool | None = None
    description: str | None = None


def _category_response(cat: FeeCategory, db: Session) -> FeeCategoryResponse:
    used = db.query(FeeComponent).filter(FeeComponent.fees_category_id == cat.id).count()
    return FeeCategoryResponse(
        id=cat.id,
        name=cat.name,
        code=cat.code,
        default_frequency=cat.default_frequency,
        taxable_percent=cat.taxable_percent,
        refundable=bool(cat.refundable),
        is_active=bool(cat.is_active),
        description=cat.description,
        structure_count=used,
    )


@router.get("/categories", response_model=list[FeeCategoryResponse])
def list_fee_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(FeeCategory).order_by(FeeCategory.name).all()
    return [_category_response(c, db) for c in rows]


@router.post("/categories", response_model=FeeCategoryResponse)
def create_fee_category(
    body: FeeCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = new_id("FCAT")
    row = FeeCategory(
        id=cid,
        name=body.name.strip(),
        code=(body.code or body.name[:3]).upper().strip()[:20],
        default_frequency=body.default_frequency,
        taxable_percent=body.taxable_percent,
        refundable=body.refundable,
        description=body.description,
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _category_response(row, db)


@router.patch("/categories/{category_id}", response_model=FeeCategoryResponse)
def update_fee_category(
    category_id: str,
    body: FeeCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(FeeCategory).filter(FeeCategory.id == category_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Fee category not found")
    for field in ("name", "code", "default_frequency", "taxable_percent", "description"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(row, field, val.strip() if isinstance(val, str) else val)
    if body.refundable is not None:
        row.refundable = body.refundable
    if body.is_active is not None:
        row.is_active = body.is_active
    db.commit()
    db.refresh(row)
    return _category_response(row, db)


@router.get("/structures", response_model=list[FeeStructureResponse])
def list_fee_structures(
    db: Session = Depends(get_db),
    program_id: str | None = None,
    academic_year_id: str | None = None,
    academic_term_id: str | None = None,
    current_user: User = Depends(get_current_user),
):
    q = db.query(FeeStructure)
    if program_id:
        q = q.filter(FeeStructure.program_id == program_id)
    if academic_year_id:
        q = q.filter(FeeStructure.academic_year_id == academic_year_id)
    if academic_term_id:
        q = q.filter(FeeStructure.academic_term_id == academic_term_id)
    rows = q.all()
    result = []
    for r in rows:
        comps = db.query(FeeComponent).filter(FeeComponent.parent_id == r.id).order_by(FeeComponent.idx).all()
        result.append(FeeStructureResponse(
            id=r.id,
            program_id=r.program_id,
            student_category_id=r.student_category_id,
            academic_year_id=r.academic_year_id,
            academic_term_id=r.academic_term_id,
            total_amount=r.total_amount,
            receivable_account=r.receivable_account,
            cost_center=r.cost_center,
            company=r.company,
            components=[FeeComponentItem(fees_category_id=c.fees_category_id, description=c.description, amount=c.amount, discount=c.discount, total=c.total) for c in comps],
            docstatus=r.docstatus,
        ))
    return result


@router.get("/structure/{program_id}")
def get_fee_structure(
    program_id: str,
    academic_term_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return fee structure name for program (and optional term)."""
    q = db.query(FeeStructure).filter(FeeStructure.program_id == program_id)
    if academic_term_id:
        q = q.filter(FeeStructure.academic_term_id == academic_term_id)
    r = q.first()
    return {"name": r.id} if r else {"name": None}


@router.get("/structure/{fee_structure_id}/components", response_model=list[dict])
def get_fee_components(
    fee_structure_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(FeeComponent).filter(FeeComponent.parent_id == fee_structure_id).order_by(FeeComponent.idx).all()
    return [{"fees_category_id": r.fees_category_id, "description": r.description, "amount": r.amount} for r in rows]


@router.post("/structures", response_model=FeeStructureResponse)
def create_fee_structure(
    body: FeeStructureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fid = new_id("FST")
    total = sum((c.amount * (1 - (c.discount or 0) / 100) for c in body.components))
    fs = FeeStructure(
        id=fid,
        program_id=body.program_id,
        student_category_id=body.student_category_id,
        academic_year_id=body.academic_year_id,
        academic_term_id=body.academic_term_id,
        total_amount=total,
        receivable_account=body.receivable_account,
        cost_center=body.cost_center,
        company=body.company,
    )
    db.add(fs)
    for i, c in enumerate(body.components):
        t = c.amount * (1 - (c.discount or 0) / 100)
        db.add(FeeComponent(id=new_id("FC"), parent_id=fid, fees_category_id=c.fees_category_id, description=c.description, amount=c.amount, discount=c.discount or 0, total=t, idx=i))
    db.commit()
    db.refresh(fs)
    comps = db.query(FeeComponent).filter(FeeComponent.parent_id == fid).order_by(FeeComponent.idx).all()
    return FeeStructureResponse(
        id=fs.id,
        program_id=fs.program_id,
        student_category_id=fs.student_category_id,
        academic_year_id=fs.academic_year_id,
        academic_term_id=fs.academic_term_id,
        total_amount=fs.total_amount,
        receivable_account=fs.receivable_account,
        cost_center=fs.cost_center,
        company=fs.company,
        components=[FeeComponentItem(fees_category_id=c.fees_category_id, description=c.description, amount=c.amount, discount=c.discount, total=c.total) for c in comps],
        docstatus=fs.docstatus,
    )


@router.get("/schedules", response_model=list[FeeScheduleResponse])
def list_fee_schedules(
    db: Session = Depends(get_db),
    program_id: str | None = None,
    academic_year_id: str | None = None,
    current_user: User = Depends(get_current_user),
):
    q = db.query(FeeSchedule)
    if program_id:
        q = q.filter(FeeSchedule.program_id == program_id)
    if academic_year_id:
        q = q.filter(FeeSchedule.academic_year_id == academic_year_id)
    rows = q.all()
    result = []
    for r in rows:
        sgs = db.query(FeeScheduleStudentGroup).filter(FeeScheduleStudentGroup.parent_id == r.id).all()
        result.append(FeeScheduleResponse(
            id=r.id,
            fee_structure_id=r.fee_structure_id,
            posting_date=r.posting_date,
            due_date=r.due_date,
            program_id=r.program_id,
            academic_year_id=r.academic_year_id,
            academic_term_id=r.academic_term_id,
            student_groups=[{"student_group_id": s.student_group_id, "total_students": s.total_students} for s in sgs],
            total_amount=r.total_amount,
            grand_total=r.grand_total,
            status=r.status,
            docstatus=r.docstatus,
        ))
    return result


@router.post("/schedules", response_model=FeeScheduleResponse)
def create_fee_schedule(
    body: FeeScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fs = db.query(FeeStructure).filter(FeeStructure.id == body.fee_structure_id).first()
    if not fs:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    sid = new_id("FSH")
    sched = FeeSchedule(
        id=sid,
        fee_structure_id=body.fee_structure_id,
        posting_date=body.posting_date,
        due_date=body.due_date,
        program_id=fs.program_id,
        academic_year_id=body.academic_year_id,
        academic_term_id=body.academic_term_id,
        total_amount=fs.total_amount,
        grand_total=fs.total_amount,
        send_email=body.send_email,
    )
    db.add(sched)
    for i, sg in enumerate(body.student_groups):
        db.add(FeeScheduleStudentGroup(id=new_id("FSSG"), parent_id=sid, student_group_id=sg.student_group_id, total_students=sg.total_students, idx=i))
    db.commit()
    db.refresh(sched)
    sgs = db.query(FeeScheduleStudentGroup).filter(FeeScheduleStudentGroup.parent_id == sid).all()
    return FeeScheduleResponse(
        id=sched.id,
        fee_structure_id=sched.fee_structure_id,
        posting_date=sched.posting_date,
        due_date=sched.due_date,
        program_id=sched.program_id,
        academic_year_id=sched.academic_year_id,
        academic_term_id=sched.academic_term_id,
        student_groups=[{"student_group_id": s.student_group_id, "total_students": s.total_students} for s in sgs],
        total_amount=sched.total_amount,
        grand_total=sched.grand_total,
        status=sched.status,
        docstatus=sched.docstatus,
    )
