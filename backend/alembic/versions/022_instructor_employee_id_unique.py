"""Unique employee_id per instructor (case-insensitive).

Revision ID: 022_instructor_emp_id_uq
Revises: 021_teacher_designations
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa


revision = "022_instructor_emp_id_uq"
down_revision = "021_teacher_designations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT lower(trim(employee_id)) AS eid_key,
                   array_agg(id ORDER BY created_at NULLS LAST, id) AS ids,
                   min(employee_id) AS sample
            FROM instructors
            WHERE employee_id IS NOT NULL AND trim(employee_id) <> ''
            GROUP BY lower(trim(employee_id))
            HAVING count(*) > 1
            """
        )
    ).fetchall()

    suffix = 2
    for row in rows:
        ids = list(row.ids)[1:]
        base = (row.sample or row.eid_key or "EMP").strip()
        for inst_id in ids:
            new_id = f"{base}-{suffix}"
            while conn.execute(
                sa.text(
                    "SELECT 1 FROM instructors WHERE lower(trim(employee_id)) = lower(trim(:eid)) AND id <> :id"
                ),
                {"eid": new_id, "id": inst_id},
            ).fetchone():
                suffix += 1
                new_id = f"{base}-{suffix}"
            conn.execute(
                sa.text("UPDATE instructors SET employee_id = :eid WHERE id = :id"),
                {"eid": new_id, "id": inst_id},
            )
            suffix += 1

    op.create_index(
        "uq_instructors_employee_id_lower",
        "instructors",
        [sa.text("lower(trim(employee_id))")],
        unique=True,
        postgresql_where=sa.text("employee_id IS NOT NULL AND trim(employee_id) <> ''"),
    )


def downgrade() -> None:
    op.drop_index("uq_instructors_employee_id_lower", table_name="instructors")
