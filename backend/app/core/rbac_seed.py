"""Default system roles and permission sets."""
from sqlalchemy.orm import Session
from app.models import Role, Permission
from app.core.permission_catalog import ensure_permission_catalog

SYSTEM_ROLES: list[dict] = [
    {
        "name": "super_admin",
        "display_name": "Super Admin",
        "description": "Full access to all school data and settings.",
        "permissions": ["*"],
    },
    {
        "name": "principal",
        "display_name": "Principal",
        "description": "School-wide academic and operational oversight.",
        "permissions": [
            "users.read",
            "roles.read",
            "academic_years.manage",
            "classes.manage",
            "subjects.manage",
            "students.read",
            "students.create",
            "students.update",
            "teachers.read",
            "timetable.manage",
            "attendance.read",
            "notices.publish.school",
            "exams.manage",
            "marks.read",
            "marks.publish",
            "fees.manage",
            "invoices.read",
            "payments.read",
            "settings.manage",
            "audit.read",
        ],
    },
    {
        "name": "admin_staff",
        "display_name": "Admin Staff",
        "description": "Front office and student records.",
        "permissions": [
            "students.read",
            "students.create",
            "students.update",
            "admissions.read",
            "admissions.process",
            "notices.read",
            "classes.read",
        ],
    },
    {
        "name": "teacher",
        "display_name": "Teacher",
        "description": "Own classes: attendance, marks, class notices.",
        "permissions": [
            "students.read.own",
            "attendance.read.own",
            "attendance.mark",
            "marks.read.own",
            "marks.enter",
            "timetable.read",
            "notices.read",
            "notices.publish.class",
            "exams.read",
        ],
        "scoped_to_assigned_sections": True,
    },
    {
        "name": "accountant",
        "display_name": "Accountant",
        "description": "Fees, invoices, and payments.",
        "permissions": [
            "fees.read",
            "fees.manage",
            "fee.structures.manage",
            "invoices.read",
            "invoices.generate",
            "payments.read",
            "payments.collect",
        ],
    },
    {
        "name": "student",
        "display_name": "Student",
        "description": "View own timetable, notices, and marks.",
        "permissions": ["notices.read", "timetable.read", "marks.read.own", "exams.read"],
    },
    {
        "name": "guardian",
        "display_name": "Guardian",
        "description": "View ward notices, attendance, and fees.",
        "permissions": [
            "notices.read",
            "attendance.read.own",
            "marks.read.own",
            "invoices.read.own",
            "payments.read",
        ],
    },
    {
        "name": "librarian",
        "display_name": "Librarian",
        "description": "Library and resource access.",
        "permissions": ["students.read", "notices.read"],
    },
]


def ensure_system_roles(db: Session) -> None:
    import uuid

    by_code = ensure_permission_catalog(db)
    for spec in SYSTEM_ROLES:
        role = db.query(Role).filter(Role.name == spec["name"]).first()
        if not role:
            role = Role(
                id=str(uuid.uuid4()),
                name=spec["name"],
                display_name=spec.get("display_name"),
                description=spec.get("description"),
                is_system=True,
                scoped_to_assigned_sections=spec.get("scoped_to_assigned_sections", False),
            )
            db.add(role)
            db.flush()
        else:
            if not role.is_system:
                role.is_system = True
            if not role.display_name and spec.get("display_name"):
                role.display_name = spec["display_name"]
        if not role.permissions:
            codes = spec["permissions"]
            perms: list[Permission] = []
            for code in codes:
                if code == "*":
                    perms = list(by_code.values())
                    break
                p = by_code.get(code)
                if p:
                    perms.append(p)
            if perms:
                role.permissions = perms
    db.flush()
