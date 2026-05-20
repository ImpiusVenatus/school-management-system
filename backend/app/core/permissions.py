"""Permission helpers for RBAC."""
from sqlalchemy.orm import Session
from app.models import User, Role, Permission


def get_user_permission_codes(db: Session, user: User) -> list[str]:
    if user.is_superuser:
        return ["*"]
    codes: set[str] = set()
    for role in user.roles:
        for perm in role.permissions:
            codes.add(perm.code)
    return sorted(codes)


def user_has_permission(db: Session, user: User, code: str) -> bool:
    if user.is_superuser:
        return True
    codes = get_user_permission_codes(db, user)
    if "*" in codes:
        return True
    return code in codes
