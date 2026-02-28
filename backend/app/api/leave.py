"""Student Leave Application API (apply_leave)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import StudentLeaveApplication
from app.schemas.attendance import StudentLeaveApplicationCreate, StudentLeaveApplicationResponse
from app.core.auth import get_current_user
from app.models import User
from app.services.id_gen import new_id

router = APIRouter(prefix="/leave", tags=["leave"])


@router.get("", response_model=list[StudentLeaveApplicationResponse])
def list_leave_applications(
    db: Session = Depends(get_db),
    student_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    q = db.query(StudentLeaveApplication)
    if student_id:
        q = q.filter(StudentLeaveApplication.student_id == student_id)
    rows = q.offset(skip).limit(limit).all()
    return [
        StudentLeaveApplicationResponse(
            id=r.id,
            student_id=r.student_id,
            student_name=r.student_name,
            from_date=r.from_date,
            to_date=r.to_date,
            total_leave_days=r.total_leave_days,
            attendance_based_on=r.attendance_based_on,
            student_group_id=r.student_group_id,
            course_schedule_id=r.course_schedule_id,
            mark_as_present=r.mark_as_present,
            reason=r.reason,
            docstatus=r.docstatus,
        )
        for r in rows
    ]


@router.post("", response_model=StudentLeaveApplicationResponse)
def apply_leave(
    body: StudentLeaveApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply for leave (like frappe apply_leave)."""
    from datetime import date
    from app.models import Student
    student = db.query(Student).filter(Student.id == body.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    delta = (body.to_date - body.from_date).days + 1
    lid = new_id("SLA")
    row = StudentLeaveApplication(
        id=lid,
        student_id=body.student_id,
        student_name=student.student_name,
        from_date=body.from_date,
        to_date=body.to_date,
        total_leave_days=float(delta),
        reason=body.reason,
        attendance_based_on=body.attendance_based_on,
        student_group_id=body.student_group_id,
        course_schedule_id=body.course_schedule_id,
        mark_as_present=body.mark_as_present,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return StudentLeaveApplicationResponse(
        id=row.id,
        student_id=row.student_id,
        student_name=row.student_name,
        from_date=row.from_date,
        to_date=row.to_date,
        total_leave_days=row.total_leave_days,
        attendance_based_on=row.attendance_based_on,
        student_group_id=row.student_group_id,
        course_schedule_id=row.course_schedule_id,
        mark_as_present=row.mark_as_present,
        reason=row.reason,
        docstatus=row.docstatus,
    )


@router.get("/{leave_id}", response_model=StudentLeaveApplicationResponse)
def get_leave_application(
    leave_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(StudentLeaveApplication).filter(StudentLeaveApplication.id == leave_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Leave application not found")
    return StudentLeaveApplicationResponse(
        id=r.id,
        student_id=r.student_id,
        student_name=r.student_name,
        from_date=r.from_date,
        to_date=r.to_date,
        total_leave_days=r.total_leave_days,
        attendance_based_on=r.attendance_based_on,
        student_group_id=r.student_group_id,
        course_schedule_id=r.course_schedule_id,
        mark_as_present=r.mark_as_present,
        reason=r.reason,
        docstatus=r.docstatus,
    )
