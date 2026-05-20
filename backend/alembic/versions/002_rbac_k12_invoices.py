"""RBAC, K-12, invoices tables."""
from alembic import op

revision = "002_rbac_k12_invoices"
down_revision = "001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.database import Base
    import app.models  # noqa: F401
    bind = op.get_bind()
    tables = [
        "roles", "permissions", "role_permissions", "user_roles", "refresh_tokens",
        "k12_classes", "k12_sections", "k12_subjects", "k12_class_subjects",
        "k12_student_enrollments", "k12_teacher_subjects",
        "invoices", "invoice_items", "payments",
    ]
    for name in tables:
        if name in Base.metadata.tables:
            Base.metadata.tables[name].create(bind=bind, checkfirst=True)
    from sqlalchemy import inspect
    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("education_settings")} if insp.has_table("education_settings") else set()
    if "school_type" not in cols and insp.has_table("education_settings"):
        op.execute("ALTER TABLE education_settings ADD COLUMN IF NOT EXISTS school_type VARCHAR DEFAULT 'program'")


def downgrade() -> None:
    for t in (
        "payments", "invoice_items", "invoices",
        "k12_teacher_subjects", "k12_student_enrollments", "k12_class_subjects",
        "k12_subjects", "k12_sections", "k12_classes",
        "refresh_tokens", "user_roles", "role_permissions", "permissions", "roles",
    ):
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
