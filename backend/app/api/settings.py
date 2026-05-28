"""Settings API: get/update school profile (authenticated; PATCH requires permission)."""

import json
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db

from app.models import EducationSettings, User, AcademicYear

from app.models.program_course import Program, Course

from app.models.student_group import StudentGroup

from app.models.enrollment import ProgramEnrollment

from app.models.k12 import K12Class, K12Section, K12Subject, K12StudentEnrollment

from app.schemas.settings import (
    SettingsResponse,
    SettingsUpdate,
    SchoolTypeImpactResponse,
    NotificationConfigResponse,
    NotificationConfigUpdate,
)

from app.core.auth import get_current_user
from app.core.currencies import currency_choices, normalize_currency_code
from app.core.permissions import user_has_permission



router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULT_NOTIFICATION_CONFIG = {
    "channels": {
        "in_app": {"enabled": True, "label": "In-app"},
        "email": {"enabled": True, "label": "Email", "provider": "SMTP"},
        "sms": {"enabled": True, "label": "SMS", "provider": "Twilio"},
        "push": {"enabled": True, "label": "Push"},
        "whatsapp": {"enabled": False, "label": "WhatsApp"},
    },
    "events": [
        {"id": "attendance.absence", "category": "Attendance", "name": "Daily absence", "audience": "Guardian", "channels": ["sms", "email"], "enabled": True},
        {"id": "fees.invoice", "category": "Fees", "name": "Invoice generated", "audience": "Guardian", "channels": ["email", "in_app"], "enabled": True},
        {"id": "academic.marks", "category": "Academic", "name": "Marks published", "audience": "Guardian", "channels": ["in_app", "email"], "enabled": True},
        {"id": "admin.notice", "category": "Admin", "name": "Notice published", "audience": "All", "channels": ["in_app", "push"], "enabled": True},
    ],
}


def _load_notification_config(row: EducationSettings) -> NotificationConfigResponse:
    if row.notification_config:
        try:
            data = json.loads(row.notification_config)
            return NotificationConfigResponse(
                channels=data.get("channels", DEFAULT_NOTIFICATION_CONFIG["channels"]),
                events=data.get("events", DEFAULT_NOTIFICATION_CONFIG["events"]),
            )
        except json.JSONDecodeError:
            pass
    return NotificationConfigResponse(**DEFAULT_NOTIFICATION_CONFIG)





def _get_or_create_settings(db: Session) -> EducationSettings:

    row = db.query(EducationSettings).first()

    if not row:

        row = EducationSettings(id="Education Settings")

        db.add(row)

        db.commit()

        db.refresh(row)

    return row


def _require_settings_manage(current_user: User, db: Session) -> None:
    if current_user.is_superuser:
        return
    if not user_has_permission(db, current_user, "settings.manage"):
        raise HTTPException(status_code=403, detail="Missing permission: settings.manage")


class HolidayRow(BaseModel):
    id: str
    academic_year_id: str
    date: str
    name: str
    is_non_working: bool = True


class HolidayCreate(BaseModel):
    academic_year_id: str
    date: str
    name: str = Field(min_length=1, max_length=120)
    is_non_working: bool = True


class HolidayUpdate(BaseModel):
    date: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_non_working: bool | None = None


class PromotionPlan(BaseModel):
    academic_year_id: str
    auto_promote: bool = False
    fee_carry_forward: bool = False
    year_close_enabled: bool = False


def _load_holidays(row: EducationSettings) -> list[dict]:
    if not row.holidays_json:
        return []
    try:
        data = json.loads(row.holidays_json)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _save_holidays(row: EducationSettings, holidays: list[dict]) -> None:
    row.holidays_json = json.dumps(holidays)


def _load_promotion_plans(row: EducationSettings) -> dict[str, dict]:
    if not row.promotion_plan_json:
        return {}
    try:
        data = json.loads(row.promotion_plan_json)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def _save_promotion_plans(row: EducationSettings, plans: dict[str, dict]) -> None:
    row.promotion_plan_json = json.dumps(plans)


def _validate_iso_date(value: str) -> None:
    try:
        date.fromisoformat(value)
    except Exception:
        raise HTTPException(status_code=400, detail="date must be ISO format YYYY-MM-DD")


