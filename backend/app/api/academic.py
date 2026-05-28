"""Academic Year and Term API."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Union
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    AcademicYear,
    AcademicTerm,
    EducationSettings,
    StudentGroup,
    K12Class,
    K12Section,
    K12StudentEnrollment,
    StudentGroupStudent,
)
from app.schemas.academic import (
    AcademicYearUpdate,
    AcademicYearResponse,
    AcademicYearSummaryResponse,
    AcademicYearLiteResponse,
    AcademicYearDetailResponse,
    AcademicYearCreateBody,
    AcademicYearSuggestResponse,
    AcademicTermCreate,
    AcademicTermUpdate,
    AcademicTermResponse,
)
from app.core.auth import require_permission
from app.models import User
from app.services.id_gen import new_id
from app.services.academic_year import (
    year_range_for_start_month,
    suggest_ay_name,
    parse_label_end_year,
    cycle_label_for_month,
)

router = APIRouter(prefix="/academic", tags=["academic"])


def _get_settings(db: Session) -> EducationSettings:
    row = db.query(EducationSettings).first()
    if not row:
        row = EducationSettings(id="Education Settings")
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _year_summary(db: Session, r: AcademicYear, active_id: str | None, school_type: str) -> AcademicYearSummaryResponse:
    class_count = section_count = student_count = 0
    if school_type == "k12":
        class_count = db.query(K12Class).filter(K12Class.academic_year_id == r.id).count()
        section_count = (
            db.query(K12Section)
            .join(K12Class, K12Section.class_id == K12Class.id)
            .filter(K12Class.academic_year_id == r.id)
            .count()
        )
        student_count = db.query(K12StudentEnrollment).filter(K12StudentEnrollment.academic_year_id == r.id).count()
    else:
        groups = db.query(StudentGroup).filter(StudentGroup.academic_year_id == r.id).all()
        class_count = len({g.program_id or g.student_group_name for g in groups})
        section_count = len(groups)
        for g in groups:
            student_count += (
                db.query(StudentGroupStudent)
                .filter(StudentGroupStudent.parent_id == g.id, StudentGroupStudent.active == True)
                .count()
            )
    return AcademicYearSummaryResponse(
        id=r.id,
        academic_year_name=r.academic_year_name,
        year_start_date=r.year_start_date,
        year_end_date=r.year_end_date,
        status=r.status or "closed",
        is_active=r.id == active_id,
        class_count=class_count,
        section_count=section_count,
        student_count=student_count,
    )


@router.get("/years", response_model=list[Union[AcademicYearSummaryResponse, AcademicYearLiteResponse]])
def list_academic_years(
    include_counts: bool = Query(True, description="Set false for dropdowns (skips class/section/student counts)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("academic_years.read")),
):
    settings = _get_settings(db)
    school_type = settings.school_type or "program"
    active_id = settings.current_academic_year_id
    rows = db.query(AcademicYear).order_by(AcademicYear.year_start_date.desc()).all()
    if include_counts:
        return [_year_summary(db, r, active_id, school_type) for r in rows]
    return [
        AcademicYearLiteResponse(
            id=r.id,
            academic_year_name=r.academic_year_name,
            year_start_date=r.year_start_date,
            year_end_date=r.year_end_date,
            status=r.status or "closed",
            is_active=r.id == active_id,
        )
        for r in rows
    ]


@router.get("/years/suggest", response_model=AcademicYearSuggestResponse)
def suggest_academic_year(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("academic_years.read")),
):
    settings = _get_settings(db)
    start_month = settings.academic_year_start_month or 1
    name = suggest_ay_name(start_month)
    end_y = parse_label_end_year(name)
    start_d, end_d = year_range_for_start_month(start_month, end_y)
    return AcademicYearSuggestResponse(
        academic_year_name=name,
        year_start_date=start_d,
        year_end_date=end_d,
        start_month=start_month,
        cycle_label=cycle_label_for_month(start_month),
    )


@router.post("/years", response_model=AcademicYearResponse)
def create_academic_year(
    body: AcademicYearCreateBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("academic_years.manage")),
):
    settings = _get_settings(db)
    start_month = settings.academic_year_start_month or 1
    name = body.academic_year_name or suggest_ay_name(start_month)
    if db.query(AcademicYear).filter(AcademicYear.academic_year_name == name).first():
        raise HTTPException(status_code=400, detail="Academic year name already exists")
    if body.year_start_date and body.year_end_date:
        start_d, end_d = body.year_start_date, body.year_end_date
    else:
        end_y = parse_label_end_year(name)
        start_d, end_d = year_range_for_start_month(start_month, end_y)
    aid = name.replace(" ", "-").replace("–", "-")[:30]
    if db.query(AcademicYear).filter(AcademicYear.id == aid).first():
        aid = new_id("AY")
    status = "closed"
    if body.set_active or not settings.current_academic_year_id:
        status = "active"
        for y in db.query(AcademicYear).filter(AcademicYear.status == "active").all():
            y.status = "closed"
        settings.current_academic_year_id = aid
    row = AcademicYear(
        id=aid,
        academic_year_name=name,
        year_start_date=start_d,
        year_end_date=end_d,
        status=status,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    db.refresh(settings)
    return AcademicYearResponse(
        id=row.id,
        academic_year_name=row.academic_year_name,
        year_start_date=row.year_start_date,
        year_end_date=row.year_end_date,
        status=row.status,
    )


@router.post("/years/{year_id}/activate", response_model=AcademicYearResponse)
def activate_academic_year(
    year_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("academic_years.manage")),
):
    row = db.query(AcademicYear).filter(AcademicYear.id == year_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Academic year not found")
    settings = _get_settings(db)
    for y in db.query(AcademicYear).all():
        if y.id == year_id:
            y.status = "active"
        elif y.status == "active":
            y.status = "closed"
    settings.current_academic_year_id = year_id
    db.commit()
    db.refresh(row)
    return AcademicYearResponse(
        id=row.id,
        academic_year_name=row.academic_year_name,
        year_start_date=row.year_start_date,
        year_end_date=row.year_end_date,
        status=row.status,
    )


@router.patch("/years/{year_id}", response_model=AcademicYearResponse)
def update_academic_year(
    year_id: str,
    body: AcademicYearUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("academic_years.manage")),
):
    row = db.query(AcademicYear).filter(AcademicYear.id == year_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Academic year not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return AcademicYearResponse(
        id=row.id,
        academic_year_name=row.academic_year_name,
        year_start_date=row.year_start_date,
        year_end_date=row.year_end_date,
        status=row.status or "closed",
    )


@router.get("/years/{year_id}", response_model=AcademicYearResponse)
def get_academic_year(
    year_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("academic_years.read")),
):
    r = db.query(AcademicYear).filter(AcademicYear.id == year_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Academic year not found")
    return r


def _year_progress(start: date, end: date, today: date | None = None) -> tuple[int, int, int, int]:
    today = today or date.today()
    total = (end - start).days + 1
    if total <= 0:
        return 0, 0, 0, 0
    if today < start:
        return total, 0, total, 0
    if today > end:
        return total, total, 0, 100
    elapsed = (today - start).days + 1
    remaining = max(0, (end - today).days)
    pct = min(100, max(0, round(100 * elapsed / total)))
    return total, elapsed, remaining, pct


@router.get("/years/{year_id}/detail", response_model=AcademicYearDetailResponse)
def get_academic_year_detail(
    year_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("academic_years.read")),
):
    r = db.query(AcademicYear).filter(AcademicYear.id == year_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Academic year not found")
    settings = _get_settings(db)
    school_type = settings.school_type or "program"
    summary = _year_summary(db, r, settings.current_academic_year_id, school_type)
    total, elapsed, remaining, pct = _year_progress(r.year_start_date, r.year_end_date)
    term_count = db.query(AcademicTerm).filter(AcademicTerm.academic_year_id == year_id).count()
    return AcademicYearDetailResponse(
        **summary.model_dump(),
        days_total=total,
        days_elapsed=elapsed,
        days_remaining=remaining,
        progress_percent=pct,
        term_count=term_count,
    )


@router.get("/terms", response_model=list[AcademicTermResponse])
def list_academic_terms(
    db: Session = Depends(get_db),
    academic_year_id: str | None = None,
    current_user: User = Depends(require_permission("academic_years.read")),
):
    q = db.query(AcademicTerm)
    if academic_year_id:
        q = q.filter(AcademicTerm.academic_year_id == academic_year_id)
    rows = q.order_by(AcademicTerm.term_start_date.asc()).all()
    return [
        AcademicTermResponse(
            id=r.id,
            academic_year_id=r.academic_year_id,
            term_name=r.term_name,
            term_start_date=r.term_start_date,
            term_end_date=r.term_end_date,
            title=r.title,
        )
        for r in rows
    ]


@router.post("/terms", response_model=AcademicTermResponse)
def create_academic_term(
    body: AcademicTermCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("academic_years.manage")),
):
    title = f"{body.term_name} ({body.academic_year_id})"
    if db.query(AcademicTerm).filter(AcademicTerm.title == title).first():
        raise HTTPException(status_code=400, detail="Term with same title exists")
    tid = new_id("T")
    row = AcademicTerm(
        id=tid,
        academic_year_id=body.academic_year_id,
        term_name=body.term_name,
        term_start_date=body.term_start_date,
        term_end_date=body.term_end_date,
        title=title,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return AcademicTermResponse(
        id=row.id,
        academic_year_id=row.academic_year_id,
        term_name=row.term_name,
        term_start_date=row.term_start_date,
        term_end_date=row.term_end_date,
        title=row.title,
    )


@router.patch("/terms/{term_id}", response_model=AcademicTermResponse)
def update_academic_term(
    term_id: str,
    body: AcademicTermUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("academic_years.manage")),
):
    row = db.query(AcademicTerm).filter(AcademicTerm.id == term_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Term not found")
    data = body.model_dump(exclude_unset=True)
    if "term_name" in data:
        row.term_name = data["term_name"]
    if "term_start_date" in data:
        row.term_start_date = data["term_start_date"]
    if "term_end_date" in data:
        row.term_end_date = data["term_end_date"]
    if "academic_year_id" in data:
        row.academic_year_id = data["academic_year_id"]
    row.title = f"{row.term_name} ({row.academic_year_id})"
    db.commit()
    db.refresh(row)
    return AcademicTermResponse(
        id=row.id,
        academic_year_id=row.academic_year_id,
        term_name=row.term_name,
        term_start_date=row.term_start_date,
        term_end_date=row.term_end_date,
        title=row.title,
    )


@router.delete("/terms/{term_id}", status_code=204)
def delete_academic_term(
    term_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("academic_years.manage")),
):
    row = db.query(AcademicTerm).filter(AcademicTerm.id == term_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Term not found")
    db.delete(row)
    db.commit()
