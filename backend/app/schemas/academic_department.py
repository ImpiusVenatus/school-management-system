"""Academic department schemas."""
from pydantic import BaseModel, Field


class AcademicDepartmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str | None = Field(default=None, max_length=20)
    is_active: bool = True


class AcademicDepartmentCreate(AcademicDepartmentBase):
    pass


class AcademicDepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, max_length=20)
    is_active: bool | None = None


class AcademicDepartmentResponse(AcademicDepartmentBase):
    id: str
    subject_count: int = 0

    class Config:
        from_attributes = True
