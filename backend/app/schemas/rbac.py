"""RBAC API schemas."""
from pydantic import BaseModel, Field


class PermissionResponse(BaseModel):
    id: str
    code: str
    description: str | None = None
    group: str | None = None
    action: str | None = None

    class Config:
        from_attributes = True


class RoleResponse(BaseModel):
    id: str
    name: str
    display_name: str | None = None
    description: str | None = None
    is_system: bool = False
    scoped_to_assigned_sections: bool = False
    permission_codes: list[str] = []
    user_count: int = 0

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    display_name: str | None = Field(None, max_length=100)
    description: str | None = None
    permission_codes: list[str] = []
    scoped_to_assigned_sections: bool = False


class RoleUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    display_name: str | None = Field(None, max_length=100)
    description: str | None = None
    permission_codes: list[str] | None = None
    scoped_to_assigned_sections: bool | None = None


class UserRoleSummary(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    is_superuser: bool = False
    role_names: list[str] = []


class SetUserRolesRequest(BaseModel):
    role_ids: list[str] = []
