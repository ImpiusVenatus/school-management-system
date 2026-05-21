"""Academic Year, Term."""
from datetime import date
from pydantic import BaseModel


class AcademicYearBase(BaseModel):
    academic_year_name: str
    year_start_date: date
    year_end_date: date


class AcademicYearCreate(AcademicYearBase):
    pass


class AcademicYearUpdate(BaseModel):
    academic_year_name: str | None = None
    year_start_date: date | None = None
    year_end_date: date | None = None
    status: str | None = None


class AcademicYearResponse(AcademicYearBase):
    id: str
    status: str = "closed"

    class Config:
        from_attributes = True


class AcademicYearLiteResponse(AcademicYearResponse):
    """Year row without per-year class/section/student counts (faster list)."""
    is_active: bool = False


class AcademicYearSummaryResponse(AcademicYearResponse):
    is_active: bool = False
    class_count: int = 0
    section_count: int = 0
    student_count: int = 0


class AcademicYearDetailResponse(AcademicYearSummaryResponse):
    days_total: int = 0
    days_elapsed: int = 0
    days_remaining: int = 0
    progress_percent: int = 0
    term_count: int = 0


class AcademicYearCreateBody(BaseModel):
    """Optional; dates derived from school cycle when omitted."""
    academic_year_name: str | None = None
    year_start_date: date | None = None
    year_end_date: date | None = None
    set_active: bool = True


class AcademicYearSuggestResponse(BaseModel):
    academic_year_name: str
    year_start_date: date
    year_end_date: date
    start_month: int
    cycle_label: str


class AcademicTermBase(BaseModel):
    term_name: str
    term_start_date: date
    term_end_date: date
    academic_year_id: str


class AcademicTermCreate(AcademicTermBase):
    pass


class AcademicTermUpdate(BaseModel):
    term_name: str | None = None
    term_start_date: date | None = None
    term_end_date: date | None = None
    academic_year_id: str | None = None


class AcademicTermResponse(AcademicTermBase):
    id: str
    title: str | None

    class Config:
        from_attributes = True
