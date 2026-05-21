"""K-12 weekly timetable slots per class."""
from alembic import op
import sqlalchemy as sa

revision = "008_k12_timetable"
down_revision = "007_k12_section_name_length"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "k12_timetable_slots",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("class_id", sa.String(), sa.ForeignKey("k12_classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_id", sa.String(), sa.ForeignKey("k12_sections.id", ondelete="CASCADE"), nullable=True),
        sa.Column("subject_id", sa.String(), sa.ForeignKey("k12_subjects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("instructor_id", sa.String(), sa.ForeignKey("instructors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("room_id", sa.String(), sa.ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("from_time", sa.Time(), nullable=False),
        sa.Column("to_time", sa.Time(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_k12_timetable_class", "k12_timetable_slots", ["class_id"])


def downgrade() -> None:
    op.drop_index("ix_k12_timetable_class", table_name="k12_timetable_slots")
    op.drop_table("k12_timetable_slots")
