"""K12 timetable stream support (Science/Commerce/Arts).

Revision ID: 024_k12_tt_stream
Revises: 023_k12_enroll_stream
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa


revision = "024_k12_tt_stream"
down_revision = "023_k12_enroll_stream"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("k12_timetable_slots", sa.Column("stream", sa.String(length=20), nullable=True))
    # Allow multiple slots per (class, section, day, period) if they target different streams.
    op.create_index(
        "uq_k12_timetable_slot_key",
        "k12_timetable_slots",
        ["class_id", "section_id", "day_of_week", "period_index", sa.text("coalesce(stream,'')")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_k12_timetable_slot_key", table_name="k12_timetable_slots")
    op.drop_column("k12_timetable_slots", "stream")

