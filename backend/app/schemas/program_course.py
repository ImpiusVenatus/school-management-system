"""Program, Course, ProgramCourse."""
from pydantic import BaseModel


class ProgramCourseItem(BaseModel):
    course_id: str
    course_name: str | None = None
    required: bool = True


class ProgramBase(BaseModel):
    program_name: str
    program_abbreviation: str | None = None
    department: str | None = None


class ProgramCreate(ProgramBase):
    courses: list[ProgramCourseItem] = []


class ProgramUpdate(BaseModel):
    program_name: str | None = None
    program_abbreviation: str | None = None
    department: str | None = None
    courses: list[ProgramCourseItem] | None = None


class ProgramResponse(ProgramBase):
    id: str
    courses: list[ProgramCourseItem] = []

    class Config:
        from_attributes = True


class CourseAssessmentCriteriaItem(BaseModel):
    assessment_criteria_id: str
    weightage: float


class CourseBase(BaseModel):
    course_name: str
    department: str | None = None
    description: str | None = None
    default_grading_scale_id: str | None = None


class CourseCreate(CourseBase):
    assessment_criteria: list[CourseAssessmentCriteriaItem] = []


class CourseUpdate(BaseModel):
    course_name: str | None = None
    department: str | None = None
    description: str | None = None
    default_grading_scale_id: str | None = None
    assessment_criteria: list[CourseAssessmentCriteriaItem] | None = None


class CourseResponse(CourseBase):
    id: str

    class Config:
        from_attributes = True
