"""Academic departments API (curriculum grouping for subjects)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database import get_db
from app.models import AcademicDepartment, K12Subject, User
from app.schemas.academic_department import (
    AcademicDepartmentCreate,
    AcademicDepartmentUpdate,
    AcademicDepartmentResponse,
)
from app.services.id_gen import new_id

router = APIRouter(tags=["academic-departments"])


def _subject_counts_by_department(db: Session) -> dict[str, int]:
    rows = (
        db.query(K12Subject.department_id, func.count())
        .filter(K12Subject.department_id.isnot(None))
        .group_by(K12Subject.department_id)
        .all()
    )
    return {dept_id: int(cnt) for dept_id, cnt in rows}


def _dept_response(
    row: AcademicDepartment,
    subject_counts: dict[str, int] | None = None,
    *,
    db: Session | None = None,
) -> AcademicDepartmentResponse:
    if subject_counts is not None:
        count = subject_counts.get(row.id, 0)
    elif db is not None:
        count = db.query(K12Subject).filter(K12Subject.department_id == row.id).count()
    else:
        count = 0
    return AcademicDepartmentResponse(
        id=row.id,
        name=row.name,
        code=row.code,
        is_active=row.is_active if row.is_active is not None else True,
        subject_count=count,
    )


@router.get("/departments", response_model=list[AcademicDepartmentResponse])
def list_departments(
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(AcademicDepartment)
    if active_only:
        q = q.filter(AcademicDepartment.is_active == True)
    rows = q.order_by(AcademicDepartment.name).all()
    counts = _subject_counts_by_department(db)
    return [_dept_response(r, counts) for r in rows]


@router.post("/departments", response_model=AcademicDepartmentResponse)
def create_department(
    body: AcademicDepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = body.name.strip()
    if db.query(AcademicDepartment).filter(func.lower(AcademicDepartment.name) == name.lower()).first():
        raise HTTPException(status_code=400, detail="Department name already exists")
    row = AcademicDepartment(
        id=new_id("DEPT"),
        name=name,
        code=body.code.strip() if body.code else None,
        is_active=body.is_active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _dept_response(row, db=db)


@router.patch("/departments/{department_id}", response_model=AcademicDepartmentResponse)
def update_department(
    department_id: str,
    body: AcademicDepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(AcademicDepartment).filter(AcademicDepartment.id == department_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Department not found")
    if body.name is not None:
        name = body.name.strip()
        existing = (
            db.query(AcademicDepartment)
            .filter(func.lower(AcademicDepartment.name) == name.lower(), AcademicDepartment.id != department_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Department name already exists")
        row.name = name
    if body.code is not None:
        row.code = body.code.strip() or None
    if body.is_active is not None:
        row.is_active = body.is_active
    db.commit()
    db.refresh(row)
    return _dept_response(row, db=db)


@router.delete("/departments/{department_id}", status_code=204)
def delete_department(
    department_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(AcademicDepartment).filter(AcademicDepartment.id == department_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Department not found")
    count = db.query(K12Subject).filter(K12Subject.department_id == department_id).count()
    if count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {count} subject(s) still use this department. Reassign or remove them first.",
        )
    db.delete(row)
    db.commit()
