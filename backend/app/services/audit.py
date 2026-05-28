"""Record and classify audit events."""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.models import AuditLog, User

SENSITIVE_KEYS = {
    "password",
    "hashed_password",
    "token",
    "refresh_token",
    "access_token",
    "secret",
    "authorization",
}

SKIP_PATH_PREFIXES = (
    "/docs",
    "/openapi.json",
    "/redoc",
    "/health",
)

SKIP_LOG_PATHS = (
    "/api/audit/logs",
)

MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

# Friendly labels for common API areas
AREA_LABELS: dict[str, str] = {
    "auth": "Authentication",
    "settings": "School settings",
    "academic": "Academic",
    "k12": "Classes & K-12",
    "fees": "Fees",
    "assessment": "Grade scales",
    "students": "Students",
    "rbac": "Roles & permissions",
    "instructors": "Teachers",
    "attendance": "Attendance",
    "notices": "Notices",
    "clubs": "Clubs",
    "invoices": "Invoices",
    "enrollment": "Enrollment",
    "programs": "Programs",
    "courses": "Courses",
    "applicants": "Admissions",
    "guardians": "Guardians",
    "rooms": "Rooms",
    "files": "Files",
    "setup": "Setup",
}


def _new_id() -> str:
    return f"AUD-{uuid.uuid4().hex[:12]}"


def _sanitize_value(key: str, value: Any) -> Any:
    if key.lower() in SENSITIVE_KEYS:
        return "[redacted]"
    if isinstance(value, str) and len(value) > 500:
        return value[:500] + "…"
    return value


def sanitize_payload(data: Any) -> Any:
    if isinstance(data, dict):
        return {k: sanitize_payload(_sanitize_value(k, v)) for k, v in data.items()}
    if isinstance(data, list):
        return [sanitize_payload(v) for v in data[:50]]
    return data


def resolve_user_from_request(db: Session, request: Request) -> User | None:
    auth = request.headers.get("authorization") or ""
    if not auth.lower().startswith("bearer "):
        return None
    token = auth[7:].strip()
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


def _actor_role(user: User | None) -> str | None:
    if not user:
        return None
    if user.is_superuser:
        return "super_admin"
    if user.roles:
        return user.roles[0].name
    return user.role


def _action_from_request(method: str, path: str) -> str:
    clean = path.split("?")[0].rstrip("/")
    parts = [p for p in clean.split("/") if p and p != "api"]
    if not parts:
        return f"{method.lower()}.request"
    area = parts[0]
    rest = parts[1:]
    verb = {
        "POST": "create",
        "PUT": "update",
        "PATCH": "update",
        "DELETE": "delete",
        "GET": "read",
    }.get(method, method.lower())
    if area == "auth":
        if rest:
            return f"auth.{rest[0]}"
        return f"auth.{verb}"
    if len(rest) >= 2 and rest[-1] not in ("available", "board", "clone-year", "settings-page", "subjects-page"):
        resource_id = rest[-1]
        resource_type = rest[-2] if len(rest) >= 2 else rest[0]
        return f"{area}.{resource_type}.{verb}"
    if rest:
        return f"{area}.{'.'.join(rest)}.{verb}" if verb not in rest else f"{area}.{'.'.join(rest)}"
    return f"{area}.{verb}"


def _category_for_action(action: str, path: str, status_code: int | None) -> str:
    al = action.lower()
    if "login_failed" in al or (al.startswith("auth.login") and status_code == 401):
        return "security"
    if al.startswith("auth."):
        return "auth"
    if status_code and status_code >= 500:
        return "system"
    if any(x in path for x in ("/settings", "/rbac", "/assessment/grading-scales")):
        return "admin"
    if al.startswith("auth.") or "backup" in al:
        return "system"
    return "write"


