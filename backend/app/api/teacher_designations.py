"""Teacher designations API (titles/roles for instructors)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import require_permission
from app.database import get_db
from app.models import Instructor, TeacherDesignation, User
from app.schemas.teacher_designation import (
    TeacherDesignationCreate,
    TeacherDesignationResponse,
    TeacherDesignationUpdate,
)
from app.services.id_gen import new_id

router = APIRouter(prefix="/instructors", tags=["instructors"])


def _teacher_counts_by_designation(db: Session) -> dict[str, int]:
    rows = (
        db.query(Instructor.designation_id, func.count())
        .filter(Instructor.designation_id.isnot(None))
        .group_by(Instructor.designation_id)
        .all()
    )
    return {desig_id: int(cnt) for desig_id, cnt in rows}


def _designation_response(
    row: TeacherDesignation,
    teacher_counts: dict[str, int] | None = None,
    *,
    db: Session | None = None,
) -> TeacherDesignationResponse:
    if teacher_counts is not None:
        count = teacher_counts.get(row.id, 0)
    elif db is not None:
        count = db.query(Instructor).filter(Instructor.designation_id == row.id).count()
    else:
        count = 0
    return TeacherDesignationResponse(
        id=row.id,
        name=row.name,
        code=row.code,
        is_active=row.is_active if row.is_active is not None else True,
        teacher_count=count,
    )


@router.get("/designations", response_model=list[TeacherDesignationResponse])
def list_designations(
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("instructors.read")),
):
    q = db.query(TeacherDesignation)
    if active_only:
        q = q.filter(TeacherDesignation.is_active == True)
    rows = q.order_by(TeacherDesignation.name).all()
    counts = _teacher_counts_by_designation(db)
    return [_designation_response(r, counts) for r in rows]


@router.post("/designations", response_model=TeacherDesignationResponse)
def create_designation(
    body: TeacherDesignationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("instructors.manage")),
):
    name = body.name.strip()
    if db.query(TeacherDesignation).filter(func.lower(TeacherDesignation.name) == name.lower()).first():
        raise HTTPException(status_code=400, detail="Designation name already exists")
    row = TeacherDesignation(
        id=new_id("TDGN"),
        name=name,
        code=body.code.strip() if body.code else None,
        is_active=body.is_active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _designation_response(row, db=db)


@router.patch("/designations/{designation_id}", response_model=TeacherDesignationResponse)
def update_designation(
    designation_id: str,
    body: TeacherDesignationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("instructors.manage")),
):
    row = db.query(TeacherDesignation).filter(TeacherDesignation.id == designation_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Designation not found")
    if body.name is not None:
        name = body.name.strip()
        existing = (
            db.query(TeacherDesignation)
            .filter(func.lower(TeacherDesignation.name) == name.lower(), TeacherDesignation.id != designation_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Designation name already exists")
        row.name = name
        db.query(Instructor).filter(Instructor.designation_id == designation_id).update(
            {Instructor.designation: name}, synchronize_session=False
        )
    if body.code is not None:
        row.code = body.code.strip() or None
    if body.is_active is not None:
        row.is_active = body.is_active
    db.commit()
    db.refresh(row)
    return _designation_response(row, db=db)


@router.delete("/designations/{designation_id}", status_code=204)
def delete_designation(
    designation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("instructors.manage")),
):
    row = db.query(TeacherDesignation).filter(TeacherDesignation.id == designation_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Designation not found")
    count = db.query(Instructor).filter(Instructor.designation_id == designation_id).count()
    if count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {count} teacher(s) still use this designation. Reassign them first.",
        )
    db.delete(row)
    db.commit()
