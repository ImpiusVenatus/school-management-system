"""Student Attendance API: mark_attendance, check_attendance_records_exist, list."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import StudentAttendance, Student
from app.schemas.attendance import StudentAttendanceCreate, StudentAttendanceResponse, MarkAttendanceRequest
from app.core.auth import require_permission
from app.models import User
from app.services.id_gen import new_id

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.get("", response_model=list[StudentAttendanceResponse])
def list_attendance(
    db: Session = Depends(get_db),
    student_id: str | None = None,
    course_schedule_id: str | None = None,
    student_group_id: str | None = None,
    date: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    current_user: User = Depends(require_permission("attendance.read")),
):
    q = db.query(StudentAttendance)
    if student_id:
        q = q.filter(StudentAttendance.student_id == student_id)
    if course_schedule_id:
        q = q.filter(StudentAttendance.course_schedule_id == course_schedule_id)
    if student_group_id:
        q = q.filter(StudentAttendance.student_group_id == student_group_id)
    if date:
        q = q.filter(StudentAttendance.date == date)
    rows = q.offset(skip).limit(limit).all()
    return [
        StudentAttendanceResponse(
            id=r.id,
            student_id=r.student_id,
            student_name=r.student_name,
            date=r.date,
            status=r.status,
            course_schedule_id=r.course_schedule_id,
            student_group_id=r.student_group_id,
            leave_application_id=r.leave_application_id,
            docstatus=r.docstatus,
        )
        for r in rows
    ]


@router.get("/check")
def check_attendance_records_exist(
    course_schedule_id: str | None = None,
    student_group_id: str | None = None,
    date: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("attendance.read")),
):
    """Check if attendance records exist for given schedule or group+date."""
    if course_schedule_id:
        rows = db.query(StudentAttendance).filter(StudentAttendance.course_schedule_id == course_schedule_id).limit(1).all()
    elif student_group_id and date:
        rows = db.query(StudentAttendance).filter(
            StudentAttendance.student_group_id == student_group_id,
            StudentAttendance.date == date,
        ).limit(1).all()
    else:
        raise HTTPException(status_code=400, detail="Provide course_schedule_id OR (student_group_id and date)")
    return {"exists": len(rows) > 0, "count": len(rows)}


def _make_attendance(db: Session, student_id: str, student_name: str, status: str, course_schedule_id: str | None, student_group_id: str | None, date_str: str):
    from datetime import date
    d = date.fromisoformat(date_str) if isinstance(date_str, str) else date_str
    existing = db.query(StudentAttendance).filter(
        StudentAttendance.student_id == student_id,
        StudentAttendance.date == d,
        StudentAttendance.course_schedule_id == course_schedule_id,
        StudentAttendance.student_group_id == student_group_id,
    ).first()
    if existing:
        existing.status = status
        existing.student_name = student_name
        db.commit()
        return existing
    student = db.query(Student).filter(Student.id == student_id).first()
    name = student_name or (student.student_name if student else student_id)
    rec = StudentAttendance(
        id=new_id("ATT"),
        student_id=student_id,
        student_name=name,
        date=d,
        status=status,
        course_schedule_id=course_schedule_id,
        student_group_id=student_group_id,
        docstatus=1,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.post("/mark")
def mark_attendance(
    body: MarkAttendanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("attendance.mark")),
):
    """Create/update attendance records for present and absent lists."""
    for d in body.students_present:
        _make_attendance(
            db,
            d.get("student"),
            d.get("student_name"),
            "Present",
            body.course_schedule_id,
            body.student_group_id,
            body.date,
        )
    for d in body.students_absent:
        _make_attendance(
            db,
            d.get("student"),
            d.get("student_name"),
            "Absent",
            body.course_schedule_id,
            body.student_group_id,
            body.date,
        )
    return {"message": "Attendance marked successfully"}


@router.post("", response_model=StudentAttendanceResponse)
def create_attendance(
    body: StudentAttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("attendance.mark")),
):
    rec = StudentAttendance(
        id=new_id("ATT"),
        student_id=body.student_id,
        student_name=body.student_name,
        date=body.date,
        status=body.status,
        course_schedule_id=body.course_schedule_id,
        student_group_id=body.student_group_id,
        leave_application_id=body.leave_application_id,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return StudentAttendanceResponse(
        id=rec.id,
        student_id=rec.student_id,
        student_name=rec.student_name,
        date=rec.date,
        status=rec.status,
        course_schedule_id=rec.course_schedule_id,
        student_group_id=rec.student_group_id,
        leave_application_id=rec.leave_application_id,
        docstatus=rec.docstatus,
    )
