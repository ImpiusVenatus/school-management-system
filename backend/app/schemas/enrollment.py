"""Program Enrollment, Course Enrollment."""
from datetime import date
from pydantic import BaseModel


class ProgramEnrollmentCourseItem(BaseModel):
    course_id: str
    course_name: str | None = None


class ProgramEnrollmentBase(BaseModel):
    program_id: str
    academic_year_id: str
    academic_term_id: str | None = None
    enrollment_date: date
    student_category_id: str | None = None
    student_batch_name: str | None = None
    school_house_id: str | None = None
    boarding_student: bool = False
    grade_level: str | None = None
    section_name: str | None = None
    student_advisor_id: str | None = None


class ProgramEnrollmentCreate(ProgramEnrollmentBase):
    student_id: str
    courses: list[ProgramEnrollmentCourseItem] = []


class ProgramEnrollmentUpdate(BaseModel):
    academic_term_id: str | None = None
    student_category_id: str | None = None
    student_batch_name: str | None = None
    school_house_id: str | None = None
    boarding_student: bool | None = None
    grade_level: str | None = None
    section_name: str | None = None
    student_advisor_id: str | None = None
    courses: list[ProgramEnrollmentCourseItem] | None = None


class ProgramEnrollmentResponse(ProgramEnrollmentBase):
    id: str
    student_id: str
    student_name: str | None = None
    program_id: str
    courses: list[ProgramEnrollmentCourseItem] = []
    docstatus: int = 0
    grade_level: str | None = None
    section_name: str | None = None
    student_advisor_id: str | None = None
    student_advisor_name: str | None = None

    class Config:
        from_attributes = True


class CourseEnrollmentResponse(BaseModel):
    id: str
    student_id: str
    student_name: str | None = None
    course_id: str
    program_enrollment_id: str
    enrollment_date: date
    program_id: str | None = None

    class Config:
        from_attributes = True
