"""Audit log read API and CSV export."""
import csv
import io
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.permissions import user_has_permission
from app.database import get_db
from app.models import AuditLog, User
from app.services.audit import humanize_action

router = APIRouter(prefix="/audit", tags=["audit"])


class AuditLogItem(BaseModel):
    id: str
    created_at: str
    time: str
    date_label: str
    actor: str
    role: str | None
    action: str
    action_label: str
    category: str
    resource: str
    resource_type: str | None
    resource_id: str | None
    ip: str | None
    status_code: int | None
    http_method: str | None
    path: str | None
    changes: list[str] = Field(default_factory=list)


class AuditLogListResponse(BaseModel):
    items: list[AuditLogItem]
    total: int
    page: int
    limit: int


class AuditStatsResponse(BaseModel):
    events_24h: int
    write_actions: int
    admin_events: int
    auth_events: int
    system_events: int
    security_events: int


def _require_audit_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if not current_user.is_superuser and not user_has_permission(db, current_user, "audit.read"):
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="Missing permission: audit.read")
    return current_user


def _since(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 365)))


def _format_row(row: AuditLog) -> AuditLogItem:
    dt = row.created_at
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    local = dt.astimezone(timezone.utc)
    changes: list[str] = []
    if row.details_json:
        try:
            data = json.loads(row.details_json)
            if isinstance(data.get("summary"), list):
                changes = [str(x) for x in data["summary"][:20]]
            elif data.get("query"):
                q = data["query"]
                if q:
                    changes.append(f"Query: {', '.join(f'{k}={v}' for k, v in list(q.items())[:5])}")
        except json.JSONDecodeError:
            pass

    return AuditLogItem(
        id=row.id,
        created_at=local.isoformat(),
        time=local.strftime("%H:%M:%S"),
        date_label=local.strftime("%b %d, %Y"),
        actor=row.actor_name,
        role=row.actor_role,
        action=row.action,
        action_label=humanize_action(row.action),
        category=row.category,
        resource=row.resource_label or row.resource_id or "—",
        resource_type=row.resource_type,
        resource_id=row.resource_id,
        ip=row.ip_address or "—",
        status_code=row.status_code,
        http_method=row.http_method,
        path=row.path,
        changes=changes,
    )


@router.get("/logs", response_model=AuditLogListResponse)
def list_audit_logs(
    days: int = Query(7, ge=1, le=365),
    category: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(_require_audit_read),
):
    since = _since(days)
    q = db.query(AuditLog).filter(AuditLog.created_at >= since)
    if category:
        q = q.filter(AuditLog.category == category)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(
            (AuditLog.actor_name.ilike(term))
            | (AuditLog.action.ilike(term))
            | (AuditLog.resource_label.ilike(term))
            | (AuditLog.resource_id.ilike(term))
            | (AuditLog.path.ilike(term))
        )
    total = q.count()
    rows = (
        q.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return AuditLogListResponse(
        items=[_format_row(r) for r in rows],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/stats", response_model=AuditStatsResponse)
def audit_stats(
    days: int = Query(7, ge=1, le=365),
    db: Session = Depends(get_db),
    _user: User = Depends(_require_audit_read),
):
    since = _since(days)
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    base = db.query(AuditLog).filter(AuditLog.created_at >= since)

    def _count(cat: str | None = None, hours_24: bool = False) -> int:
        q = base
        if hours_24:
            q = db.query(AuditLog).filter(AuditLog.created_at >= since_24h)
        if cat:
            q = q.filter(AuditLog.category == cat)
        return int(q.count())

    return AuditStatsResponse(
        events_24h=_count(hours_24=True),
        write_actions=_count("write"),
        admin_events=_count("admin"),
        auth_events=_count("auth"),
        system_events=_count("system"),
        security_events=_count("security"),
    )


@router.get("/export")
def export_audit_csv(
    days: int = Query(7, ge=1, le=365),
    category: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(_require_audit_read),
):
    since = _since(days)
    q = db.query(AuditLog).filter(AuditLog.created_at >= since)
    if category:
        q = q.filter(AuditLog.category == category)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(
            (AuditLog.actor_name.ilike(term))
            | (AuditLog.action.ilike(term))
            | (AuditLog.resource_label.ilike(term))
        )
    rows = q.order_by(AuditLog.created_at.desc()).limit(10000).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "Time (UTC)",
            "Actor",
            "Role",
            "Category",
            "Action",
            "Resource",
            "Method",
            "Path",
            "Status",
            "IP",
        ]
    )
    for r in rows:
        dt = r.created_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        writer.writerow(
            [
                dt.strftime("%Y-%m-%d %H:%M:%S"),
                r.actor_name,
                r.actor_role or "",
                r.category,
                r.action,
                r.resource_label or "",
                r.http_method or "",
                r.path or "",
                r.status_code or "",
                r.ip_address or "",
            ]
        )
    buf.seek(0)
    filename = f"audit-log-{days}d.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
