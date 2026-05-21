"""Roles & permissions management (superuser / roles.manage)."""
import json
import threading
import uuid
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Role, Permission, User, user_roles
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
from app.core.permission_catalog import ensure_permission_catalog, catalog_for_ui
from app.core.rbac_seed import ensure_system_roles

router = APIRouter(prefix="/rbac", tags=["rbac"])

_rbac_lock = threading.Lock()
_rbac_initialized = False


def _ensure_rbac_initialized(db: Session) -> None:
    """Sync catalog and system roles once per process (avoids slow parallel reloads)."""
    global _rbac_initialized
    if _rbac_initialized:
        return
    with _rbac_lock:
        if _rbac_initialized:
            return
        ensure_permission_catalog(db)
        ensure_system_roles(db)
        db.commit()
        _rbac_initialized = True


def _require_roles_access(user: User, db: Session, write: bool = False) -> None:
    if user.is_superuser:
        return
    code = "roles.manage" if write else "roles.read"
    if not user_has_permission(db, user, code):
        raise HTTPException(status_code=403, detail=f"Missing permission: {code}")


def _role_to_response(role: Role, user_count: int = 0) -> RoleResponse:
    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name or role.name.replace("_", " ").title(),
        description=role.description,
        is_system=bool(role.is_system),
        scoped_to_assigned_sections=bool(role.scoped_to_assigned_sections),
        permission_codes=sorted(p.code for p in role.permissions),
        user_count=int(user_count),
    )


@router.get("/permissions", response_model=list[PermissionResponse])
def list_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_roles_access(current_user, db)
    _ensure_rbac_initialized(db)
    ui = {item["code"]: item for item in catalog_for_ui()}
    rows = db.query(Permission).order_by(Permission.code).all()
    out = []
    for r in rows:
        meta = ui.get(r.code, {})
        out.append(
            PermissionResponse(
                id=r.id,
                code=r.code,
                description=r.description,
                group=meta.get("group"),
                action=meta.get("action"),
            )
        )
    return out


@router.get("/permissions/catalog")
def permission_catalog(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_roles_access(current_user, db)
    return catalog_for_ui()


@router.get("/roles", response_model=list[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_roles_access(current_user, db)
    _ensure_rbac_initialized(db)
    rows = (
        db.query(Role)
        .options(joinedload(Role.permissions))
        .order_by(Role.is_system.desc(), Role.name)
        .all()
    )
    user_counts = {
        rid: int(cnt)
        for rid, cnt in db.query(user_roles.c.role_id, func.count(user_roles.c.user_id))
        .group_by(user_roles.c.role_id)
        .all()
    }
    return [_role_to_response(r, user_counts.get(r.id, 0)) for r in rows]


def _resolve_permissions(db: Session, codes: list[str]) -> list[Permission]:
    if "*" in codes:
        _ensure_rbac_initialized(db)
        return list(db.query(Permission).all())
    by_code = ensure_permission_catalog(db)
    perms = []
    for code in codes:
        p = by_code.get(code)
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
    name = body.name.strip().lower().replace(" ", "_")
    if db.query(Role).filter(Role.name == name).first():
        raise HTTPException(status_code=400, detail="Role name already exists")
    role = Role(
        id=str(uuid.uuid4()),
        name=name,
        display_name=(body.display_name or name.replace("_", " ").title()).strip(),
        description=body.description,
        is_system=False,
        scoped_to_assigned_sections=body.scoped_to_assigned_sections,
    )
    role.permissions = _resolve_permissions(db, body.permission_codes)
    db.add(role)
    db.commit()
    db.refresh(role)
    return _role_to_response(role, _user_count_for_role(db, role.id))


def _user_count_for_role(db: Session, role_id: str) -> int:
    return int(
        db.query(func.count(user_roles.c.user_id))
        .filter(user_roles.c.role_id == role_id)
        .scalar()
        or 0
    )


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
    if body.name is not None and not role.is_system:
        name = body.name.strip().lower().replace(" ", "_")
        other = db.query(Role).filter(Role.name == name, Role.id != role_id).first()
        if other:
            raise HTTPException(status_code=400, detail="Role name already exists")
        role.name = name
    if body.display_name is not None:
        role.display_name = body.display_name.strip() or None
    if body.description is not None:
        role.description = body.description
    if body.scoped_to_assigned_sections is not None:
        role.scoped_to_assigned_sections = body.scoped_to_assigned_sections
    if body.permission_codes is not None:
        role.permissions = _resolve_permissions(db, body.permission_codes)
    db.commit()
    db.refresh(role)
    return _role_to_response(role, _user_count_for_role(db, role.id))


@router.post("/roles/{role_id}/duplicate", response_model=RoleResponse)
def duplicate_role(
    role_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_roles_access(current_user, db, write=True)
    source = db.query(Role).filter(Role.id == role_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Role not found")
    base = f"copy_of_{source.name}"
    name = base
    n = 1
    while db.query(Role).filter(Role.name == name).first():
        n += 1
        name = f"{base}_{n}"
    role = Role(
        id=str(uuid.uuid4()),
        name=name,
        display_name=f"Copy of {source.display_name or source.name}",
        description=source.description,
        is_system=False,
        scoped_to_assigned_sections=source.scoped_to_assigned_sections,
    )
    role.permissions = list(source.permissions)
    db.add(role)
    db.commit()
    db.refresh(role)
    return _role_to_response(role, _user_count_for_role(db, role.id))


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


@router.get("/roles/export")
def export_roles_yaml(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_roles_access(current_user, db)
    rows = db.query(Role).order_by(Role.name).all()
    payload = [
        {
            "name": r.name,
            "display_name": r.display_name,
            "description": r.description,
            "is_system": r.is_system,
            "scoped_to_assigned_sections": r.scoped_to_assigned_sections,
            "permissions": sorted(p.code for p in r.permissions),
        }
        for r in rows
    ]
    try:
        import yaml

        body = yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)
        media = "application/x-yaml"
    except ImportError:
        body = json.dumps(payload, indent=2)
        media = "application/json"
    return Response(
        content=body,
        media_type=media,
        headers={"Content-Disposition": "attachment; filename=roles-export.yaml"},
    )


@router.get("/users", response_model=list[UserRoleSummary])
def list_users_with_roles(
    role_id: str | None = None,
    search: str | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_roles_access(current_user, db)
    limit = min(max(limit, 1), 500)
    q = db.query(User).options(joinedload(User.roles)).order_by(User.full_name, User.email)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter((User.full_name.ilike(term)) | (User.email.ilike(term)))
    if role_id:
        role = db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        q = q.filter(User.roles.any(Role.id == role_id))
    users = q.limit(limit).all()
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


@router.delete("/roles/{role_id}/users/{user_id}")
def remove_user_from_role(
    role_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_roles_access(current_user, db, write=True)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    user.roles = [r for r in user.roles if r.id != role_id]
    db.commit()
    return {"message": "User removed from role", "role_names": [r.name for r in user.roles]}
