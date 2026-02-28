"""Settings API: get/update school name and logo (authenticated; PATCH requires superuser)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import EducationSettings, User
from app.schemas.settings import SettingsResponse, SettingsUpdate
from app.core.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create_settings(db: Session) -> EducationSettings:
    row = db.query(EducationSettings).first()
    if not row:
        row = EducationSettings(id="Education Settings")
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("", response_model=SettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = _get_or_create_settings(db)
    return SettingsResponse(
        school_name=row.school_college_name_abbreviation,
        school_logo=row.school_college_logo,
        current_academic_year_id=row.current_academic_year_id,
        current_academic_term_id=row.current_academic_term_id,
    )


@router.patch("", response_model=SettingsResponse)
def update_settings(
    body: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only admin can update settings")
    row = _get_or_create_settings(db)
    if body.school_name is not None:
        row.school_college_name_abbreviation = body.school_name
    if body.school_logo is not None:
        row.school_college_logo = body.school_logo
    db.commit()
    db.refresh(row)
    return SettingsResponse(
        school_name=row.school_college_name_abbreviation,
        school_logo=row.school_college_logo,
        current_academic_year_id=row.current_academic_year_id,
        current_academic_term_id=row.current_academic_term_id,
    )
