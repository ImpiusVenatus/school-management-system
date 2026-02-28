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


class AcademicYearResponse(AcademicYearBase):
    id: str

    class Config:
        from_attributes = True


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
