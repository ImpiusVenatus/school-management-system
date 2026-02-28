"""Settings and setup schemas."""
from pydantic import BaseModel


class SettingsResponse(BaseModel):
    school_name: str | None = None
    school_logo: str | None = None
    current_academic_year_id: str | None = None
    current_academic_term_id: str | None = None


class SettingsUpdate(BaseModel):
    school_name: str | None = None
    school_logo: str | None = None


class SetupStatusResponse(BaseModel):
    configured: bool


class SetupRequest(BaseModel):
    school_name: str
    school_logo: str | None = None
    admin_email: str
    admin_password: str
    admin_full_name: str
