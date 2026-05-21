"""Built-in permission codes (catalog). Synced to DB automatically."""
import uuid
from sqlalchemy.orm import Session
from app.models import Permission

# (code, description, group label for UI)
PERMISSION_CATALOG: list[tuple[str, str, str]] = [
    # AUTH & USERS
    ("users.read", "View users", "AUTH & USERS"),
    ("users.create", "Create users", "AUTH & USERS"),
    ("users.update", "Update users", "AUTH & USERS"),
    ("users.delete", "Delete users", "AUTH & USERS"),
    ("roles.read", "View roles and permissions", "AUTH & USERS"),
    ("roles.manage", "Create and edit roles", "AUTH & USERS"),
    # ACADEMIC STRUCTURE
    ("academic_years.read", "View academic years", "ACADEMIC STRUCTURE"),
    ("academic_years.manage", "Manage academic years", "ACADEMIC STRUCTURE"),
    ("classes.read", "View classes and sections", "ACADEMIC STRUCTURE"),
    ("classes.manage", "Manage classes and sections", "ACADEMIC STRUCTURE"),
    ("sections.read", "View sections", "ACADEMIC STRUCTURE"),
    ("sections.manage", "Manage sections", "ACADEMIC STRUCTURE"),
    ("subjects.read", "View subjects", "ACADEMIC STRUCTURE"),
    ("subjects.manage", "Manage subjects", "ACADEMIC STRUCTURE"),
    # STUDENTS
    ("students.read", "View all students", "STUDENTS"),
    ("students.read.own", "View own-section students", "STUDENTS"),
    ("students.create", "Create students", "STUDENTS"),
    ("students.update", "Update students", "STUDENTS"),
    ("students.delete", "Delete students", "STUDENTS"),
    ("admissions.read", "View admissions", "STUDENTS"),
    ("admissions.process", "Process admissions", "STUDENTS"),
    ("teachers.read", "View teachers", "STUDENTS"),
    ("teachers.create", "Add teachers", "STUDENTS"),
    # OPERATIONS
    ("timetable.read", "View timetable", "OPERATIONS"),
    ("timetable.manage", "Manage timetable", "OPERATIONS"),
    ("attendance.read", "View all attendance", "OPERATIONS"),
    ("attendance.read.own", "View own-section attendance", "OPERATIONS"),
    ("attendance.mark", "Mark attendance", "OPERATIONS"),
    ("notices.read", "View notices", "OPERATIONS"),
    ("notices.publish.school", "Publish school-wide notices", "OPERATIONS"),
    ("notices.publish.class", "Publish class notices", "OPERATIONS"),
    ("notices.publish", "Publish notices", "OPERATIONS"),
    # ASSESSMENT
    ("exams.read", "View exams", "ASSESSMENT"),
    ("exams.manage", "Manage exams", "ASSESSMENT"),
    ("marks.read", "View all marks", "ASSESSMENT"),
    ("marks.read.own", "View own-section marks", "ASSESSMENT"),
    ("marks.enter", "Enter marks", "ASSESSMENT"),
    ("marks.publish", "Publish marks", "ASSESSMENT"),
    # FEES
    ("fees.read", "View fees", "FEES"),
    ("fees.manage", "Manage fee structures", "FEES"),
    ("fee.structures.manage", "Manage fee structures", "FEES"),
    ("invoices.read", "View all invoices", "FEES"),
    ("invoices.read.own", "View own-section invoices", "FEES"),
    ("invoices.generate", "Generate invoices", "FEES"),
    ("payments.read", "View payments", "FEES"),
    ("payments.collect", "Collect payments", "FEES"),
    # SYSTEM
    ("settings.manage", "Manage school settings", "SYSTEM"),
    ("audit.read", "View audit log", "SYSTEM"),
    ("*", "All permissions (superuser)", "SYSTEM"),
]


def permission_action_letter(code: str) -> str | None:
    if code == "*":
        return "M"
    if code.endswith(".delete"):
        return "D"
    if code.endswith(".create"):
        return "C"
    if code.endswith(".update"):
        return "U"
    if ".read" in code:
        return "R"
    if any(
        code.endswith(s)
        for s in (".manage", ".process", ".collect", ".publish", ".mark", ".enter", ".generate")
    ):
        return "M"
    return None


def ensure_permission_catalog(db: Session) -> dict[str, Permission]:
    catalog_codes = [code for code, _, _ in PERMISSION_CATALOG]
    existing = {
        p.code: p
        for p in db.query(Permission).filter(Permission.code.in_(catalog_codes)).all()
    }
    by_code: dict[str, Permission] = {}
    for code, desc, _group in PERMISSION_CATALOG:
        row = existing.get(code)
        if not row:
            row = Permission(id=str(uuid.uuid4()), code=code, description=desc)
            db.add(row)
            existing[code] = row
        elif desc and row.description != desc:
            row.description = desc
        by_code[code] = row
    db.flush()
    return by_code


def catalog_for_ui() -> list[dict]:
    return [
        {
            "code": code,
            "description": desc,
            "group": group,
            "action": permission_action_letter(code),
        }
        for code, desc, group in PERMISSION_CATALOG
    ]
