"""K-12 academic structure API."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from datetime import date, time
from app.database import get_db
from app.models import (
    K12Class,
    K12Section,
    K12Subject,
    K12ClassSubject,
    K12StudentEnrollment,
    K12TimetableSlot,
    AcademicYear,
    AcademicDepartment,
    Student,
    Instructor,
    Room,
)
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id

router = APIRouter(prefix="/k12", tags=["k12"])


class InitialSectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
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
    name: str = Field(..., min_length=1, max_length=50)
    class_teacher_id: str | None = None
    capacity: int = Field(default=40, ge=1, le=500)


class SectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    capacity: int | None = Field(default=None, ge=1, le=500)
    class_teacher_id: str | None = None


class SectionResponse(BaseModel):
    id: str
    class_id: str
    name: str
    capacity: int
    class_teacher_id: str | None = None

    class Config:
        from_attributes = True


class ClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    numeric_level: int | None = None


class ClassSubjectItem(BaseModel):
    subject_id: str
    subject_name: str
    subject_code: str
    full_marks: int
    pass_marks: int
    is_optional: bool = False


class ClassSubjectAssign(BaseModel):
    subject_id: str
    full_marks: int = Field(default=100, ge=1, le=1000)
    pass_marks: int = Field(default=40, ge=0, le=1000)


class ClassSubjectMarksUpdate(BaseModel):
    full_marks: int | None = Field(default=None, ge=1, le=1000)
    pass_marks: int | None = Field(default=None, ge=0, le=1000)


class TimetableSlotCreate(BaseModel):
    subject_id: str
    section_id: str | None = None
    instructor_id: str | None = None
    room_id: str | None = None
    day_of_week: int = Field(ge=0, le=6)
    from_time: time
    to_time: time


class TimetableSlotResponse(BaseModel):
    id: str
    class_id: str
    section_id: str | None
    subject_id: str
    subject_name: str
    subject_code: str
    instructor_id: str | None
    instructor_name: str | None
    room_id: str | None
    room_name: str | None
    section_name: str | None
    day_of_week: int
    from_time: time
    to_time: time


class SectionSetupItem(BaseModel):
    id: str
    name: str
    capacity: int
    class_teacher_id: str | None
    class_teacher_name: str | None


class ClassSetupResponse(BaseModel):
    id: str
    name: str
    numeric_level: int | None
    academic_year_id: str
    subjects: list[ClassSubjectItem]
    timetable: list[TimetableSlotResponse]
    sections: list[SectionSetupItem]


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
    department_id: str | None = None
    grades_label: str | None = None


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=20)
    is_optional: bool | None = None
    department_id: str | None = None
    grades_label: str | None = None


class SubjectResponse(BaseModel):
    id: str
    name: str
    code: str
    is_optional: bool
    department_id: str | None = None
    department_name: str | None = None
    grades_label: str | None = None


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
    return q.order_by(K12Class.created_at.asc()).all()


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
        .order_by(K12Class.created_at.asc())
        .all()
    )
    section_rows = (
        db.query(K12Section)
        .join(K12Class, K12Section.class_id == K12Class.id)
        .filter(K12Class.academic_year_id == academic_year_id)
        .order_by(K12Section.class_id, K12Section.created_at.asc())
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
                "class_teacher_id": s.class_teacher_id,
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
    row = K12Section(
        id=sid,
        class_id=body.class_id,
        name=body.name.strip(),
        class_teacher_id=body.class_teacher_id,
        capacity=body.capacity,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _subject_response(db: Session, row: K12Subject) -> SubjectResponse:
    dept_name = None
    if row.department_id:
        d = db.query(AcademicDepartment).filter(AcademicDepartment.id == row.department_id).first()
        dept_name = d.name if d else None
    return SubjectResponse(
        id=row.id,
        name=row.name,
        code=row.code,
        is_optional=row.is_optional,
        department_id=row.department_id,
        department_name=dept_name,
        grades_label=row.grades_label,
    )


def _validate_department_id(db: Session, department_id: str | None) -> None:
    if department_id and not db.query(AcademicDepartment).filter(AcademicDepartment.id == department_id).first():
        raise HTTPException(status_code=400, detail="Department not found")


@router.get("/subjects", response_model=list[SubjectResponse])
def list_subjects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(K12Subject).order_by(K12Subject.name).all()
    return [_subject_response(db, r) for r in rows]


@router.post("/subjects", response_model=SubjectResponse)
def create_subject(body: SubjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.query(K12Subject).filter(K12Subject.code == body.code).first():
        raise HTTPException(status_code=400, detail="Subject code exists")
    _validate_department_id(db, body.department_id)
    sid = new_id("SUB")
    row = K12Subject(
        id=sid,
        name=body.name,
        code=body.code,
        is_optional=body.is_optional,
        department_id=body.department_id,
        grades_label=body.grades_label,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _subject_response(db, row)


@router.patch("/subjects/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: str,
    body: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(K12Subject).filter(K12Subject.id == subject_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Subject not found")
    if body.code is not None:
        other = db.query(K12Subject).filter(K12Subject.code == body.code, K12Subject.id != subject_id).first()
        if other:
            raise HTTPException(status_code=400, detail="Subject code exists")
        row.code = body.code
    if body.name is not None:
        row.name = body.name
    if body.is_optional is not None:
        row.is_optional = body.is_optional
    if body.department_id is not None:
        if body.department_id:
            _validate_department_id(db, body.department_id)
        row.department_id = body.department_id or None
    if body.grades_label is not None:
        row.grades_label = body.grades_label or None
    db.commit()
    db.refresh(row)
    return _subject_response(db, row)


@router.delete("/subjects/{subject_id}", status_code=204)
def delete_subject(
    subject_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(K12Subject).filter(K12Subject.id == subject_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Subject not found")
    if db.query(K12ClassSubject).filter(K12ClassSubject.subject_id == subject_id).first():
        raise HTTPException(status_code=400, detail="Subject is assigned to one or more classes. Remove assignments first.")
    if db.query(K12TimetableSlot).filter(K12TimetableSlot.subject_id == subject_id).first():
        raise HTTPException(status_code=400, detail="Subject is used in timetables. Remove timetable periods first.")
    db.delete(row)
    db.commit()


def _get_class_or_404(class_id: str, db: Session) -> K12Class:
    row = db.query(K12Class).filter(K12Class.id == class_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Class not found")
    return row


def _timetable_slot_response(db: Session, row: K12TimetableSlot) -> TimetableSlotResponse:
    sub = db.query(K12Subject).filter(K12Subject.id == row.subject_id).first()
    inst = db.query(Instructor).filter(Instructor.id == row.instructor_id).first() if row.instructor_id else None
    room = db.query(Room).filter(Room.id == row.room_id).first() if row.room_id else None
    sec = db.query(K12Section).filter(K12Section.id == row.section_id).first() if row.section_id else None
    return TimetableSlotResponse(
        id=row.id,
        class_id=row.class_id,
        section_id=row.section_id,
        subject_id=row.subject_id,
        subject_name=sub.name if sub else "",
        subject_code=sub.code if sub else "",
        instructor_id=row.instructor_id,
        instructor_name=inst.instructor_name if inst else None,
        room_id=row.room_id,
        room_name=room.room_name if room else None,
        section_name=sec.name if sec else None,
        day_of_week=row.day_of_week,
        from_time=row.from_time,
        to_time=row.to_time,
    )


@router.get("/classes/{class_id}/setup", response_model=ClassSetupResponse)
def get_class_setup(
    class_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cls = _get_class_or_404(class_id, db)
    links = db.query(K12ClassSubject).filter(K12ClassSubject.class_id == class_id).all()
    subjects: list[ClassSubjectItem] = []
    for link in links:
        sub = db.query(K12Subject).filter(K12Subject.id == link.subject_id).first()
        if not sub:
            continue
        subjects.append(
            ClassSubjectItem(
                subject_id=sub.id,
                subject_name=sub.name,
                subject_code=sub.code,
                full_marks=link.full_marks,
                pass_marks=link.pass_marks,
                is_optional=sub.is_optional,
            )
        )
    slots = (
        db.query(K12TimetableSlot)
        .filter(K12TimetableSlot.class_id == class_id)
        .order_by(K12TimetableSlot.day_of_week, K12TimetableSlot.from_time)
        .all()
    )
    sections_out: list[SectionSetupItem] = []
    for sec in db.query(K12Section).filter(K12Section.class_id == class_id).order_by(K12Section.created_at.asc()).all():
        inst = (
            db.query(Instructor).filter(Instructor.id == sec.class_teacher_id).first()
            if sec.class_teacher_id
            else None
        )
        sections_out.append(
            SectionSetupItem(
                id=sec.id,
                name=sec.name,
                capacity=sec.capacity,
                class_teacher_id=sec.class_teacher_id,
                class_teacher_name=inst.instructor_name if inst else None,
            )
        )
    return ClassSetupResponse(
        id=cls.id,
        name=cls.name,
        numeric_level=cls.numeric_level,
        academic_year_id=cls.academic_year_id,
        subjects=subjects,
        timetable=[_timetable_slot_response(db, s) for s in slots],
        sections=sections_out,
    )


@router.patch("/classes/{class_id}", response_model=ClassResponse)
def update_class(
    class_id: str,
    body: ClassUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = _get_class_or_404(class_id, db)
    if body.name is not None:
        row.name = body.name.strip()
    if body.numeric_level is not None:
        row.numeric_level = body.numeric_level
    db.commit()
    db.refresh(row)
    return row


@router.post("/classes/{class_id}/subjects", response_model=ClassSubjectItem)
def assign_class_subject(
    class_id: str,
    body: ClassSubjectAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_class_or_404(class_id, db)
    sub = db.query(K12Subject).filter(K12Subject.id == body.subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
    if db.query(K12ClassSubject).filter(
        K12ClassSubject.class_id == class_id, K12ClassSubject.subject_id == body.subject_id
    ).first():
        raise HTTPException(status_code=400, detail="Subject already assigned to this class")
    db.add(
        K12ClassSubject(
            class_id=class_id,
            subject_id=body.subject_id,
            full_marks=body.full_marks,
            pass_marks=body.pass_marks,
        )
    )
    db.commit()
    return ClassSubjectItem(
        subject_id=sub.id,
        subject_name=sub.name,
        subject_code=sub.code,
        full_marks=body.full_marks,
        pass_marks=body.pass_marks,
        is_optional=sub.is_optional,
    )


@router.patch("/classes/{class_id}/subjects/{subject_id}", response_model=ClassSubjectItem)
def update_class_subject_marks(
    class_id: str,
    subject_id: str,
    body: ClassSubjectMarksUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = (
        db.query(K12ClassSubject)
        .filter(K12ClassSubject.class_id == class_id, K12ClassSubject.subject_id == subject_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Subject not assigned to this class")
    if body.full_marks is not None:
        link.full_marks = body.full_marks
    if body.pass_marks is not None:
        link.pass_marks = body.pass_marks
    db.commit()
    sub = db.query(K12Subject).filter(K12Subject.id == subject_id).first()
    return ClassSubjectItem(
        subject_id=subject_id,
        subject_name=sub.name if sub else "",
        subject_code=sub.code if sub else "",
        full_marks=link.full_marks,
        pass_marks=link.pass_marks,
        is_optional=sub.is_optional if sub else False,
    )


@router.delete("/classes/{class_id}/subjects/{subject_id}", status_code=204)
def remove_class_subject(
    class_id: str,
    subject_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = (
        db.query(K12ClassSubject)
        .filter(K12ClassSubject.class_id == class_id, K12ClassSubject.subject_id == subject_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Subject not assigned to this class")
    db.delete(link)
    db.commit()


@router.post("/classes/{class_id}/timetable", response_model=TimetableSlotResponse)
def create_timetable_slot(
    class_id: str,
    body: TimetableSlotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_class_or_404(class_id, db)
    if body.from_time >= body.to_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    if not db.query(K12Subject).filter(K12Subject.id == body.subject_id).first():
        raise HTTPException(status_code=404, detail="Subject not found")
    if body.section_id and not db.query(K12Section).filter(
        K12Section.id == body.section_id, K12Section.class_id == class_id
    ).first():
        raise HTTPException(status_code=400, detail="Invalid section for this class")
    row = K12TimetableSlot(
        id=new_id("TT"),
        class_id=class_id,
        section_id=body.section_id,
        subject_id=body.subject_id,
        instructor_id=body.instructor_id,
        room_id=body.room_id,
        day_of_week=body.day_of_week,
        from_time=body.from_time,
        to_time=body.to_time,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _timetable_slot_response(db, row)


@router.delete("/timetable/{slot_id}", status_code=204)
def delete_timetable_slot(
    slot_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(K12TimetableSlot).filter(K12TimetableSlot.id == slot_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Timetable slot not found")
    db.delete(row)
    db.commit()


@router.post("/class-subjects")
def assign_subject_legacy(
    class_id: str,
    subject_id: str,
    full_marks: int = 100,
    pass_marks: int = 40,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Legacy query-param assign; prefer POST /classes/{class_id}/subjects."""
    body = ClassSubjectAssign(subject_id=subject_id, full_marks=full_marks, pass_marks=pass_marks)
    return assign_class_subject(class_id, body, db, current_user)


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
