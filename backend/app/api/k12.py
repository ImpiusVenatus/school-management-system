"""K-12 academic structure API."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
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
from app.services.grading_scale import k12_class_sort_key, pass_marks_for_full, resolve_grading_scale_for_class
from app.services.timetable import (
    infer_period_index,
    parse_weekdays,
    period_times,
    periods_per_day,
    weekdays_to_json,
)
from app.api.academic_departments import _dept_response, _subject_counts_by_department
from app.schemas.academic_department import AcademicDepartmentResponse

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


class ClassSubjectMarksUpdate(BaseModel):
    full_marks: int | None = Field(default=None, ge=1, le=1000)


class TimetableSettingsResponse(BaseModel):
    weekdays: list[int]
    periods_per_day: int
    period_minutes: int
    break_minutes: int
    break_after_period: int
    start_time: time


class TimetableSettingsUpdate(BaseModel):
    weekdays: list[int] = Field(min_length=1)
    periods_per_day: int = Field(ge=1, le=12)
    period_minutes: int = Field(ge=15, le=120)
    break_minutes: int = Field(ge=0, le=90)
    break_after_period: int = Field(ge=0, le=12)
    start_time: time


class TimetableSlotCreate(BaseModel):
    subject_id: str
    section_id: str | None = None
    instructor_id: str | None = None
    room_id: str | None = None
    day_of_week: int = Field(ge=0, le=6)
    period_index: int = Field(ge=0, le=11)


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
    period_index: int
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
    timetable_settings: TimetableSettingsResponse
    sections: list[SectionSetupItem]
    pass_threshold_percent: int = 40
    grading_scale_name: str | None = None


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


class SubjectOptionResponse(BaseModel):
    id: str
    name: str
    code: str


class SubjectsPageResponse(BaseModel):
    subjects: list[SubjectResponse]
    departments: list[AcademicDepartmentResponse]


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
    row = K12Class(
        id=cid,
        academic_year_id=body.academic_year_id,
        name=body.name,
        numeric_level=body.numeric_level,
        timetable_weekdays=weekdays_to_json([0, 1, 2, 3, 4]),
        timetable_periods_per_day=8,
        timetable_period_minutes=45,
        timetable_break_minutes=20,
        timetable_break_after_period=4,
        timetable_start_time=time(8, 0),
    )
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
    classes = db.query(K12Class).filter(K12Class.academic_year_id == academic_year_id).all()
    classes.sort(key=k12_class_sort_key)
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


def _subject_response(row: K12Subject) -> SubjectResponse:
    dept = getattr(row, "department", None)
    dept_name = dept.name if dept else None
    return SubjectResponse(
        id=row.id,
        name=row.name,
        code=row.code,
        is_optional=row.is_optional,
        department_id=row.department_id,
        department_name=dept_name,
        grades_label=row.grades_label,
    )


def _load_subject_with_department(db: Session, subject_id: str) -> K12Subject | None:
    return (
        db.query(K12Subject)
        .options(joinedload(K12Subject.department))
        .filter(K12Subject.id == subject_id)
        .first()
    )


def _validate_department_id(db: Session, department_id: str | None) -> None:
    if department_id and not db.query(AcademicDepartment).filter(AcademicDepartment.id == department_id).first():
        raise HTTPException(status_code=400, detail="Department not found")


@router.get("/subjects", response_model=list[SubjectResponse])
def list_subjects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (
        db.query(K12Subject)
        .options(joinedload(K12Subject.department))
        .order_by(K12Subject.name)
        .all()
    )
    return [_subject_response(r) for r in rows]


@router.get("/subjects/options", response_model=list[SubjectOptionResponse])
def list_subject_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(K12Subject.id, K12Subject.name, K12Subject.code).order_by(K12Subject.name).all()
    return [SubjectOptionResponse(id=r.id, name=r.name, code=r.code) for r in rows]


@router.get("/subjects-page", response_model=SubjectsPageResponse)
def get_subjects_page(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Subjects + departments for settings tab in one round-trip."""
    subject_rows = (
        db.query(K12Subject)
        .options(joinedload(K12Subject.department))
        .order_by(K12Subject.name)
        .all()
    )
    dept_rows = db.query(AcademicDepartment).order_by(AcademicDepartment.name).all()
    counts = _subject_counts_by_department(db)
    return SubjectsPageResponse(
        subjects=[_subject_response(r) for r in subject_rows],
        departments=[_dept_response(r, counts) for r in dept_rows],
    )


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
    loaded = _load_subject_with_department(db, sid)
    return _subject_response(loaded or row)


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
    loaded = _load_subject_with_department(db, subject_id)
    return _subject_response(loaded or row)


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