@router.get("/holidays", response_model=list[HolidayRow])
def list_holidays(
    academic_year_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    row = _get_or_create_settings(db)
    items = [HolidayRow.model_validate(h) for h in _load_holidays(row) if h.get("academic_year_id") == academic_year_id]
    items.sort(key=lambda x: x.date)
    return items


@router.post("/holidays", response_model=HolidayRow)
def create_holiday(
    body: HolidayCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_settings_manage(current_user, db)
    if not db.query(AcademicYear).filter(AcademicYear.id == body.academic_year_id).first():
        raise HTTPException(status_code=404, detail="Academic year not found")
    _validate_iso_date(body.date)
    row = _get_or_create_settings(db)
    holidays = _load_holidays(row)
    hid = f"HOL-{uuid.uuid4().hex[:10]}"
    rec = {
        "id": hid,
        "academic_year_id": body.academic_year_id,
        "date": body.date,
        "name": body.name.strip(),
        "is_non_working": bool(body.is_non_working),
    }
    holidays.append(rec)
    _save_holidays(row, holidays)
    db.commit()
    db.refresh(row)
    return HolidayRow.model_validate(rec)


@router.patch("/holidays/{holiday_id}", response_model=HolidayRow)
def update_holiday(
    holiday_id: str,
    body: HolidayUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_settings_manage(current_user, db)
    row = _get_or_create_settings(db)
    holidays = _load_holidays(row)
    found = None
    for h in holidays:
        if h.get("id") == holiday_id:
            found = h
            break
    if not found:
        raise HTTPException(status_code=404, detail="Holiday not found")
    if body.date is not None:
        _validate_iso_date(body.date)
        found["date"] = body.date
    if body.name is not None:
        found["name"] = body.name.strip()
    if body.is_non_working is not None:
        found["is_non_working"] = bool(body.is_non_working)
    _save_holidays(row, holidays)
    db.commit()
    db.refresh(row)
    return HolidayRow.model_validate(found)


@router.delete("/holidays/{holiday_id}")
def delete_holiday(
    holiday_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_settings_manage(current_user, db)
    row = _get_or_create_settings(db)
    holidays = _load_holidays(row)
    kept = [h for h in holidays if h.get("id") != holiday_id]
    if len(kept) == len(holidays):
        raise HTTPException(status_code=404, detail="Holiday not found")
    _save_holidays(row, kept)
    db.commit()
    return {"message": "Deleted"}


@router.get("/promotion-plan", response_model=PromotionPlan)
def get_promotion_plan(
    academic_year_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    row = _get_or_create_settings(db)
    plans = _load_promotion_plans(row)
    raw = plans.get(academic_year_id) or {"academic_year_id": academic_year_id}
    return PromotionPlan.model_validate(raw)


@router.put("/promotion-plan", response_model=PromotionPlan)
def set_promotion_plan(
    body: PromotionPlan,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_settings_manage(current_user, db)
    if not db.query(AcademicYear).filter(AcademicYear.id == body.academic_year_id).first():
        raise HTTPException(status_code=404, detail="Academic year not found")
    row = _get_or_create_settings(db)
    plans = _load_promotion_plans(row)
    plans[body.academic_year_id] = body.model_dump()
    _save_promotion_plans(row, plans)
    db.commit()
    db.refresh(row)
    return body





def _to_response(row: EducationSettings) -> SettingsResponse:

    return SettingsResponse(

        school_name=row.school_college_name_abbreviation,

        school_logo=row.school_college_logo,

        school_type=row.school_type or "program",

        current_academic_year_id=row.current_academic_year_id,

        current_academic_term_id=row.current_academic_term_id,

        academic_year_start_month=row.academic_year_start_month or 1,

        school_code=row.school_code,

        tagline=row.tagline,

        affiliation_board=row.affiliation_board,

        registration_number=row.registration_number,

        recognition_year=row.recognition_year,

        address=row.address,

        phone=row.phone,

        email=row.email,

        website=row.website,

        brand_color=row.brand_color,
        currency_code=normalize_currency_code(getattr(row, "currency_code", None)),
    )





@router.get("", response_model=SettingsResponse)

def get_settings(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    return _to_response(_get_or_create_settings(db))


@router.get("/currencies")
def list_currencies(current_user: User = Depends(get_current_user)):
    return currency_choices()


def _program_data_counts(db: Session) -> dict[str, int]:

    return {

        "programs": db.query(Program).count(),

        "student_groups": db.query(StudentGroup).count(),

        "courses": db.query(Course).count(),

        "program_enrollments": db.query(ProgramEnrollment).count(),

    }





def _k12_data_counts(db: Session) -> dict[str, int]:

    return {

        "classes": db.query(K12Class).count(),

        "sections": db.query(K12Section).count(),

        "subjects": db.query(K12Subject).count(),

        "enrollments": db.query(K12StudentEnrollment).count(),

    }





def _build_type_change_warnings(current: str, target: str, program: dict[str, int], k12: dict[str, int]) -> list[str]:

    if current == target:

        return []

    warnings: list[str] = []

    if current == "program" and target == "k12":

        if program["student_groups"] or program["programs"] or program["program_enrollments"]:

            warnings.append(

                "Program-based data (classes/sections, programs, enrollments) will remain in the database "

                "but will be hidden from the sidebar. K-12 screens start empty until you add K-12 classes."

            )

        if program["courses"]:

            warnings.append(f"You have {program['courses']} subject(s) in the program model; they are not linked to K-12 subjects automatically.")

    elif current == "k12" and target == "program":

        if k12["classes"] or k12["sections"] or k12["enrollments"]:

            warnings.append(

                "K-12 data (classes, sections, enrollments) will remain in the database "

                "but will be hidden from the sidebar. Program-based screens use student groups and programs."

            )

        if k12["subjects"]:

            warnings.append(f"You have {k12['subjects']} K-12 subject(s); they are not migrated to program courses.")

    warnings.append("Switching type does not delete or convert existing records. Change only when you understand both models can coexist.")

    return warnings





@router.get("/type-change-impact", response_model=SchoolTypeImpactResponse)

def school_type_change_impact(

    target: str = Query(..., description="program or k12"),

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    if not current_user.is_superuser and not user_has_permission(db, current_user, "settings.manage"):

        raise HTTPException(status_code=403, detail="Only admins can preview school type changes")

    if target not in ("program", "k12"):

        raise HTTPException(status_code=400, detail="target must be program or k12")

    row = _get_or_create_settings(db)

    current = row.school_type or "program"

    program = _program_data_counts(db)

    k12 = _k12_data_counts(db)

    return SchoolTypeImpactResponse(

        current_school_type=current,

        target_school_type=target,

        program_data=program,

        k12_data=k12,

        warnings=_build_type_change_warnings(current, target, program, k12),

    )





_PROFILE_FIELDS = (

    "school_code",

    "tagline",

    "affiliation_board",

    "registration_number",

    "recognition_year",

    "address",

    "phone",

    "email",

    "website",

    "brand_color",

)





@router.patch("", response_model=SettingsResponse)

def update_settings(

    body: SettingsUpdate,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    if not current_user.is_superuser and not user_has_permission(db, current_user, "settings.manage"):

        raise HTTPException(status_code=403, detail="Only admin can update settings")

    row = _get_or_create_settings(db)

    if body.school_name is not None:

        row.school_college_name_abbreviation = body.school_name

    if body.school_logo is not None:

        row.school_college_logo = body.school_logo

    if body.school_type is not None and body.school_type in ("program", "k12"):

        row.school_type = body.school_type

    if body.current_academic_year_id is not None:

        year = db.query(AcademicYear).filter(AcademicYear.id == body.current_academic_year_id).first()

        if not year:

            raise HTTPException(status_code=400, detail="Academic year not found")

        for y in db.query(AcademicYear).all():

            y.status = "active" if y.id == body.current_academic_year_id else (

                "closed" if y.status == "active" else y.status

            )

        row.current_academic_year_id = body.current_academic_year_id

    if body.academic_year_start_month is not None:

        if body.academic_year_start_month not in range(1, 13):

            raise HTTPException(status_code=400, detail="academic_year_start_month must be 1-12")

        row.academic_year_start_month = body.academic_year_start_month

    for field in _PROFILE_FIELDS:

        value = getattr(body, field, None)

        if value is not None:

            setattr(row, field, value.strip() if isinstance(value, str) else value)

    if body.currency_code is not None:
        row.currency_code = normalize_currency_code(body.currency_code)

    db.commit()

    db.refresh(row)

    return _to_response(row)


@router.get("/notifications", response_model=NotificationConfigResponse)
def get_notification_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _load_notification_config(_get_or_create_settings(db))


@router.patch("/notifications", response_model=NotificationConfigResponse)
def update_notification_settings(
    body: NotificationConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superuser and not user_has_permission(db, current_user, "settings.manage"):
        raise HTTPException(status_code=403, detail="Only admin can update notification settings")
    row = _get_or_create_settings(db)
    current = _load_notification_config(row).model_dump()
    if body.channels is not None:
        current["channels"] = {**current.get("channels", {}), **body.channels}
    if body.events is not None:
        current["events"] = body.events
    row.notification_config = json.dumps(current)
    db.commit()
    db.refresh(row)
    return _load_notification_config(row)

