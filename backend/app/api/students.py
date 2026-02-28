"""Students API."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Student, StudentGuardian, ProgramEnrollment
from app.schemas.student import StudentCreate, StudentUpdate, StudentResponse, StudentGuardianItem
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id, student_name as make_student_name

router = APIRouter(prefix="/students", tags=["students"])


def _student_to_response(s: Student, db: Session) -> StudentResponse:
    guardians = [
        StudentGuardianItem(
            guardian_id=g.guardian_id,
            guardian_name=g.guardian_name,
            relation=g.relation,
        )
        for g in db.query(StudentGuardian).filter(StudentGuardian.parent_id == s.id).order_by(StudentGuardian.idx).all()
    ]
    return StudentResponse(
        id=s.id,
        first_name=s.first_name,
        middle_name=s.middle_name,
        last_name=s.last_name,
        student_name=s.student_name,
        student_email_id=s.student_email_id,
        student_mobile_number=s.student_mobile_number,
        date_of_birth=s.date_of_birth,
        blood_group=s.blood_group,
        gender=s.gender,
        nationality=s.nationality,
        joining_date=s.joining_date,
        address_line_1=s.address_line_1,
        address_line_2=s.address_line_2,
        city=s.city,
        state=s.state,
        pincode=s.pincode,
        country=s.country,
        enabled=s.enabled,
        guardians=guardians,
    )


@router.get("", response_model=list[StudentResponse])
def list_students(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: str | None = None,
    grade_level: str | None = None,
    section_name: str | None = None,
    current_user: User = Depends(get_current_user),
):
    q = db.query(Student)
    if search:
        q = q.filter(
            Student.student_name.ilike(f"%{search}%")
            | Student.student_email_id.ilike(f"%{search}%")
            | Student.first_name.ilike(f"%{search}%")
            | Student.last_name.ilike(f"%{search}%")
        )
    if grade_level or section_name:
        subq = db.query(ProgramEnrollment.student_id)
        if grade_level:
            subq = subq.filter(ProgramEnrollment.grade_level == grade_level)
        if section_name:
            subq = subq.filter(ProgramEnrollment.section_name == section_name)
        subq = subq.distinct()
        q = q.filter(Student.id.in_(subq))
    rows = q.offset(skip).limit(limit).all()
    return [_student_to_response(r, db) for r in rows]


@router.post("", response_model=StudentResponse)
def create_student(
    body: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(Student).filter(Student.student_email_id == body.student_email_id).first():
        raise HTTPException(status_code=400, detail="Student with this email already exists")
    sid = new_id("STU")
    name = make_student_name(body.first_name, body.middle_name, body.last_name)
    student = Student(
        id=sid,
        first_name=body.first_name,
        middle_name=body.middle_name,
        last_name=body.last_name,
        student_name=name,
        student_email_id=body.student_email_id,
        student_mobile_number=body.student_mobile_number,
        date_of_birth=body.date_of_birth,
        blood_group=body.blood_group,
        gender=body.gender,
        nationality=body.nationality,
        joining_date=body.joining_date,
        address_line_1=body.address_line_1,
        address_line_2=body.address_line_2,
        city=body.city,
        state=body.state,
        pincode=body.pincode,
        country=body.country,
        enabled=body.enabled,
    )
    db.add(student)
    for i, g in enumerate(body.guardians):
        sg = StudentGuardian(
            id=new_id("SG"),
            parent_id=sid,
            guardian_id=g.guardian_id,
            guardian_name=g.guardian_name,
            relation=g.relation,
            idx=i,
        )
        db.add(sg)
    db.commit()
    db.refresh(student)
    return _student_to_response(student, db)


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    return _student_to_response(s, db)


@router.patch("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: str,
    body: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    data = body.model_dump(exclude_unset=True)
    if "first_name" in data or "middle_name" in data or "last_name" in data:
        data["student_name"] = make_student_name(
            data.get("first_name", s.first_name),
            data.get("middle_name", s.middle_name),
            data.get("last_name", s.last_name),
        )
    for k, v in data.items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return _student_to_response(s, db)


@router.delete("/{student_id}")
def delete_student(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    db.delete(s)
    db.commit()
    return {"message": "Deleted"}