def _timetable_settings_response(cls: K12Class) -> TimetableSettingsResponse:
    return TimetableSettingsResponse(
        weekdays=parse_weekdays(cls.timetable_weekdays),
        periods_per_day=periods_per_day(cls),
        period_minutes=cls.timetable_period_minutes or 45,
        break_minutes=cls.timetable_break_minutes if cls.timetable_break_minutes is not None else 20,
        break_after_period=cls.timetable_break_after_period if cls.timetable_break_after_period is not None else 4,
        start_time=cls.timetable_start_time or time(8, 0),
    )


def _slot_period_index(cls: K12Class, row: K12TimetableSlot) -> int:
    if row.period_index is not None:
        return row.period_index
    inferred = infer_period_index(cls, row.from_time)
    return inferred if inferred is not None else 0


def _timetable_slot_response(
    row: K12TimetableSlot,
    *,
    cls: K12Class,
    subjects: dict[str, K12Subject],
    instructors: dict[str, Instructor],
    rooms: dict[str, Room],
    sections: dict[str, K12Section],
) -> TimetableSlotResponse:
    sub = subjects.get(row.subject_id)
    inst = instructors.get(row.instructor_id) if row.instructor_id else None
    room = rooms.get(row.room_id) if row.room_id else None
    sec = sections.get(row.section_id) if row.section_id else None
    pidx = _slot_period_index(cls, row)
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
        period_index=pidx,
        from_time=row.from_time,
        to_time=row.to_time,
    )


def _load_lookup_maps(
    db: Session,
    subject_ids: set[str],
    instructor_ids: set[str],
    room_ids: set[str],
    section_ids: set[str],
) -> tuple[dict[str, K12Subject], dict[str, Instructor], dict[str, Room], dict[str, K12Section]]:
    subjects = (
        {r.id: r for r in db.query(K12Subject).filter(K12Subject.id.in_(subject_ids)).all()}
        if subject_ids
        else {}
    )
    instructors = (
        {r.id: r for r in db.query(Instructor).filter(Instructor.id.in_(instructor_ids)).all()}
        if instructor_ids
        else {}
    )
    rooms = (
        {r.id: r for r in db.query(Room).filter(Room.id.in_(room_ids)).all()} if room_ids else {}
    )
    sections = (
        {r.id: r for r in db.query(K12Section).filter(K12Section.id.in_(section_ids)).all()}
        if section_ids
        else {}
    )
    return subjects, instructors, rooms, sections


def _timetable_slot_response_db(db: Session, row: K12TimetableSlot) -> TimetableSlotResponse:
    cls = _get_class_or_404(row.class_id, db)
    subject_ids = {row.subject_id}
    instructor_ids = {row.instructor_id} if row.instructor_id else set()
    room_ids = {row.room_id} if row.room_id else set()
    section_ids = {row.section_id} if row.section_id else set()
    sub_map, inst_map, room_map, sec_map = _load_lookup_maps(
        db, subject_ids, instructor_ids, room_ids, section_ids
    )
    return _timetable_slot_response(
        row,
        cls=cls,
        subjects=sub_map,
        instructors=inst_map,
        rooms=room_map,
        sections=sec_map,
    )


