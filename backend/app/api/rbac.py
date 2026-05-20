"""Roles & permissions management (superuser / roles.manage)."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Role, Permission, User
from app.schemas.rbac import (
    PermissionResponse,
    RoleResponse,
    RoleCreate,
    RoleUpdate,
    UserRoleSummary,
    SetUserRolesRequest,
)
from app.core.auth import get_current_user
from app.core.permissions import user_has_permission
from app.core.permission_catalog import ensure_permission_catalog, PERMISSION_CATALOG

router = APIRouter(prefix="/rbac", tags=["rbac"])


def _require_roles_access(user: User, db: Session, write: bool = False) -> None:
    if user.is_superuser:
        return
    code = "roles.manage" if write else "roles.read"
    if not user_has_permission(db, user, code):
        raise HTTPException(status_code=403, detail=f"Missing permission: {code}")


def _role_to_response(role: Role) -> RoleResponse:
    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        permission_codes=sorted(p.code for p in role.permissions),
    )


@router.get("/permissions", response_model=list[PermissionResponse])
def list_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_roles_access(current_user, db)
    ensure_permission_catalog(db)
    db.commit()
    rows = db.query(Permission).order_by(Permission.code).all()
    return [PermissionResponse(id=r.id, code=r.code, description=r.description) for r in rows]


@router.get("/permissions/catalog")
def permission_catalog(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Grouped catalog for UI (code + description)."""
    _require_roles_access(current_user, db)
    return [{"code": c, "description": d} for c, d in PERMISSION_CATALOG]


@router.get("/roles", response_model=list[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_roles_access(current_user, db)
    rows = db.query(Role).order_by(Role.name).all()
    return [_role_to_response(r) for r in rows]


def _resolve_permissions(db: Session, codes: list[str]) -> list[Permission]:
    ensure_permission_catalog(db)
    perms = []
    for code in codes:
        if code == "*":
            p = db.query(Permission).filter(Permission.code == "*").first()
            if not p:
                p = Permission(id=str(uuid.uuid4()), code="*", description="All permissions")
                db.add(p)
                db.flush()
            perms.append(p)
            continue
        p = db.query(Permission).filter(Permission.code == code).first()
        if not p:
            raise HTTPException(status_code=400, detail=f"Unknown permission: {code}")
        perms.append(p)
    return perms


@router.post("/roles", response_model=RoleResponse)
def create_role(
    body: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_roles_access(current_user, db, write=True)
    name = body.name.strip()
    if db.query(Role).filter(Role.name == name).first():
        raise HTTPException(status_code=400, detail="Role name already exists")
    role = Role(
        id=str(uuid.uuid4()),
        name=name,
        description=body.description,
        is_system=False,
    )
    role.permissions = _resolve_permissions(db, body.permission_codes)
    db.add(role)
    db.commit()
    db.refresh(role)
    return _role_to_response(role)


@router.patch("/roles/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: str,
    body: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_roles_access(current_user, db, write=True)
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if body.name is not None:
        other = db.query(Role).filter(Role.name == body.name.strip(), Role.id != role_id).first()
        if other:
            raise HTTPException(status_code=400, detail="Role name already exists")
        role.name = body.name.strip()
    if body.description is not None:
        role.description = body.description
    if body.permission_codes is not None:
        role.permissions = _resolve_permissions(db, body.permission_codes)
    db.commit()
    db.refresh(role)
    return _role_to_response(role)


@router.delete("/roles/{role_id}")
def delete_role(
    role_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_roles_access(current_user, db, write=True)
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be deleted")
    db.delete(role)
    db.commit()
    return {"message": "Deleted"}


@router.get("/users", response_model=list[UserRoleSummary])
def list_users_with_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_roles_access(current_user, db)
    users = db.query(User).order_by(User.email).all()
    return [
        UserRoleSummary(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            is_superuser=u.is_superuser,
            role_names=[r.name for r in u.roles],
        )
        for u in users
    ]


@router.put("/users/{user_id}/roles")
def set_user_roles(
    user_id: str,
    body: SetUserRolesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace a user's roles (superuser flag unchanged)."""
    _require_roles_access(current_user, db, write=True)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    role_ids = body.role_ids
    roles = db.query(Role).filter(Role.id.in_(role_ids)).all() if role_ids else []
    if len(roles) != len(role_ids):
        raise HTTPException(status_code=400, detail="One or more role ids invalid")
    user.roles = roles
    db.commit()
    return {"message": "Roles updated", "role_names": [r.name for r in roles]}
