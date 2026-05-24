"""Fee categories, structures, payment methods, and discount rules."""
import re
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.database import get_db
from app.models import (
    FeeCategory,
    FeeComponent,
    FeeDiscountRule,
    FeeSchedule,
    FeeScheduleStudentGroup,
    FeeStructure,
    K12Class,
    K12Section,
    K12StudentEnrollment,
    PaymentMethod,
    User,
)
from app.schemas.fee import (
    CloneYearRequest,
    FeeComponentItem,
    FeeDiscountRuleCreate,
    FeeDiscountRuleResponse,
    FeeDiscountRuleUpdate,
    FeeScheduleCreate,
    FeeScheduleResponse,
    FeeStructureBoardItem,
    FeeStructureCreate,
    FeeStructureResponse,
    FeeStructureUpdate,
    PaymentMethodCreate,
    PaymentMethodResponse,
    PaymentMethodUpdate,
)
from app.services.fee_calc import (
    average_monthly_from_annual,
    structure_annual_total,
    yearly_from_amount,
)
from app.services.id_gen import new_id

router = APIRouter(prefix="/fees", tags=["fees"])

_finance_lock = threading.Lock()
_finance_seeded = False


# --- Category schemas (inline) ---


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


def _k12_class_sort_key(cls: K12Class) -> tuple[int, str]:
    """Numeric order (3…10), not lexicographic (10 before 3)."""
    if cls.numeric_level is not None:
        return (int(cls.numeric_level), cls.name or "")
    match = re.search(r"(\d+)", cls.name or "")
    if match:
        return (int(match.group(1)), cls.name or "")
    return (9999, cls.name or "")


def _dedupe_payment_methods(db: Session) -> None:
    rows = (
        db.query(PaymentMethod)
        .order_by(PaymentMethod.sort_order.asc(), PaymentMethod.created_at.asc())
        .all()
    )
    seen: set[tuple[str, str]] = set()
    dirty = False
    for row in rows:
        key = (row.name.strip().lower(), (row.method_type or "").lower())
        if key in seen:
            db.delete(row)
            dirty = True
        else:
            seen.add(key)
    if dirty:
        db.commit()


def _dedupe_discount_rules(db: Session) -> None:
    rows = (
        db.query(FeeDiscountRule)
        .order_by(FeeDiscountRule.sort_order.asc(), FeeDiscountRule.created_at.asc())
        .all()
    )
    seen: set[tuple[str, str, float]] = set()
    dirty = False
    for row in rows:
        key = (
            row.name.strip().lower(),
            (row.criteria_type or "").lower(),
            round(float(row.discount_percent or 0), 2),
        )
        if key in seen:
            db.delete(row)
            dirty = True
        else:
            seen.add(key)
    if dirty:
        db.commit()


def _ensure_finance_defaults(db: Session) -> None:
    """Dedupe finance rows once per process (no auto-seed; users add methods and rules)."""
    global _finance_seeded
    if _finance_seeded:
        return
    with _finance_lock:
        if _finance_seeded:
            return
        _dedupe_payment_methods(db)
        _dedupe_discount_rules(db)
        _finance_seeded = True


def _category_counts(db: Session) -> dict[str, int]:
    rows = (
        db.query(FeeComponent.fees_category_id, func.count(FeeComponent.id))
        .filter(FeeComponent.fees_category_id.isnot(None))
        .group_by(FeeComponent.fees_category_id)
        .all()
    )
    return {cid: int(cnt) for cid, cnt in rows}


def _category_response(cat: FeeCategory, counts: dict[str, int]) -> FeeCategoryResponse:
    return FeeCategoryResponse(
        id=cat.id,
        name=cat.name,
        code=cat.code,
        default_frequency=cat.default_frequency,
        taxable_percent=cat.taxable_percent,
        refundable=bool(cat.refundable),
        is_active=bool(cat.is_active),
        description=cat.description,
        structure_count=counts.get(cat.id, 0),
    )


def _student_count_for_class(db: Session, class_id: str, academic_year_id: str) -> int:
    return int(
        db.query(func.count(K12StudentEnrollment.id))
        .join(K12Section, K12StudentEnrollment.section_id == K12Section.id)
        .filter(
            K12Section.class_id == class_id,
            K12StudentEnrollment.academic_year_id == academic_year_id,
            K12StudentEnrollment.status == "active",
        )
        .scalar()
        or 0
    )


