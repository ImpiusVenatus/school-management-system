"""Built-in permission codes (catalog). Synced to DB automatically — no manual seed script required."""
import uuid
from sqlalchemy.orm import Session
from app.models import Permission

# (code, description) — extend here when adding features
PERMISSION_CATALOG: list[tuple[str, str]] = [
    ("users.read", "View users"),
    ("users.create", "Create users"),
    ("settings.manage", "Manage school settings"),
    ("roles.read", "View roles and permissions"),
    ("roles.manage", "Create and edit roles (Discord-style)"),
    ("students.read", "View students"),
    ("students.create", "Add students"),
    ("students.update", "Edit students"),
    ("teachers.read", "View teachers"),
    ("teachers.create", "Add teachers"),
    ("attendance.read", "View attendance"),
    ("attendance.mark", "Mark attendance"),
    ("notices.read", "View notices"),
    ("notices.publish", "Publish notices"),
    ("exams.read", "View exams"),
    ("exams.manage", "Manage assessment plans"),
    ("marks.enter", "Enter marks"),
    ("fees.read", "View fees"),
    ("fees.manage", "Manage fee structures"),
    ("invoices.read", "View invoices"),
    ("payments.collect", "Collect payments"),
    ("admissions.process", "Process admissions"),
]


def ensure_permission_catalog(db: Session) -> dict[str, Permission]:
    """Upsert all catalog permissions. Safe to call on every setup / reset."""
    by_code: dict[str, Permission] = {}
    for code, desc in PERMISSION_CATALOG:
        row = db.query(Permission).filter(Permission.code == code).first()
        if not row:
            row = Permission(id=str(uuid.uuid4()), code=code, description=desc)
            db.add(row)
        elif desc and row.description != desc:
            row.description = desc
        by_code[code] = row
    db.flush()
    return by_code
