"""Student Group, Student Group Student, Instructor."""
from pydantic import BaseModel


class StudentGroupStudentItem(BaseModel):
    student_id: str
    student_name: str | None = None
    group_roll_number: int | None = None
    active: bool = True


class StudentGroupInstructorItem(BaseModel):
    instructor_id: str


class StudentGroupBase(BaseModel):
    student_group_name: str
    academic_year_id: str
    academic_term_id: str | None = None
    group_based_on: str  # Batch, Course, Activity
    program_id: str | None = None
    batch_id: str | None = None
    course_id: str | None = None
    student_category_id: str | None = None
    max_strength: int | None = None
    disabled: bool = False


class StudentGroupCreate(StudentGroupBase):
    students: list[StudentGroupStudentItem] = []
    instructors: list[StudentGroupInstructorItem] = []


class StudentGroupUpdate(BaseModel):
    student_group_name: str | None = None
    academic_term_id: str | None = None
    max_strength: int | None = None
    disabled: bool | None = None
    students: list[StudentGroupStudentItem] | None = None
    instructors: list[StudentGroupInstructorItem] | None = None


class StudentGroupResponse(StudentGroupBase):
    id: str
    students: list[StudentGroupStudentItem] = []
    instructors: list[StudentGroupInstructorItem] = []

    class Config:
        from_attributes = True
