"""Auth dependency: get current user from JWT (in-house only)."""
import time

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import User, Role
from app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
http_bearer = HTTPBearer(auto_error=False)

_USER_CACHE_TTL_SEC = 60.0
_user_cache: dict[str, tuple[User, float]] = {}


def _cache_get_user(user_id: str) -> User | None:
    entry = _user_cache.get(user_id)
    if not entry:
        return None
    user, expires_at = entry
    if expires_at <= time.monotonic():
        _user_cache.pop(user_id, None)
        return None
    return user


def _load_user(db: Session, user_id: str) -> User | None:
    return (
        db.query(User)
        .options(joinedload(User.roles).joinedload(Role.permissions))
        .filter(User.id == user_id)
        .first()
    )


def _cache_set_user(db: Session, user: User) -> None:
    """Detach user with attributes (and roles) loaded so cache survives session close."""
    _ = user.id, user.email, user.full_name, user.is_active, user.is_superuser, user.role
    if not user.is_superuser:
        for role in user.roles:
            for perm in role.permissions:
                _ = perm.code
    db.expunge(user)
    _user_cache[user.id] = (user, time.monotonic() + _USER_CACHE_TTL_SEC)


def get_current_user(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    cached = _cache_get_user(user_id)
    if cached:
        if not cached.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")
        return cached
    user = _load_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")
    _cache_set_user(db, user)
    return user


def require_permission(code: str):
    from app.core.permissions import user_has_permission

    def checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not user_has_permission(db, current_user, code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {code}",
            )
        return current_user

    return checker


def get_current_user_optional(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
) -> User | None:
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    cached = _cache_get_user(user_id)
    if cached:
        return cached
    user = _load_user(db, user_id)
    if user:
        _cache_set_user(db, user)
    return user
