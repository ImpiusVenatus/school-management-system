"""First-run setup: school name, logo, first admin. Only when not yet configured."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, EducationSettings
from app.schemas.settings import SetupStatusResponse, SetupRequest
from app.schemas.auth import Token, UserResponse
from app.core.security import get_password_hash, create_access_token
from app.core.permission_catalog import ensure_permission_catalog

router = APIRouter(prefix="/setup", tags=["setup"])


def is_configured(db: Session) -> bool:
    """True if there is at least one superuser and settings have school name."""
    has_superuser = db.query(User).filter(User.is_superuser == True).first() is not None
    settings = db.query(EducationSettings).first()
    has_name = settings and (settings.school_college_name_abbreviation or "").strip() != ""
    return bool(has_superuser and has_name)


@router.get("/status", response_model=SetupStatusResponse)
def setup_status(db: Session = Depends(get_db)):
    """Returns configured: true if school has been set up (first admin + school name)."""
    settings = db.query(EducationSettings).first()
    school_name = None
    if settings and (settings.school_college_name_abbreviation or "").strip():
        school_name = settings.school_college_name_abbreviation.strip()
    return SetupStatusResponse(configured=is_configured(db), school_name=school_name)


@router.post("/", response_model=Token)
def setup(body: SetupRequest, db: Session = Depends(get_db)):
    """Create school settings and first admin. Only allowed when not yet configured."""
    if is_configured(db):
        raise HTTPException(status_code=400, detail="School is already configured")
    if db.query(User).filter(User.email == body.admin_email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    # Create or update EducationSettings
    settings = db.query(EducationSettings).first()
    if not settings:
        settings = EducationSettings(id="Education Settings")
        db.add(settings)
    settings.school_college_name_abbreviation = body.school_name
    settings.school_college_logo = body.school_logo or None
    settings.school_type = body.school_type if body.school_type in ("program", "k12") else "program"
    settings.currency_code = "BDT"
    # Create first admin user
    user = User(
        id=str(uuid.uuid4()),
        email=body.admin_email,
        hashed_password=get_password_hash(body.admin_password),
        full_name=body.admin_full_name,
        is_active=True,
        is_superuser=True,
        role="admin",
    )
    db.add(user)
    ensure_permission_catalog(db)
    db.commit()
    db.refresh(user)
    token = create_access_token(data={"sub": user.id})
    return Token(access_token=token)
