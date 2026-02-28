"""Instructors API + assignments, remove/reassign, termination."""
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Instructor, InstructorAssignment, StudentGroup
from app.core.auth import get_current_user
from app.models import User
from pydantic import BaseModel

router = APIRouter(prefix="/instructors", tags=["instructors"])


class InstructorBase(BaseModel):
    instructor_name: str
    employee_id: str | None = None
    department: str | None = None
    gender: str | None = None
    status: str = "Active"


class InstructorCreate(InstructorBase):
    pass


class InstructorUpdate(BaseModel):
    instructor_name: str | None = None
    employee_id: str | None = None
    department: str | None = None
    gender: str | None = None
    status: str | None = None
    termination_date: date | None = None
    termination_reason: str | None = None


class InstructorResponse(InstructorBase):
    id: str
    termination_date: date | None = None
    termination_reason: str | None = None

    class Config:
        from_attributes = True


class AssignmentCreate(BaseModel):
    instructor_id: str
    student_group_id: str
    academic_year_id: str
    role: str = "teacher"


class AssignmentRemove(BaseModel):
    removal_reason: str
    replaced_by_instructor_id: str | None = None


@router.get("", response_model=list[InstructorResponse])
def list_instructors(
    db: Session = Depends(get_db),
    search: str | None = None,
    department: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Instructor)
    if search:
        q = q.filter(Instructor.instructor_name.ilike(f"%{search}%"))
    if department:
        q = q.filter(Instructor.department == department)
    rows = q.offset(skip).limit(limit).all()
    return [
        InstructorResponse(
            id=r.id,
            instructor_name=r.instructor_name,
            employee_id=r.employee_id,
            department=r.department,
            gender=r.gender,
            status=r.status,
            termination_date=r.termination_date,
            termination_reason=r.termination_reason,
        )
        for r in rows
    ]


@router.post("", response_model=InstructorResponse)
def create_instructor(
    body: InstructorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.id_gen import new_id
    iid = new_id("INS")
    row = Instructor(id=iid, instructor_name=body.instructor_name, employee_id=body.employee_id, department=body.department, gender=body.gender, status=body.status)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{instructor_id}", response_model=InstructorResponse)
def get_instructor(
    instructor_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Instructor not found")
    return InstructorResponse(
        id=r.id,
        instructor_name=r.instructor_name,
        employee_id=r.employee_id,
        department=r.department,
        gender=r.gender,
        status=r.status,
        termination_date=r.termination_date,
        termination_reason=r.termination_reason,
    )


@router.patch("/{instructor_id}", response_model=InstructorResponse)
def update_instructor(
    instructor_id: str,
    body: InstructorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Instructor not found")
    if current_user.role != "admin" and not getattr(current_user, "is_superuser", False):
        if body.status == "Left" or body.termination_date or body.termination_reason:
            raise HTTPException(status_code=403, detail="Only admin can terminate instructor")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return InstructorResponse(
        id=r.id,
        instructor_name=r.instructor_name,
        employee_id=r.employee_id,
        department=r.department,
        gender=r.gender,
        status=r.status,
        termination_date=r.termination_date,
        termination_reason=r.termination_reason,
    )


@router.get("/{instructor_id}/assignments")
def list_instructor_assignments(
    instructor_id: str,
    academic_year_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(InstructorAssignment).filter(InstructorAssignment.instructor_id == instructor_id)
    if academic_year_id:
        q = q.filter(InstructorAssignment.academic_year_id == academic_year_id)
    rows = q.order_by(InstructorAssignment.assigned_at.desc()).all()
    result = []
    for r in rows:
        group_name = None
        if r.student_group_id:
            g = db.query(StudentGroup).filter(StudentGroup.id == r.student_group_id).first()
            group_name = g.student_group_name if g else None
        result.append({
            "id": r.id,
            "instructor_id": r.instructor_id,
            "student_group_id": r.student_group_id,
            "student_group_name": group_name,
            "academic_year_id": r.academic_year_id,
            "role": r.role,
            "assigned_at": r.assigned_at.isoformat() if r.assigned_at else None,
            "removed_at": r.removed_at.isoformat() if r.removed_at else None,
            "removal_reason": r.removal_reason,
            "replaced_by_instructor_id": r.replaced_by_instructor_id,
        })
    return result


@router.post("/assignments")
def create_assignment(
    body: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.id_gen import new_id
    if db.query(Instructor).filter(Instructor.id == body.instructor_id).first() is None:
        raise HTTPException(status_code=404, detail="Instructor not found")
    if db.query(StudentGroup).filter(StudentGroup.id == body.student_group_id).first() is None:
        raise HTTPException(status_code=404, detail="Student group not found")
    aid = new_id("IAS")
    a = InstructorAssignment(
        id=aid,
        instructor_id=body.instructor_id,
        student_group_id=body.student_group_id,
        academic_year_id=body.academic_year_id,
        role=body.role,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return {"id": a.id, "instructor_id": a.instructor_id, "student_group_id": a.student_group_id, "academic_year_id": a.academic_year_id, "role": a.role}


@router.post("/assignments/{assignment_id}/remove")
def remove_assignment(
    assignment_id: str,
    body: AssignmentRemove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    from app.services.id_gen import new_id
    a = db.query(InstructorAssignment).filter(InstructorAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    a.removed_at = datetime.now(timezone.utc)
    a.removal_reason = body.removal_reason
    a.replaced_by_instructor_id = body.replaced_by_instructor_id
    if body.replaced_by_instructor_id:
        repl = InstructorAssignment(
            id=new_id("IAS"),
            instructor_id=body.replaced_by_instructor_id,
            student_group_id=a.student_group_id,
            academic_year_id=a.academic_year_id,
            role=a.role,
        )
        db.add(repl)
    db.commit()
    return {"message": "Assignment removed", "replaced_by_assignment_created": bool(body.replaced_by_instructor_id)}