def _resource_from_path(path: str) -> tuple[str | None, str | None, str]:
    clean = path.split("?")[0].rstrip("/")
    parts = [p for p in clean.split("/") if p and p != "api"]
    if not parts:
        return None, None, "API"
    area = parts[0]
    area_label = AREA_LABELS.get(area, area.replace("-", " ").title())
    resource_id = None
    resource_type = area
    if len(parts) >= 2:
        tail = parts[1:]
        # id-like segment (CLS-, STU-, GSC-, etc.)
        for i, seg in enumerate(tail):
            if re.match(r"^[A-Z]{2,5}-", seg) or re.match(
                r"^[0-9a-f]{8}-[0-9a-f]{4}-", seg, re.I
            ):
                resource_id = seg
                if i > 0:
                    resource_type = tail[i - 1]
                break
        if not resource_id and tail[-1] not in (
            "available",
            "board",
            "categories",
            "structures",
            "notifications",
            "subjects",
            "classes",
            "years",
            "departments",
        ):
            if tail[-1] not in ("login", "logout", "refresh", "register", "me"):
                resource_type = "/".join(tail)
    label = area_label
    if resource_id:
        label = f"{area_label} · {resource_id}"
    elif len(parts) > 1:
        label = f"{area_label} · {' / '.join(parts[1:])}"
    return resource_type, resource_id, label


_ACTION_LABELS: dict[str, str] = {
    "auth.login": "Signed in",
    "auth.login_failed": "Failed sign-in",
    "auth.logout": "Signed out",
    "auth.register": "New account registered",
}


def humanize_action(action: str) -> str:
    if action in _ACTION_LABELS:
        return _ACTION_LABELS[action]
    parts = action.split(".")
    verb = parts[-1] if parts else action
    verb_map = {
        "create": "Created",
        "update": "Updated",
        "delete": "Deleted",
        "read": "Viewed",
    }
    if verb in verb_map and len(parts) >= 2:
        subject = " ".join(parts[:-1]).replace("_", " ")
        return f"{verb_map[verb]} {subject}"
    return action.replace(".", " · ").replace("_", " ").title()


def record_audit(
    db: Session,
    *,
    action: str,
    category: str | None = None,
    user: User | None = None,
    actor_name: str | None = None,
    actor_role: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    resource_label: str | None = None,
    http_method: str | None = None,
    path: str | None = None,
    status_code: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    cat = category or _category_for_action(action, path or "", status_code)
    name = actor_name or (user.full_name if user else None) or (user.email if user else None) or "System"
    row = AuditLog(
        id=_new_id(),
        created_at=datetime.now(timezone.utc),
        user_id=user.id if user else None,
        actor_name=name,
        actor_role=actor_role or _actor_role(user),
        action=action,
        category=cat,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_label=resource_label,
        http_method=http_method,
        path=path,
        status_code=status_code,
        ip_address=ip_address,
        user_agent=(user_agent or "")[:300] or None,
        details_json=json.dumps(sanitize_payload(details)) if details else None,
    )
    db.add(row)
    db.commit()
    return row


def record_request_audit(
    db: Session,
    request: Request,
    *,
    status_code: int,
    user: User | None = None,
    extra_details: dict[str, Any] | None = None,
) -> None:
    path = request.url.path
    method = request.method.upper()
    if method not in MUTATING_METHODS:
        return
    if any(path.startswith(p) for p in SKIP_PATH_PREFIXES):
        return
    if path in SKIP_LOG_PATHS or path.startswith("/api/audit/"):
        return

    action = _action_from_request(method, path)
    rtype, rid, rlabel = _resource_from_path(path)
    details: dict[str, Any] = {"query": dict(request.query_params)}
    if extra_details:
        details.update(extra_details)

    client = request.client.host if request.client else None
    forwarded = request.headers.get("x-forwarded-for")
    ip = (forwarded.split(",")[0].strip() if forwarded else None) or client

    record_audit(
        db,
        action=action,
        user=user,
        resource_type=rtype,
        resource_id=rid,
        resource_label=rlabel,
        http_method=method,
        path=path,
        status_code=status_code,
        ip_address=ip,
        user_agent=request.headers.get("user-agent"),
        details=details,
    )


def should_audit_request(method: str, path: str) -> bool:
    if method not in MUTATING_METHODS:
        return False
    if path == "/":
        return False
    if any(path.startswith(p) for p in SKIP_PATH_PREFIXES):
        return False
    if path.startswith("/api/audit/"):
        return False
    return path.startswith("/api")
