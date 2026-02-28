"""Student Attendance, Student Leave Application."""
from datetime import date
from pydantic import BaseModel


class StudentAttendanceBase(BaseModel):
    student_id: str
    date: date
    status: str  # Present, Absent, Leave
    course_schedule_id: str | None = None
    student_group_id: str | None = None
    leave_application_id: str | None = None


class StudentAttendanceCreate(StudentAttendanceBase):
    student_name: str | None = None


class StudentAttendanceResponse(StudentAttendanceBase):
    id: str
    student_name: str | None = None
    docstatus: int = 0

    class Config:
        from_attributes = True


class MarkAttendanceRequest(BaseModel):
    students_present: list[dict]  # [{"student": id, "student_name": name}]
    students_absent: list[dict]
    course_schedule_id: str | None = None
    student_group_id: str | None = None
    date: date


class StudentLeaveApplicationBase(BaseModel):
    student_id: str
    from_date: date
    to_date: date
    reason: str | None = None
    attendance_based_on: str = "Student Group"
    student_group_id: str | None = None
    course_schedule_id: str | None = None
    mark_as_present: bool = False


class StudentLeaveApplicationCreate(StudentLeaveApplicationBase):
    pass


class StudentLeaveApplicationResponse(StudentLeaveApplicationBase):
    id: str
    student_name: str | None = None
    total_leave_days: float | None = None
    docstatus: int = 0

    class Config:
        from_attributes = True
