"""Student, Guardian, StudentGuardian."""
from datetime import date
from pydantic import BaseModel, EmailStr


class StudentGuardianItem(BaseModel):
    guardian_id: str
    guardian_name: str | None = None
    relation: str | None = None


class StudentBase(BaseModel):
    first_name: str
    middle_name: str | None = None
    last_name: str | None = None
    student_email_id: EmailStr
    student_mobile_number: str | None = None
    date_of_birth: date | None = None
    blood_group: str | None = None
    gender: str | None = None
    nationality: str | None = None
    joining_date: date | None = None
    address_line_1: str | None = None
    address_line_2: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    country: str | None = None
    enabled: bool = True


class StudentCreate(StudentBase):
    guardians: list[StudentGuardianItem] = []


class StudentUpdate(BaseModel):
    first_name: str | None = None
    middle_name: str | None = None
    last_name: str | None = None
    student_mobile_number: str | None = None
    date_of_birth: date | None = None
    blood_group: str | None = None
    gender: str | None = None
    nationality: str | None = None
    address_line_1: str | None = None
    address_line_2: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    country: str | None = None
    enabled: bool | None = None
    date_of_leaving: date | None = None
    reason_for_leaving: str | None = None


class StudentResponse(StudentBase):
    id: str
    student_name: str | None = None
    guardians: list[StudentGuardianItem] = []

    class Config:
        from_attributes = True


class GuardianBase(BaseModel):
    guardian_name: str
    email_address: str | None = None
    mobile_number: str | None = None
    alternate_number: str | None = None
    relation: str | None = None


class GuardianCreate(GuardianBase):
    pass


class GuardianResponse(GuardianBase):
    id: str

    class Config:
        from_attributes = True
