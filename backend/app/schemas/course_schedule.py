"""Course Schedule."""
from datetime import date, time
from pydantic import BaseModel


class CourseScheduleBase(BaseModel):
    student_group_id: str
    instructor_id: str
    course_id: str
    schedule_date: date
    room_id: str
    from_time: time
    to_time: time
    title: str | None = None
    class_schedule_color: str = "blue"


class CourseScheduleCreate(CourseScheduleBase):
    pass


class CourseScheduleUpdate(BaseModel):
    schedule_date: date | None = None
    room_id: str | None = None
    from_time: time | None = None
    to_time: time | None = None
    title: str | None = None
    class_schedule_color: str | None = None


class CourseScheduleResponse(CourseScheduleBase):
    id: str
    instructor_name: str | None = None
    program_id: str | None = None

    class Config:
        from_attributes = True


class CourseScheduleEvent(BaseModel):
    id: str
    course: str
    from_time: str
    to_time: str
    room: str
    student_group: str
    schedule_date: date
    class_schedule_color: str | None = None

    class Config:
        from_attributes = True
