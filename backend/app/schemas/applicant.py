"""Student Applicant."""
from datetime import date
from pydantic import BaseModel, EmailStr


class StudentApplicantBase(BaseModel):
    first_name: str
    middle_name: str | None = None
    last_name: str | None = None
    program_id: str
    academic_year_id: str
    academic_term_id: str | None = None
    student_category_id: str | None = None
    student_email_id: EmailStr | None = None
    student_mobile_number: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    blood_group: str | None = None
    nationality: str | None = None
    address_line_1: str | None = None
    address_line_2: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    country: str | None = None


class StudentApplicantCreate(StudentApplicantBase):
    pass


class StudentApplicantUpdate(BaseModel):
    application_status: str | None = None  # Applied, Approved, Rejected, Admitted
    first_name: str | None = None
    middle_name: str | None = None
    last_name: str | None = None
    student_email_id: EmailStr | None = None
    student_mobile_number: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    blood_group: str | None = None
    nationality: str | None = None
    address_line_1: str | None = None
    address_line_2: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    country: str | None = None


class StudentApplicantResponse(StudentApplicantBase):
    id: str
    title: str | None = None
    application_date: date | None = None
    application_status: str = "Applied"

    class Config:
        from_attributes = True
