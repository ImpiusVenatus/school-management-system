"""RBAC API schemas."""
from pydantic import BaseModel, Field


class PermissionResponse(BaseModel):
    id: str
    code: str
    description: str | None = None

    class Config:
        from_attributes = True


class RoleResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    is_system: bool = False
    permission_codes: list[str] = []

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: str | None = None
    permission_codes: list[str] = []


class RoleUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    description: str | None = None
    permission_codes: list[str] | None = None


class UserRoleSummary(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    is_superuser: bool = False
    role_names: list[str] = []


class SetUserRolesRequest(BaseModel):
    role_ids: list[str] = []
