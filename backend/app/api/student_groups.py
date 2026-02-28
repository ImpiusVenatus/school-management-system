"""Student Groups API + get students in group (like frappe get_student_group_students)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import StudentGroup, StudentGroupStudent, StudentGroupInstructor
from app.schemas.student_group import (
    StudentGroupCreate,
    StudentGroupUpdate,
    StudentGroupResponse,
    StudentGroupStudentItem,
    StudentGroupInstructorItem,
)
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id

router = APIRouter(prefix="/student-groups", tags=["student-groups"])


def _group_to_response(g: StudentGroup, db: Session) -> StudentGroupResponse:
    students = [
        StudentGroupStudentItem(student_id=s.student_id, student_name=s.student_name, group_roll_number=s.group_roll_number, active=s.active)
        for s in db.query(StudentGroupStudent).filter(StudentGroupStudent.parent_id == g.id).order_by(StudentGroupStudent.idx, StudentGroupStudent.group_roll_number).all()
    ]
    instructors = [
        StudentGroupInstructorItem(instructor_id=i.instructor_id)
        for i in db.query(StudentGroupInstructor).filter(StudentGroupInstructor.parent_id == g.id).order_by(StudentGroupInstructor.idx).all()
    ]
    return StudentGroupResponse(
        id=g.id,
        student_group_name=g.student_group_name,
        academic_year_id=g.academic_year_id,
        academic_term_id=g.academic_term_id,
        group_based_on=g.group_based_on,
        program_id=g.program_id,
        batch_id=g.batch_id,
        course_id=g.course_id,
        student_category_id=g.student_category_id,
        max_strength=g.max_strength,
        disabled=g.disabled,
        students=students,
        instructors=instructors,
    )


@router.get("", response_model=list[StudentGroupResponse])
def list_student_groups(
    db: Session = Depends(get_db),
    academic_year_id: str | None = None,
    program_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    q = db.query(StudentGroup)
    if academic_year_id:
        q = q.filter(StudentGroup.academic_year_id == academic_year_id)
    if program_id:
        q = q.filter(StudentGroup.program_id == program_id)
    rows = q.offset(skip).limit(limit).all()
    return [_group_to_response(r, db) for r in rows]


@router.post("", response_model=StudentGroupResponse)
def create_student_group(
    body: StudentGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(StudentGroup).filter(StudentGroup.student_group_name == body.student_group_name).first():
        raise HTTPException(status_code=400, detail="Student group name already exists")
    gid = body.student_group_name.replace(" ", "-")[:50]
    group = StudentGroup(
        id=gid,
        student_group_name=body.student_group_name,
        academic_year_id=body.academic_year_id,
        academic_term_id=body.academic_term_id,
        group_based_on=body.group_based_on,
        program_id=body.program_id,
        batch_id=body.batch_id,
        course_id=body.course_id,
        student_category_id=body.student_category_id,
        max_strength=body.max_strength,
        disabled=body.disabled,
    )
    db.add(group)
    for i, s in enumerate(body.students):
        db.add(StudentGroupStudent(id=new_id("SGS"), parent_id=gid, student_id=s.student_id, student_name=s.student_name, group_roll_number=s.group_roll_number, active=s.active, idx=i))
    for i, inst in enumerate(body.instructors):
        db.add(StudentGroupInstructor(id=new_id("SGI"), parent_id=gid, instructor_id=inst.instructor_id, idx=i))
    db.commit()
    db.refresh(group)
    return _group_to_response(group, db)


@router.get("/{group_id}", response_model=StudentGroupResponse)
def get_student_group(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    g = db.query(StudentGroup).filter(StudentGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Student group not found")
    return _group_to_response(g, db)


@router.get("/{group_id}/students", response_model=list[dict])
def get_student_group_students(
    group_id: str,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Like frappe api get_student_group_students: list of student, student_name in group."""
    q = db.query(StudentGroupStudent).filter(StudentGroupStudent.parent_id == group_id)
    if not include_inactive:
        q = q.filter(StudentGroupStudent.active == True)
    rows = q.order_by(StudentGroupStudent.group_roll_number, StudentGroupStudent.idx).all()
    return [{"student": r.student_id, "student_name": r.student_name} for r in rows]
