"""Auth schemas (in-house login only)."""
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class TokenPayload(BaseModel):
    sub: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    role: str = "user"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    is_active: bool
    role: str
    is_superuser: bool = False
    roles: list[str] = []
    permission_codes: list[str] = []

    class Config:
        from_attributes = True