def _student_counts_for_year(db: Session, academic_year_id: str) -> dict[str, int]:
    rows = (
        db.query(K12Section.class_id, func.count(K12StudentEnrollment.id))
        .join(K12Section, K12StudentEnrollment.section_id == K12Section.id)
        .filter(
            K12StudentEnrollment.academic_year_id == academic_year_id,
            K12StudentEnrollment.status == "active",
        )
        .group_by(K12Section.class_id)
        .all()
    )
    return {class_id: int(count) for class_id, count in rows}


def _component_item(c: FeeComponent, cats: dict[str, FeeCategory]) -> FeeComponentItem:
    cat = cats.get(c.fees_category_id) if c.fees_category_id else None
    freq = c.frequency or (cat.default_frequency if cat else "Monthly")
    yearly = yearly_from_amount(float(c.amount or 0), freq)
    disc = float(c.discount or 0)
    line_total = yearly * (1 - disc / 100)
    return FeeComponentItem(
        id=c.id,
        fees_category_id=c.fees_category_id,
        description=c.description or (cat.name if cat else None),
        amount=float(c.amount or 0),
        discount=disc,
        total=float(c.total) if c.total is not None else line_total,
        frequency=freq,
        due_day=c.due_day,
        yearly_amount=yearly,
        category_code=cat.code if cat else None,
        category_name=cat.name if cat else None,
    )


def _structure_response(
    fs: FeeStructure,
    db: Session,
    class_name: str | None = None,
) -> FeeStructureResponse:
    comps = sorted(fs.components, key=lambda x: x.idx or 0)
    cat_ids = {c.fees_category_id for c in comps if c.fees_category_id}
    cats = (
        {r.id: r for r in db.query(FeeCategory).filter(FeeCategory.id.in_(cat_ids)).all()}
        if cat_ids
        else {}
    )
    items = [_component_item(c, cats) for c in comps]
    annual = structure_annual_total(comps)
    monthly = average_monthly_from_annual(annual)
    updated = fs.updated_at.isoformat() if fs.updated_at else None
    return FeeStructureResponse(
        id=fs.id,
        program_id=fs.program_id,
        student_category_id=fs.student_category_id,
        academic_year_id=fs.academic_year_id,
        academic_term_id=fs.academic_term_id,
        total_amount=float(fs.total_amount or annual),
        receivable_account=fs.receivable_account,
        cost_center=fs.cost_center,
        company=fs.company,
        components=items,
        docstatus=fs.docstatus or 0,
        class_name=class_name,
        student_count=_student_count_for_class(db, fs.program_id, fs.academic_year_id),
        annual_total=annual,
        monthly_total=monthly,
        updated_at=updated,
    )


def _apply_components(db: Session, structure_id: str, items: list[FeeComponentItem]) -> None:
    db.query(FeeComponent).filter(FeeComponent.parent_id == structure_id).delete()
    cats = {r.id: r for r in db.query(FeeCategory).all()}
    total = 0.0
    for i, c in enumerate(items):
        cat = cats.get(c.fees_category_id) if c.fees_category_id else None
        freq = c.frequency or (cat.default_frequency if cat else "Monthly")
        amt = float(c.amount or 0)
        disc = float(c.discount or 0)
        yearly = yearly_from_amount(amt, freq)
        line_total = yearly * (1 - disc / 100)
        total += line_total
        db.add(
            FeeComponent(
                id=c.id or new_id("FC"),
                parent_id=structure_id,
                fees_category_id=c.fees_category_id,
                description=c.description or (cat.name if cat else None),
                amount=amt,
                discount=disc,
                total=line_total,
                frequency=freq,
                due_day=c.due_day,
                idx=i,
            )
        )
    fs = db.query(FeeStructure).filter(FeeStructure.id == structure_id).first()
    if fs:
        fs.total_amount = round(total, 2)
        fs.updated_at = datetime.now(timezone.utc)


# --- Categories ---


