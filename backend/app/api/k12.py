"""K-12 academic structure API."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from datetime import date
from app.database import get_db
from app.models import K12Class, K12Section, K12Subject, K12ClassSubject, K12StudentEnrollment, AcademicYear, Student
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id

router = APIRouter(prefix="/k12", tags=["k12"])


class InitialSectionCreate(BaseModel):
    name: str
    capacity: int = Field(default=40, ge=1, le=500)


class ClassCreate(BaseModel):
    academic_year_id: str
    name: str
    numeric_level: int | None = None
    initial_section: InitialSectionCreate | None = None


class ClassResponse(BaseModel):
    id: str
    academic_year_id: str
    name: str
    numeric_level: int | None = None

    class Config:
        from_attributes = True


class SectionCreate(BaseModel):
    class_id: str
    name: str
    class_teacher_id: str | None = None
    capacity: int = Field(default=40, ge=1, le=500)


class SectionUpdate(BaseModel):
    name: str | None = None
    capacity: int | None = Field(default=None, ge=1, le=500)
    class_teacher_id: str | None = None


class SectionResponse(BaseModel):
    id: str
    class_id: str
    name: str
    capacity: int

    class Config:
        from_attributes = True


class ClassCreateResponse(BaseModel):
    id: str
    academic_year_id: str
    name: str
    numeric_level: int | None = None
    sections: list[SectionResponse] = []


class SubjectCreate(BaseModel):
    name: str
    code: str
    is_optional: bool = False
    department: str | None = None
    grades_label: str | None = None
    periods_per_week: int | None = Field(default=None, ge=1, le=40)


class SubjectResponse(BaseModel):
    id: str
    name: str
    code: str
    is_optional: bool
    department: str | None = None
    grades_label: str | None = None
    periods_per_week: int | None = None

    class Config:
        from_attributes = True


class EnrollmentCreate(BaseModel):
    student_id: str
    section_id: str
    academic_year_id: str
    roll_no: str | None = None


@router.get("/classes", response_model=list[ClassResponse])
def list_classes(
    academic_year_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(K12Class)
    if academic_year_id:
        q = q.filter(K12Class.academic_year_id == academic_year_id)
    return q.order_by(K12Class.numeric_level, K12Class.name).all()


@router.post("/classes", response_model=ClassCreateResponse)
def create_class(body: ClassCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cid = new_id("CLS")
    row = K12Class(id=cid, academic_year_id=body.academic_year_id, name=body.name, numeric_level=body.numeric_level)
    db.add(row)
    sections: list[K12Section] = []
    if body.initial_section:
        sid = new_id("SEC")
        sec = K12Section(
            id=sid,
            class_id=cid,
            name=body.initial_section.name.strip(),
            capacity=body.initial_section.capacity,
        )
        db.add(sec)
        sections.append(sec)
    db.commit()
    db.refresh(row)
    return ClassCreateResponse(
        id=row.id,
        academic_year_id=row.academic_year_id,
        name=row.name,
        numeric_level=row.numeric_level,
        sections=[SectionResponse.model_validate(s) for s in sections],
    )


@router.get("/structure")
def classes_with_sections(
    academic_year_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Classes with nested sections and student counts for settings UI."""
    classes = (
        db.query(K12Class)
        .filter(K12Class.academic_year_id == academic_year_id)
        .order_by(K12Class.numeric_level, K12Class.name)
        .all()
    )
    section_rows = (
        db.query(K12Section)
        .join(K12Class, K12Section.class_id == K12Class.id)
        .filter(K12Class.academic_year_id == academic_year_id)
        .order_by(K12Section.class_id, K12Section.name)
        .all()
    )
    section_ids = [s.id for s in section_rows]
    count_by_section: dict[str, int] = {}
    if section_ids:
        for sid, cnt in (
            db.query(K12StudentEnrollment.section_id, func.count())
            .filter(
                K12StudentEnrollment.academic_year_id == academic_year_id,
                K12StudentEnrollment.section_id.in_(section_ids),
            )
            .group_by(K12StudentEnrollment.section_id)
            .all()
        ):
            count_by_section[sid] = int(cnt)

    sections_by_class: dict[str, list] = {}
    for s in section_rows:
        sections_by_class.setdefault(s.class_id, []).append(
            {
                "id": s.id,
                "name": s.name,
                "capacity": s.capacity,
                "student_count": count_by_section.get(s.id, 0),
            }
        )

    out = []
    for c in classes:
        sec_data = sections_by_class.get(c.id, [])
        total_cap = sum(x["capacity"] for x in sec_data)
        total_students = sum(x["student_count"] for x in sec_data)
        out.append(
            {
                "id": c.id,
                "name": c.name,
                "numeric_level": c.numeric_level,
                "section_count": len(sec_data),
                "total_capacity": total_cap if sec_data else None,
                "total_students": total_students,
                "sections": sec_data,
            }
        )
    return out


