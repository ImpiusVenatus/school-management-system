"""Academic Year and Term API."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AcademicYear, AcademicTerm
from app.schemas.academic import (
    AcademicYearCreate,
    AcademicYearUpdate,
    AcademicYearResponse,
    AcademicTermCreate,
    AcademicTermUpdate,
    AcademicTermResponse,
)
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id

router = APIRouter(prefix="/academic", tags=["academic"])


@router.get("/years", response_model=list[AcademicYearResponse])
def list_academic_years(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(AcademicYear).order_by(AcademicYear.year_start_date.desc()).all()
    return [AcademicYearResponse(id=r.id, academic_year_name=r.academic_year_name, year_start_date=r.year_start_date, year_end_date=r.year_end_date) for r in rows]


@router.post("/years", response_model=AcademicYearResponse)
def create_academic_year(
    body: AcademicYearCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(AcademicYear).filter(AcademicYear.academic_year_name == body.academic_year_name).first():
        raise HTTPException(status_code=400, detail="Academic year name already exists")
    aid = body.academic_year_name.replace(" ", "-")[:30]
    row = AcademicYear(id=aid, academic_year_name=body.academic_year_name, year_start_date=body.year_start_date, year_end_date=body.year_end_date)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/years/{year_id}", response_model=AcademicYearResponse)
def get_academic_year(
    year_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(AcademicYear).filter(AcademicYear.id == year_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Academic year not found")
    return r


@router.get("/terms", response_model=list[AcademicTermResponse])
def list_academic_terms(
    db: Session = Depends(get_db),
    academic_year_id: str | None = None,
    current_user: User = Depends(get_current_user),
):
    q = db.query(AcademicTerm)
    if academic_year_id:
        q = q.filter(AcademicTerm.academic_year_id == academic_year_id)
    rows = q.order_by(AcademicTerm.term_start_date.desc()).all()
    return [AcademicTermResponse(id=r.id, academic_year_id=r.academic_year_id, term_name=r.term_name, term_start_date=r.term_start_date, term_end_date=r.term_end_date, title=r.title) for r in rows]


@router.post("/terms", response_model=AcademicTermResponse)
def create_academic_term(
    body: AcademicTermCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title = f"{body.term_name} ({body.academic_year_id})"
    if db.query(AcademicTerm).filter(AcademicTerm.title == title).first():
        raise HTTPException(status_code=400, detail="Term with same title exists")
    tid = new_id("T")
    row = AcademicTerm(id=tid, academic_year_id=body.academic_year_id, term_name=body.term_name, term_start_date=body.term_start_date, term_end_date=body.term_end_date, title=title)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