@router.get("/classes/{class_id}/setup", response_model=ClassSetupResponse)
def get_class_setup(
    class_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cls = _get_class_or_404(class_id, db)
    scale = resolve_grading_scale_for_class(db, cls)
    _, pass_pct = pass_marks_for_full(db, cls, 100)
    links = db.query(K12ClassSubject).filter(K12ClassSubject.class_id == class_id).all()
    link_subject_ids = {link.subject_id for link in links}
    subject_by_id = (
        {r.id: r for r in db.query(K12Subject).filter(K12Subject.id.in_(link_subject_ids)).all()}
        if link_subject_ids
        else {}
    )
    subjects: list[ClassSubjectItem] = []
    for link in links:
        sub = subject_by_id.get(link.subject_id)
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
    slot_subject_ids = {s.subject_id for s in slots}
    slot_instructor_ids = {s.instructor_id for s in slots if s.instructor_id}
    slot_room_ids = {s.room_id for s in slots if s.room_id}
    slot_section_ids = {s.section_id for s in slots if s.section_id}
    sub_map, inst_map, room_map, sec_map = _load_lookup_maps(
        db, slot_subject_ids, slot_instructor_ids, slot_room_ids, slot_section_ids
    )
    section_rows = (
        db.query(K12Section)
        .filter(K12Section.class_id == class_id)
        .order_by(K12Section.created_at.asc())
        .all()
    )
    teacher_ids = {sec.class_teacher_id for sec in section_rows if sec.class_teacher_id}
    if teacher_ids:
        for tid, inst in (
            (r.id, r) for r in db.query(Instructor).filter(Instructor.id.in_(teacher_ids)).all()
        ):
            inst_map[tid] = inst
    sections_out: list[SectionSetupItem] = []
    for sec in section_rows:
        inst = inst_map.get(sec.class_teacher_id) if sec.class_teacher_id else None
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
        timetable=[
            _timetable_slot_response(
                s,
                cls=cls,
                subjects=sub_map,
                instructors=inst_map,
                rooms=room_map,
                sections=sec_map,
            )
            for s in slots
        ],
        timetable_settings=_timetable_settings_response(cls),
        sections=sections_out,
        pass_threshold_percent=pass_pct,
        grading_scale_name=scale.grading_scale_name if scale else None,
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
    cls = _get_class_or_404(class_id, db)
    sub = db.query(K12Subject).filter(K12Subject.id == body.subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
    if db.query(K12ClassSubject).filter(
        K12ClassSubject.class_id == class_id, K12ClassSubject.subject_id == body.subject_id
    ).first():
        raise HTTPException(status_code=400, detail="Subject already assigned to this class")
    pass_marks, _ = pass_marks_for_full(db, cls, body.full_marks)
    db.add(
        K12ClassSubject(
            class_id=class_id,
            subject_id=body.subject_id,
            full_marks=body.full_marks,
            pass_marks=pass_marks,
        )
    )
    db.commit()
    return ClassSubjectItem(
        subject_id=sub.id,
        subject_name=sub.name,
        subject_code=sub.code,
        full_marks=body.full_marks,
        pass_marks=pass_marks,
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
        cls = _get_class_or_404(class_id, db)
        link.full_marks = body.full_marks
        link.pass_marks, _ = pass_marks_for_full(db, cls, link.full_marks)
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


@router.patch("/classes/{class_id}/timetable-settings", response_model=TimetableSettingsResponse)
def update_timetable_settings(
    class_id: str,
    body: TimetableSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cls = _get_class_or_404(class_id, db)
    if body.break_after_period > body.periods_per_day:
        raise HTTPException(status_code=400, detail="Break must fall within the school day periods")
    cls.timetable_weekdays = weekdays_to_json(body.weekdays)
    cls.timetable_periods_per_day = body.periods_per_day
    cls.timetable_period_minutes = body.period_minutes
    cls.timetable_break_minutes = body.break_minutes
    cls.timetable_break_after_period = body.break_after_period
    cls.timetable_start_time = body.start_time
    db.commit()
    db.refresh(cls)
    return _timetable_settings_response(cls)


@router.post("/classes/{class_id}/timetable", response_model=TimetableSlotResponse)
def create_timetable_slot(
    class_id: str,
    body: TimetableSlotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cls = _get_class_or_404(class_id, db)
    max_period = periods_per_day(cls) - 1
    if body.period_index > max_period:
        raise HTTPException(status_code=400, detail=f"Period must be between 0 and {max_period}")
    weekdays = parse_weekdays(cls.timetable_weekdays)
    if body.day_of_week not in weekdays:
        raise HTTPException(status_code=400, detail="This day is not a school day for this class")
    if not db.query(K12Subject).filter(K12Subject.id == body.subject_id).first():
        raise HTTPException(status_code=404, detail="Subject not found")
    assigned = db.query(K12ClassSubject).filter(
        K12ClassSubject.class_id == class_id, K12ClassSubject.subject_id == body.subject_id
    ).first()
    if not assigned:
        raise HTTPException(status_code=400, detail="Subject is not assigned to this class")
    if body.section_id and not db.query(K12Section).filter(
        K12Section.id == body.section_id, K12Section.class_id == class_id
    ).first():
        raise HTTPException(status_code=400, detail="Invalid section for this class")
    from_t, to_t = period_times(cls, body.period_index)
    existing = (
        db.query(K12TimetableSlot)
        .filter(
            K12TimetableSlot.class_id == class_id,
            K12TimetableSlot.day_of_week == body.day_of_week,
            K12TimetableSlot.period_index == body.period_index,
        )
        .first()
    )
    if existing:
        existing.subject_id = body.subject_id
        existing.section_id = body.section_id
        existing.instructor_id = body.instructor_id
        existing.room_id = body.room_id
        existing.from_time = from_t
        existing.to_time = to_t
        db.commit()
        db.refresh(existing)
        return _timetable_slot_response_db(db, existing)
    row = K12TimetableSlot(
        id=new_id("TT"),
        class_id=class_id,
        section_id=body.section_id,
        subject_id=body.subject_id,
        instructor_id=body.instructor_id,
        room_id=body.room_id,
        day_of_week=body.day_of_week,
        period_index=body.period_index,
        from_time=from_t,
        to_time=to_t,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _timetable_slot_response_db(db, row)


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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Legacy query-param assign; prefer POST /classes/{class_id}/subjects."""
    body = ClassSubjectAssign(subject_id=subject_id, full_marks=full_marks)
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