@router.get("/sections", response_model=list[SectionResponse])
def list_sections(
    class_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(K12Section)
    if class_id:
        q = q.filter(K12Section.class_id == class_id)
    return q.all()


@router.patch("/sections/{section_id}", response_model=SectionResponse)
def update_section(
    section_id: str,
    body: SectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(K12Section).filter(K12Section.id == section_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Section not found")
    if body.name is not None:
        row.name = body.name.strip()
    if body.capacity is not None:
        row.capacity = body.capacity
    if body.class_teacher_id is not None:
        row.class_teacher_id = body.class_teacher_id or None
    db.commit()
    db.refresh(row)
    return row


@router.post("/sections", response_model=SectionResponse)
def create_section(body: SectionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not db.query(K12Class).filter(K12Class.id == body.class_id).first():
        raise HTTPException(status_code=404, detail="Class not found")
    sid = new_id("SEC")
    row = K12Section(id=sid, class_id=body.class_id, name=body.name, class_teacher_id=body.class_teacher_id, capacity=body.capacity)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/subjects", response_model=list[SubjectResponse])
def list_subjects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(K12Subject).all()


@router.post("/subjects", response_model=SubjectResponse)
def create_subject(body: SubjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.query(K12Subject).filter(K12Subject.code == body.code).first():
        raise HTTPException(status_code=400, detail="Subject code exists")
    sid = new_id("SUB")
    row = K12Subject(
        id=sid,
        name=body.name,
        code=body.code,
        is_optional=body.is_optional,
        department=body.department,
        grades_label=body.grades_label,
        periods_per_week=body.periods_per_week,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/class-subjects")
def assign_subject(class_id: str, subject_id: str, full_marks: int = 100, pass_marks: int = 40, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.query(K12ClassSubject).filter(K12ClassSubject.class_id == class_id, K12ClassSubject.subject_id == subject_id).first():
        raise HTTPException(status_code=400, detail="Already assigned")
    db.add(K12ClassSubject(class_id=class_id, subject_id=subject_id, full_marks=full_marks, pass_marks=pass_marks))
    db.commit()
    return {"message": "Assigned"}


@router.get("/enrollments")
def list_enrollments(
    section_id: str | None = None,
    academic_year_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(K12StudentEnrollment)
    if section_id:
        q = q.filter(K12StudentEnrollment.section_id == section_id)
    if academic_year_id:
        q = q.filter(K12StudentEnrollment.academic_year_id == academic_year_id)
    rows = q.all()
    return [
        {
            "id": r.id,
            "student_id": r.student_id,
            "section_id": r.section_id,
            "academic_year_id": r.academic_year_id,
            "roll_no": r.roll_no,
            "status": r.status,
        }
        for r in rows
    ]


@router.post("/enrollments")
def enroll_student(body: EnrollmentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not db.query(Student).filter(Student.id == body.student_id).first():
        raise HTTPException(status_code=404, detail="Student not found")
    existing = db.query(K12StudentEnrollment).filter(
        K12StudentEnrollment.student_id == body.student_id,
        K12StudentEnrollment.academic_year_id == body.academic_year_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student already enrolled for this year")
    eid = new_id("KEN")
    row = K12StudentEnrollment(
        id=eid,
        student_id=body.student_id,
        section_id=body.section_id,
        academic_year_id=body.academic_year_id,
        roll_no=body.roll_no,
        enrolled_on=date.today(),
        status="active",
    )
    db.add(row)
    db.commit()
    return {"id": eid, "message": "Enrolled"}
