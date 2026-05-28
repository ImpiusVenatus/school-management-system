"""Instructors API + assignments, remove/reassign, termination."""

from datetime import date, datetime



from fastapi import APIRouter, Depends, HTTPException, Query

from pydantic import BaseModel

from sqlalchemy import func
from sqlalchemy.orm import Session



from app.core.auth import require_permission

from app.database import get_db

from app.models import (

    AcademicDepartment,

    Instructor,

    InstructorAssignment,

    StudentGroup,

    TeacherDesignation,

    User,

)



router = APIRouter(prefix="/instructors", tags=["instructors"])





class DepartmentOption(BaseModel):

    id: str

    name: str





class DesignationOption(BaseModel):

    id: str

    name: str





class InstructorBase(BaseModel):

    instructor_name: str

    employee_id: str | None = None

    department_id: str | None = None

    department: str | None = None

    designation_id: str | None = None

    designation: str | None = None

    gender: str | None = None

    status: str = "Active"





class InstructorCreate(BaseModel):

    instructor_name: str

    employee_id: str | None = None

    department_id: str | None = None

    designation_id: str | None = None

    gender: str | None = None

    status: str = "Active"





class InstructorUpdate(BaseModel):

    instructor_name: str | None = None

    employee_id: str | None = None

    department_id: str | None = None

    designation_id: str | None = None

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





def _resolve_department(db: Session, department_id: str | None) -> tuple[str | None, str | None]:

    if not department_id:

        return None, None

    dept = db.query(AcademicDepartment).filter(AcademicDepartment.id == department_id).first()

    if not dept:

        raise HTTPException(status_code=400, detail="Department not found")

    return dept.id, dept.name





def _resolve_designation(db: Session, designation_id: str | None) -> tuple[str | None, str | None]:

    if not designation_id:

        return None, None

    desig = db.query(TeacherDesignation).filter(TeacherDesignation.id == designation_id).first()

    if not desig:

        raise HTTPException(status_code=400, detail="Designation not found")

    return desig.id, desig.name


def _normalize_employee_id(employee_id: str | None) -> str | None:
    if employee_id is None:
        return None
    value = employee_id.strip()
    return value if value else None


def _ensure_unique_employee_id(
    db: Session,
    employee_id: str | None,
    *,
    exclude_instructor_id: str | None = None,
) -> str | None:
    normalized = _normalize_employee_id(employee_id)
    if not normalized:
        return None
    q = db.query(Instructor.id).filter(
        func.lower(func.trim(Instructor.employee_id)) == normalized.lower()
    )
    if exclude_instructor_id:
        q = q.filter(Instructor.id != exclude_instructor_id)
    if q.first():
        raise HTTPException(status_code=400, detail="Employee ID is already assigned to another teacher")
    return normalized


def _instructor_response(row: Instructor) -> InstructorResponse:

    dept_name = row.department

    if row.academic_department is not None:

        dept_name = row.academic_department.name

    elif row.department_id and not dept_name:

        dept_name = row.department



    desig_name = row.designation

    if row.teacher_designation is not None:

        desig_name = row.teacher_designation.name

    elif row.designation_id and not desig_name:

        desig_name = row.designation



    return InstructorResponse(

        id=row.id,

        instructor_name=row.instructor_name,

        employee_id=row.employee_id,

        department_id=row.department_id,

        department=dept_name,

        designation_id=row.designation_id,

        designation=desig_name,

        gender=row.gender,

        status=row.status,

        termination_date=row.termination_date,

        termination_reason=row.termination_reason,

    )





@router.get("/departments", response_model=list[DepartmentOption])

def list_instructor_departments(

    active_only: bool = Query(True),

    db: Session = Depends(get_db),

    current_user: User = Depends(require_permission("instructors.read")),

):

    q = db.query(AcademicDepartment)

    if active_only:

        q = q.filter(AcademicDepartment.is_active == True)

    rows = q.order_by(AcademicDepartment.name).all()

    return [DepartmentOption(id=r.id, name=r.name) for r in rows]





@router.get("/designations/options", response_model=list[DesignationOption])

