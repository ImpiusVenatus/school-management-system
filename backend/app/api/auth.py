"""In-house auth: login, refresh, logout, register, me."""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, RefreshToken
from app.schemas.auth import Token, TokenRefreshRequest, UserCreate, UserResponse
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token_value,
    hash_refresh_token,
)
from app.core.auth import get_current_user
from app.core.permissions import get_user_permission_codes
from app.config import get_settings
from app.services.audit import record_audit

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _user_response(db: Session, user: User) -> UserResponse:
    role_names = [r.name for r in user.roles]
    if not role_names and user.role:
        role_names = [user.role]
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        role=user.role,
        is_superuser=user.is_superuser,
        roles=role_names,
        permission_codes=get_user_permission_codes(db, user),
    )


def _issue_tokens(db: Session, user: User) -> Token:
    perms = get_user_permission_codes(db, user)
    roles = [r.name for r in user.roles] or ([user.role] if user.role else [])
    access = create_access_token(
        {"sub": user.id},
        extra={"roles": roles, "permission_codes": perms},
    )
    refresh_value = create_refresh_token_value()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(RefreshToken(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token_hash=hash_refresh_token(refresh_value),
        expires_at=expires,
    ))
    db.commit()
    return Token(access_token=access, refresh_token=refresh_value)


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        try:
            record_audit(
                db,
                action="auth.login_failed",
                category="security",
                actor_name=form.username,
                actor_role="—",
                resource_label="Sign in",
                http_method="POST",
                path="/api/auth/login",
                status_code=401,
                ip_address=_client_ip(request),
                user_agent=request.headers.get("user-agent"),
            )
        except Exception:
            db.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")
    tokens = _issue_tokens(db, user)
    try:
        record_audit(
            db,
            action="auth.login",
            category="auth",
            user=user,
            resource_label="Sign in",
            http_method="POST",
            path="/api/auth/login",
            status_code=200,
            ip_address=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    except Exception:
        db.rollback()
    return tokens


@router.post("/refresh", response_model=Token)
def refresh_token(body: TokenRefreshRequest, db: Session = Depends(get_db)):
    token_hash = hash_refresh_token(body.refresh_token)
    row = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked_at.is_(None),
    ).first()
    expires_at = getattr(row, "expires_at", None) if row else None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not row or (expires_at and expires_at < datetime.now(timezone.utc)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = db.query(User).filter(User.id == row.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")
    row.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return _issue_tokens(db, user)


@router.post("/logout")
def logout(body: TokenRefreshRequest, db: Session = Depends(get_db)):
    token_hash = hash_refresh_token(body.refresh_token)
    row = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if row:
        row.revoked_at = datetime.now(timezone.utc)
        db.commit()
    return {"message": "Logged out"}


@router.post("/register", response_model=UserResponse)
def register(
    body: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only superuser can register users")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    try:
        hashed = get_password_hash(body.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    user = User(
        id=str(uuid.uuid4()),
        email=body.email,
        hashed_password=hashed,
        full_name=body.full_name,
        role=body.role or "user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_response(db, user)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _user_response(db, current_user)
