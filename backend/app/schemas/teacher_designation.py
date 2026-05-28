"""Teacher designation schemas."""
from pydantic import BaseModel, Field


class TeacherDesignationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str | None = Field(default=None, max_length=20)
    is_active: bool = True


class TeacherDesignationCreate(TeacherDesignationBase):
    pass


class TeacherDesignationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, max_length=20)
    is_active: bool | None = None


class TeacherDesignationResponse(TeacherDesignationBase):
    id: str
    teacher_count: int = 0

    class Config:
        from_attributes = True