def list_instructor_designation_options(

    active_only: bool = Query(True),

    db: Session = Depends(get_db),

    current_user: User = Depends(require_permission("instructors.read")),

):

    q = db.query(TeacherDesignation)

    if active_only:

        q = q.filter(TeacherDesignation.is_active == True)

    rows = q.order_by(TeacherDesignation.name).all()

    return [DesignationOption(id=r.id, name=r.name) for r in rows]





@router.get("", response_model=list[InstructorResponse])

def list_instructors(

    db: Session = Depends(get_db),

    search: str | None = None,

    department: str | None = None,

    department_id: str | None = None,

    designation_id: str | None = None,

    status: str | None = None,

    skip: int = Query(0, ge=0),

    limit: int = Query(100, ge=1, le=500),

    current_user: User = Depends(require_permission("instructors.read")),

):

    q = db.query(Instructor)

    if search:

        q = q.filter(Instructor.instructor_name.ilike(f"%{search}%"))

    if department_id:

        q = q.filter(Instructor.department_id == department_id)

    elif department:

        q = q.filter(Instructor.department.ilike(f"%{department}%"))

    if designation_id:

        q = q.filter(Instructor.designation_id == designation_id)

    if status:

        q = q.filter(Instructor.status == status)

    rows = q.offset(skip).limit(limit).all()

    return [_instructor_response(r) for r in rows]





@router.post("", response_model=InstructorResponse)

def create_instructor(

    body: InstructorCreate,

    db: Session = Depends(get_db),

    current_user: User = Depends(require_permission("instructors.manage")),

):

    from app.services.id_gen import new_id



    dept_id, dept_name = _resolve_department(db, body.department_id)

    desig_id, desig_name = _resolve_designation(db, body.designation_id)

    employee_id = _ensure_unique_employee_id(db, body.employee_id)

    iid = new_id("INS")

    row = Instructor(

        id=iid,

        instructor_name=body.instructor_name,

        employee_id=employee_id,

        department_id=dept_id,

        department=dept_name,

        designation_id=desig_id,

        designation=desig_name,

        gender=body.gender,

        status=body.status,

    )

    db.add(row)

    db.commit()

    db.refresh(row)

    return _instructor_response(row)





@router.get("/{instructor_id}", response_model=InstructorResponse)

def get_instructor(

    instructor_id: str,

    db: Session = Depends(get_db),

    current_user: User = Depends(require_permission("instructors.read")),

):

    r = db.query(Instructor).filter(Instructor.id == instructor_id).first()

    if not r:

        raise HTTPException(status_code=404, detail="Instructor not found")

    return _instructor_response(r)





@router.patch("/{instructor_id}", response_model=InstructorResponse)

def update_instructor(

    instructor_id: str,

    body: InstructorUpdate,

    db: Session = Depends(get_db),

    current_user: User = Depends(require_permission("instructors.manage")),

):

    r = db.query(Instructor).filter(Instructor.id == instructor_id).first()

    if not r:

        raise HTTPException(status_code=404, detail="Instructor not found")

    data = body.model_dump(exclude_unset=True)

    if "department_id" in data:

        dept_id = data.pop("department_id")

        if dept_id is None:

            r.department_id = None

            r.department = None

        else:

            resolved_id, resolved_name = _resolve_department(db, dept_id)

            r.department_id = resolved_id

            r.department = resolved_name

    if "designation_id" in data:

        desig_id = data.pop("designation_id")

        if desig_id is None:

            r.designation_id = None

            r.designation = None

        else:

            resolved_id, resolved_name = _resolve_designation(db, desig_id)

            r.designation_id = resolved_id

            r.designation = resolved_name

    if "employee_id" in data:

        data["employee_id"] = _ensure_unique_employee_id(
            db, data["employee_id"], exclude_instructor_id=instructor_id
        )

    for k, v in data.items():

        setattr(r, k, v)

    db.commit()

    db.refresh(r)

    return _instructor_response(r)





@router.get("/{instructor_id}/assignments")

def list_instructor_assignments(

    instructor_id: str,

    academic_year_id: str | None = None,

    db: Session = Depends(get_db),

    current_user: User = Depends(require_permission("instructors.read")),

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

    current_user: User = Depends(require_permission("instructors.manage")),

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

    current_user: User = Depends(require_permission("instructors.manage")),

):

    from datetime import timezone

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

