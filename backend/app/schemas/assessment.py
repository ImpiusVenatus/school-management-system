"""Assessment Plan, Result, Grading Scale."""
from datetime import date, time
from pydantic import BaseModel


class GradingScaleIntervalItem(BaseModel):
    grade_code: str
    threshold: float
    grade_description: str | None = None


class GradingScaleBase(BaseModel):
    grading_scale_name: str
    description: str | None = None


class GradingScaleCreate(GradingScaleBase):
    intervals: list[GradingScaleIntervalItem]


class GradingScaleResponse(GradingScaleBase):
    id: str
    intervals: list[GradingScaleIntervalItem] = []
    docstatus: int = 0

    class Config:
        from_attributes = True


class AssessmentPlanCriteriaItem(BaseModel):
    assessment_criteria_id: str
    maximum_score: float


class AssessmentPlanBase(BaseModel):
    student_group_id: str
    assessment_name: str | None = None
    assessment_group_id: str
    grading_scale_id: str
    course_id: str
    academic_year_id: str | None = None
    academic_term_id: str | None = None
    schedule_date: date
    room_id: str | None = None
    examiner_id: str | None = None
    from_time: time | None = None
    to_time: time | None = None
    supervisor_id: str | None = None
    maximum_assessment_score: float


class AssessmentPlanCreate(AssessmentPlanBase):
    assessment_criteria: list[AssessmentPlanCriteriaItem]


class AssessmentPlanResponse(AssessmentPlanBase):
    id: str
    program_id: str | None = None
    docstatus: int = 0

    class Config:
        from_attributes = True


class AssessmentResultDetailItem(BaseModel):
    assessment_criteria_id: str
    maximum_score: float | None = None
    score: float
    grade: str | None = None


class AssessmentResultBase(BaseModel):
    assessment_plan_id: str
    student_id: str
    details: list[AssessmentResultDetailItem]
    comment: str | None = None


class AssessmentResultCreate(AssessmentResultBase):
    pass


class AssessmentResultResponse(AssessmentResultBase):
    id: str
    student_name: str | None = None
    total_score: float | None = None
    grade: str | None = None
    maximum_score: float | None = None
    docstatus: int = 0

    class Config:
        from_attributes = True
