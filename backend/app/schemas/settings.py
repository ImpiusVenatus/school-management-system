"""Settings and setup schemas."""

from typing import Any

from pydantic import BaseModel, Field





class SettingsResponse(BaseModel):

    school_name: str | None = None

    school_logo: str | None = None

    school_type: str = "program"

    current_academic_year_id: str | None = None

    current_academic_term_id: str | None = None

    academic_year_start_month: int = 1

    school_code: str | None = None

    tagline: str | None = None

    affiliation_board: str | None = None

    registration_number: str | None = None

    recognition_year: str | None = None

    address: str | None = None

    phone: str | None = None

    email: str | None = None

    website: str | None = None

    brand_color: str | None = None
    currency_code: str = "BDT"





class SettingsUpdate(BaseModel):

    school_name: str | None = None

    school_logo: str | None = None

    school_type: str | None = None

    current_academic_year_id: str | None = None

    academic_year_start_month: int | None = None

    school_code: str | None = None

    tagline: str | None = None

    affiliation_board: str | None = None

    registration_number: str | None = None

    recognition_year: str | None = None

    address: str | None = None

    phone: str | None = None

    email: str | None = None

    website: str | None = None

    brand_color: str | None = Field(default=None, max_length=20)
    currency_code: str | None = Field(default=None, min_length=3, max_length=3)





class SchoolTypeImpactResponse(BaseModel):

    current_school_type: str

    target_school_type: str

    program_data: dict[str, int]

    k12_data: dict[str, int]

    warnings: list[str]





class SetupStatusResponse(BaseModel):

    configured: bool

    school_name: str | None = None





class NotificationConfigUpdate(BaseModel):
    channels: dict[str, Any] | None = None
    events: list[dict[str, Any]] | None = None


class NotificationConfigResponse(BaseModel):
    channels: dict[str, Any] = Field(default_factory=dict)
    events: list[dict[str, Any]] = Field(default_factory=list)


class SetupRequest(BaseModel):

    school_name: str

    school_logo: str | None = None

    school_type: str = "program"

    admin_email: str

    admin_password: str

    admin_full_name: str

