"""Academic departments table; migrate k12_subjects.department to department_id."""
from alembic import op
import sqlalchemy as sa

revision = "009_academic_departments"
down_revision = "008_k12_timetable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "academic_departments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("name", name="uq_academic_department_name"),
    )

    op.add_column(
        "k12_subjects",
        sa.Column("department_id", sa.String(), sa.ForeignKey("academic_departments.id", ondelete="SET NULL"), nullable=True),
    )

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT DISTINCT department FROM k12_subjects WHERE department IS NOT NULL AND TRIM(department) <> ''"
        )
    ).fetchall()
    name_to_id: dict[str, str] = {}
    order = 0
    for (dept_name,) in rows:
        name = (dept_name or "").strip()
        if not name or name in name_to_id:
            continue
        dept_id = f"DEPT-{order + 1:04d}"
        while conn.execute(sa.text("SELECT 1 FROM academic_departments WHERE id = :id"), {"id": dept_id}).fetchone():
            order += 1
            dept_id = f"DEPT-{order + 1:04d}"
        conn.execute(
            sa.text(
                "INSERT INTO academic_departments (id, name, sort_order, is_active) VALUES (:id, :name, :ord, true)"
            ),
            {"id": dept_id, "name": name, "ord": order},
        )
        name_to_id[name] = dept_id
        order += 1

    subjects = conn.execute(
        sa.text("SELECT id, department FROM k12_subjects WHERE department IS NOT NULL AND TRIM(department) <> ''")
    ).fetchall()
    for sub_id, dept_name in subjects:
        name = (dept_name or "").strip()
        dept_id = name_to_id.get(name)
        if dept_id:
            conn.execute(
                sa.text("UPDATE k12_subjects SET department_id = :did WHERE id = :sid"),
                {"did": dept_id, "sid": sub_id},
            )

    op.drop_column("k12_subjects", "department")


def downgrade() -> None:
    op.add_column("k12_subjects", sa.Column("department", sa.String(length=50), nullable=True))
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT s.id, d.name
            FROM k12_subjects s
            LEFT JOIN academic_departments d ON s.department_id = d.id
            """
        )
    ).fetchall()
    for sub_id, dept_name in rows:
        if dept_name:
            conn.execute(
                sa.text("UPDATE k12_subjects SET department = :name WHERE id = :sid"),
                {"name": dept_name, "sid": sub_id},
            )
    op.drop_column("k12_subjects", "department_id")
    op.drop_table("academic_departments")