@router.get("/categories", response_model=list[FeeCategoryResponse])
def list_fee_categories(
    active_only: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(FeeCategory).order_by(FeeCategory.name)
    if active_only is True:
        q = q.filter(FeeCategory.is_active == True)
    elif active_only is False:
        q = q.filter(FeeCategory.is_active == False)
    rows = q.all()
    counts = _category_counts(db)
    return [_category_response(c, counts) for c in rows]


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
    return _category_response(row, _category_counts(db))


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
    return _category_response(row, _category_counts(db))


# --- Structure board ---


def _component_counts_by_structure(db: Session, structure_ids: list[str]) -> dict[str, int]:
    if not structure_ids:
        return {}
    rows = (
        db.query(FeeComponent.parent_id, func.count(FeeComponent.id))
        .filter(FeeComponent.parent_id.in_(structure_ids))
        .group_by(FeeComponent.parent_id)
        .all()
    )
    return {sid: int(cnt) for sid, cnt in rows}


def _build_fee_structure_board(
    db: Session,
    academic_year_id: str,
) -> list[FeeStructureBoardItem]:
    classes = (
        db.query(K12Class)
        .filter(K12Class.academic_year_id == academic_year_id)
        .all()
    )
    classes.sort(key=_k12_class_sort_key)
    structures = {
        s.program_id: s
        for s in db.query(FeeStructure)
        .filter(FeeStructure.academic_year_id == academic_year_id)
        .all()
    }
    structure_ids = [s.id for s in structures.values()]
    item_counts = _component_counts_by_structure(db, structure_ids)
    student_counts = _student_counts_for_year(db, academic_year_id)
    out: list[FeeStructureBoardItem] = []
    for cls in classes:
        fs = structures.get(cls.id)
        annual = float(fs.total_amount or 0) if fs else 0.0
        out.append(
            FeeStructureBoardItem(
                class_id=cls.id,
                class_name=cls.name,
                structure_id=fs.id if fs else None,
                monthly_total=average_monthly_from_annual(annual),
                annual_total=annual,
                student_count=student_counts.get(cls.id, 0),
                item_count=item_counts.get(fs.id, 0) if fs else 0,
            )
        )
    return out


@router.get("/structures/board", response_model=list[FeeStructureBoardItem])
def fee_structure_board(
    academic_year_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _build_fee_structure_board(db, academic_year_id)


class FeeSettingsPageResponse(BaseModel):
    categories: list[FeeCategoryResponse]
    board: list[FeeStructureBoardItem]
    payment_methods: list[PaymentMethodResponse]
    discount_rules: list[FeeDiscountRuleResponse]


@router.get("/settings-page", response_model=FeeSettingsPageResponse)
def get_fee_settings_page(
    academic_year_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Categories, structure board, and finance extras in one request."""
    _ensure_finance_defaults(db)
    cat_rows = db.query(FeeCategory).order_by(FeeCategory.name).all()
    counts = _category_counts(db)
    payment_methods = [
        PaymentMethodResponse.model_validate(r)
        for r in db.query(PaymentMethod).order_by(PaymentMethod.sort_order, PaymentMethod.name).all()
    ]
    discount_rules = [
        FeeDiscountRuleResponse.model_validate(r)
        for r in db.query(FeeDiscountRule).order_by(FeeDiscountRule.sort_order, FeeDiscountRule.name).all()
    ]
    return FeeSettingsPageResponse(
        categories=[_category_response(c, counts) for c in cat_rows],
        board=_build_fee_structure_board(db, academic_year_id),
        payment_methods=payment_methods,
        discount_rules=discount_rules,
    )


@router.get("/structures/by-class/{class_id}", response_model=FeeStructureResponse)
def get_structure_by_class(
    class_id: str,
    academic_year_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cls = db.query(K12Class).filter(K12Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    fs = (
        db.query(FeeStructure)
        .options(joinedload(FeeStructure.components))
        .filter(
            FeeStructure.program_id == class_id,
            FeeStructure.academic_year_id == academic_year_id,
        )
        .first()
    )
    if not fs:
        fs = FeeStructure(
            id=new_id("FST"),
            program_id=class_id,
            academic_year_id=academic_year_id,
            total_amount=0,
        )
        db.add(fs)
        db.commit()
        db.refresh(fs)
    return _structure_response(fs, db, class_name=cls.name)


@router.patch("/structures/{structure_id}", response_model=FeeStructureResponse)
def update_fee_structure(
    structure_id: str,
    body: FeeStructureUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fs = (
        db.query(FeeStructure)
        .options(joinedload(FeeStructure.components))
        .filter(FeeStructure.id == structure_id)
        .first()
    )
    if not fs:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    _apply_components(db, structure_id, body.components)
    db.commit()
    db.refresh(fs)
    cls = db.query(K12Class).filter(K12Class.id == fs.program_id).first()
    return _structure_response(fs, db, class_name=cls.name if cls else None)


@router.post("/structures/clone-year")
def clone_structures_year(
    body: CloneYearRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    to_classes = {
        c.name: c
        for c in db.query(K12Class).filter(K12Class.academic_year_id == body.to_academic_year_id).all()
    }
    source = (
        db.query(FeeStructure)
        .options(joinedload(FeeStructure.components))
        .filter(FeeStructure.academic_year_id == body.from_academic_year_id)
        .all()
    )
    cloned = 0
    for fs in source:
        src_cls = db.query(K12Class).filter(K12Class.id == fs.program_id).first()
        if not src_cls:
            continue
        tgt_cls = to_classes.get(src_cls.name)
        if not tgt_cls:
            continue
        existing = (
            db.query(FeeStructure)
            .filter(
                FeeStructure.program_id == tgt_cls.id,
                FeeStructure.academic_year_id == body.to_academic_year_id,
            )
            .first()
        )
        if existing:
            db.delete(existing)
            db.flush()
        new_fs = FeeStructure(
            id=new_id("FST"),
            program_id=tgt_cls.id,
            academic_year_id=body.to_academic_year_id,
            total_amount=fs.total_amount,
        )
        db.add(new_fs)
        db.flush()
        items = [
            FeeComponentItem(
                fees_category_id=c.fees_category_id,
                description=c.description,
                amount=float(c.amount or 0),
                discount=float(c.discount or 0),
                frequency=c.frequency,
                due_day=c.due_day,
            )
            for c in sorted(fs.components, key=lambda x: x.idx or 0)
        ]
        _apply_components(db, new_fs.id, items)
        cloned += 1
    db.commit()
    return {"message": f"Cloned {cloned} structure(s)", "cloned": cloned}


# --- Legacy structure endpoints ---


@router.get("/structures", response_model=list[FeeStructureResponse])
def list_fee_structures(
    db: Session = Depends(get_db),
    program_id: str | None = None,
    academic_year_id: str | None = None,
    academic_term_id: str | None = None,
    current_user: User = Depends(get_current_user),
):
    q = db.query(FeeStructure).options(joinedload(FeeStructure.components))
    if program_id:
        q = q.filter(FeeStructure.program_id == program_id)
    if academic_year_id:
        q = q.filter(FeeStructure.academic_year_id == academic_year_id)
    if academic_term_id:
        q = q.filter(FeeStructure.academic_term_id == academic_term_id)
    rows = q.all()
    return [_structure_response(r, db) for r in rows]


@router.get("/structure/{program_id}")
def get_fee_structure(
    program_id: str,
    academic_term_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    fs = FeeStructure(
        id=fid,
        program_id=body.program_id,
        student_category_id=body.student_category_id,
        academic_year_id=body.academic_year_id,
        academic_term_id=body.academic_term_id,
        receivable_account=body.receivable_account,
        cost_center=body.cost_center,
        company=body.company,
    )
    db.add(fs)
    db.flush()
    _apply_components(db, fid, body.components)
    db.commit()
    db.refresh(fs)
    cls = db.query(K12Class).filter(K12Class.id == fs.program_id).first()
    return _structure_response(fs, db, class_name=cls.name if cls else None)


# --- Payment methods ---


@router.get("/finance-extras")
def list_finance_extras(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Payment methods + discount rules in one request (avoids parallel seed races)."""
    _ensure_finance_defaults(db)
    payment_methods = [
        PaymentMethodResponse.model_validate(r)
        for r in db.query(PaymentMethod).order_by(PaymentMethod.sort_order, PaymentMethod.name).all()
    ]
    discount_rules = [
        FeeDiscountRuleResponse.model_validate(r)
        for r in db.query(FeeDiscountRule).order_by(FeeDiscountRule.sort_order, FeeDiscountRule.name).all()
    ]
    return {"payment_methods": payment_methods, "discount_rules": discount_rules}


@router.get("/payment-methods", response_model=list[PaymentMethodResponse])
def list_payment_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_finance_defaults(db)
    rows = db.query(PaymentMethod).order_by(PaymentMethod.sort_order, PaymentMethod.name).all()
    return [PaymentMethodResponse.model_validate(r) for r in rows]


@router.post("/payment-methods", response_model=PaymentMethodResponse)
def create_payment_method(
    body: PaymentMethodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = PaymentMethod(
        id=new_id("PAY"),
        name=body.name.strip(),
        method_type=body.method_type,
        provider=body.provider,
        fee_note=body.fee_note,
        is_enabled=body.is_enabled,
        sort_order=int(db.query(func.max(PaymentMethod.sort_order)).scalar() or 0) + 1,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return PaymentMethodResponse.model_validate(row)


@router.patch("/payment-methods/{method_id}", response_model=PaymentMethodResponse)
def update_payment_method(
    method_id: str,
    body: PaymentMethodUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(PaymentMethod).filter(PaymentMethod.id == method_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Payment method not found")
    for field in ("name", "method_type", "provider", "fee_note"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(row, field, val.strip() if isinstance(val, str) else val)
    if body.is_enabled is not None:
        row.is_enabled = body.is_enabled
    db.commit()
    db.refresh(row)
    return PaymentMethodResponse.model_validate(row)


@router.delete("/payment-methods/{method_id}")
def delete_payment_method(
    method_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(PaymentMethod).filter(PaymentMethod.id == method_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Payment method not found")
    db.delete(row)
    db.commit()
    return {"message": "Deleted"}


# --- Discount rules ---


@router.get("/discount-rules", response_model=list[FeeDiscountRuleResponse])
def list_discount_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(FeeDiscountRule).order_by(FeeDiscountRule.sort_order, FeeDiscountRule.name).all()
    return [FeeDiscountRuleResponse.model_validate(r) for r in rows]


@router.post("/discount-rules", response_model=FeeDiscountRuleResponse)
def create_discount_rule(
    body: FeeDiscountRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = FeeDiscountRule(
        id=new_id("DIS"),
        name=body.name.strip(),
        discount_percent=body.discount_percent,
        criteria_type=body.criteria_type,
        criteria_label=body.criteria_label,
        auto_apply=body.auto_apply,
        is_enabled=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return FeeDiscountRuleResponse.model_validate(row)


@router.patch("/discount-rules/{rule_id}", response_model=FeeDiscountRuleResponse)
def update_discount_rule(
    rule_id: str,
    body: FeeDiscountRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(FeeDiscountRule).filter(FeeDiscountRule.id == rule_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Discount rule not found")
    for field in ("name", "criteria_type", "criteria_label"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(row, field, val.strip() if isinstance(val, str) else val)
    if body.discount_percent is not None:
        row.discount_percent = body.discount_percent
    if body.auto_apply is not None:
        row.auto_apply = body.auto_apply
    if body.is_enabled is not None:
        row.is_enabled = body.is_enabled
    db.commit()
    db.refresh(row)
    return FeeDiscountRuleResponse.model_validate(row)


@router.delete("/discount-rules/{rule_id}")
def delete_discount_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(FeeDiscountRule).filter(FeeDiscountRule.id == rule_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Discount rule not found")
    db.delete(row)
    db.commit()
    return {"message": "Deleted"}


# --- Schedules (unchanged) ---


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
        result.append(
            FeeScheduleResponse(
                id=r.id,
                fee_structure_id=r.fee_structure_id,
                posting_date=r.posting_date,
                due_date=r.due_date,
                program_id=r.program_id,
                academic_year_id=r.academic_year_id,
                academic_term_id=r.academic_term_id,
                student_groups=[
                    {"student_group_id": s.student_group_id, "total_students": s.total_students} for s in sgs
                ],
                total_amount=r.total_amount,
                grand_total=r.grand_total,
                status=r.status,
                docstatus=r.docstatus,
            )
        )
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
        db.add(
            FeeScheduleStudentGroup(
                id=new_id("FSSG"),
                parent_id=sid,
                student_group_id=sg.student_group_id,
                total_students=sg.total_students,
                idx=i,
            )
        )
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
        student_groups=[
            {"student_group_id": s.student_group_id, "total_students": s.total_students} for s in sgs
        ],
        total_amount=sched.total_amount,
        grand_total=sched.grand_total,
        status=sched.status,
        docstatus=sched.docstatus,
    )
