"""Course Schedule API + get_course_schedule_events for calendar."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import get_db
from app.models import CourseSchedule, StudentGroup, Course, Room
from app.schemas.course_schedule import CourseScheduleCreate, CourseScheduleUpdate, CourseScheduleResponse, CourseScheduleEvent
from app.core.auth import require_permission
from app.models import User
from app.services.id_gen import new_id

router = APIRouter(prefix="/course-schedules", tags=["course-schedules"])


@router.get("", response_model=list[CourseScheduleResponse])
def list_course_schedules(
    db: Session = Depends(get_db),
    student_group_id: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_permission("course_schedules.read")),
):
    q = db.query(CourseSchedule)
    if student_group_id:
        q = q.filter(CourseSchedule.student_group_id == student_group_id)
    if from_date:
        q = q.filter(CourseSchedule.schedule_date >= from_date)
    if to_date:
        q = q.filter(CourseSchedule.schedule_date <= to_date)
    rows = q.order_by(CourseSchedule.schedule_date, CourseSchedule.from_time).offset(skip).limit(limit).all()
    return [
        CourseScheduleResponse(
            id=r.id,
            student_group_id=r.student_group_id,
            instructor_id=r.instructor_id,
            instructor_name=r.instructor_name,
            program_id=r.program_id,
            course_id=r.course_id,
            schedule_date=r.schedule_date,
            room_id=r.room_id,
            from_time=r.from_time,
            to_time=r.to_time,
            title=r.title,
            class_schedule_color=r.class_schedule_color or "blue",
        )
        for r in rows
    ]


@router.get("/events", response_model=list[CourseScheduleEvent])
def get_course_schedule_events(
    start: str,
    end: str,
    student_group_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("course_schedules.read")),
):
    """Calendar events: start/end are date strings (e.g. 2024-01-01)."""
    q = db.query(CourseSchedule).filter(
        and_(CourseSchedule.schedule_date >= start, CourseSchedule.schedule_date <= end)
    )
    if student_group_id:
        q = q.filter(CourseSchedule.student_group_id == student_group_id)
    rows = q.all()
    course_map = {c.id: c.course_name for c in db.query(Course).all()}
    return [
        CourseScheduleEvent(
            id=r.id,
            course=course_map.get(r.course_id, r.course_id),
            from_time=r.from_time.isoformat() if hasattr(r.from_time, "isoformat") else str(r.from_time),
            to_time=r.to_time.isoformat() if hasattr(r.to_time, "isoformat") else str(r.to_time),
            room=db.query(Room).filter(Room.id == r.room_id).first().room_name if r.room_id else "",
            student_group=r.student_group_id or "",
            schedule_date=r.schedule_date,
            class_schedule_color=r.class_schedule_color,
        )
        for r in rows
    ]


@router.post("", response_model=CourseScheduleResponse)
def create_course_schedule(
    body: CourseScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("course_schedules.manage")),
):
    from app.models import Instructor
    instructor = db.query(Instructor).filter(Instructor.id == body.instructor_id).first()
    instructor_name = instructor.instructor_name if instructor else None
    group = db.query(StudentGroup).filter(StudentGroup.id == body.student_group_id).first()
    program_id = group.program_id if group else None
    sid = new_id("CSH")
    row = CourseSchedule(
        id=sid,
        student_group_id=body.student_group_id,
        instructor_id=body.instructor_id,
        instructor_name=instructor_name,
        program_id=program_id,
        course_id=body.course_id,
        schedule_date=body.schedule_date,
        room_id=body.room_id,
        from_time=body.from_time,
        to_time=body.to_time,
        title=body.title,
        class_schedule_color=body.class_schedule_color or "blue",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return CourseScheduleResponse(
        id=row.id,
        student_group_id=row.student_group_id,
        instructor_id=row.instructor_id,
        instructor_name=row.instructor_name,
        program_id=row.program_id,
        course_id=row.course_id,
        schedule_date=row.schedule_date,
        room_id=row.room_id,
        from_time=row.from_time,
        to_time=row.to_time,
        title=row.title,
        class_schedule_color=row.class_schedule_color,
    )


@router.get("/{schedule_id}", response_model=CourseScheduleResponse)
def get_course_schedule(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("course_schedules.read")),
):
    r = db.query(CourseSchedule).filter(CourseSchedule.id == schedule_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Course schedule not found")
    return CourseScheduleResponse(
        id=r.id,
        student_group_id=r.student_group_id,
        instructor_id=r.instructor_id,
        instructor_name=r.instructor_name,
        program_id=r.program_id,
        course_id=r.course_id,
        schedule_date=r.schedule_date,
        room_id=r.room_id,
        from_time=r.from_time,
        to_time=r.to_time,
        title=r.title,
        class_schedule_color=r.class_schedule_color or "blue",
    )


@router.delete("/{schedule_id}")
def delete_course_schedule(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("course_schedules.manage")),
):
    r = db.query(CourseSchedule).filter(CourseSchedule.id == schedule_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Course schedule not found")
    db.delete(r)
    db.commit()
    return {"message": "Deleted"}
