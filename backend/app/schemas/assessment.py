"""Assessment Plan, Result, Grading Scale."""
import json
from datetime import date, time, datetime
from pydantic import BaseModel, Field


class GradingScaleIntervalItem(BaseModel):
    grade_code: str
    threshold: float
    max_percent: float | None = None
    grade_description: str | None = None
    gpa_points: float | None = None
    color: str | None = None


class GradingScaleCalculationRules(BaseModel):
    round_half_up: bool = True
    apply_per_subject: bool = True
    pass_each_subject: bool = False
    show_gpa_report: bool = True
    show_rank_section: bool = True
    show_rank_class: bool = False


DEFAULT_CALCULATION_RULES = GradingScaleCalculationRules()


class GradingScaleBase(BaseModel):
    grading_scale_name: str
    description: str | None = None


class GradingScaleCreate(GradingScaleBase):
    intervals: list[GradingScaleIntervalItem]
    is_default: bool = False
    calculation_rules: GradingScaleCalculationRules | None = None


class GradingScaleUpdate(BaseModel):
    grading_scale_name: str | None = None
    description: str | None = None
    is_default: bool | None = None
    intervals: list[GradingScaleIntervalItem] | None = None
    calculation_rules: GradingScaleCalculationRules | None = None


class AssignedClassItem(BaseModel):
    id: str
    name: str
    academic_year_id: str
    uses_default: bool = False


class GradingScaleResponse(GradingScaleBase):
    id: str
    intervals: list[GradingScaleIntervalItem] = []
    is_default: bool = False
    calculation_rules: GradingScaleCalculationRules = Field(default_factory=GradingScaleCalculationRules)
    docstatus: int = 0
    range_count: int = 0
    gpa_min: float | None = None
    gpa_max: float | None = None
    class_count: int = 0
    used_by_label: str | None = None
    updated_at: datetime | None = None
    updated_by_name: str | None = None
    assigned_classes: list[AssignedClassItem] = []
    intervals_valid: bool = True
    intervals_validation_message: str | None = None

    class Config:
        from_attributes = True


class ClassAssignmentUpdate(BaseModel):
    class_ids: list[str] = Field(default_factory=list)


def rules_to_json(rules: GradingScaleCalculationRules | None) -> str | None:
    if rules is None:
        return None
    return json.dumps(rules.model_dump())


def rules_from_json(raw: str | None) -> GradingScaleCalculationRules:
    if not raw:
        return GradingScaleCalculationRules()
    try:
        return GradingScaleCalculationRules(**json.loads(raw))
    except (json.JSONDecodeError, TypeError, ValueError):
        return GradingScaleCalculationRules()


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
