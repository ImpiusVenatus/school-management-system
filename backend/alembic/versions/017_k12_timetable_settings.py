"""Class timetable layout settings and period index on slots."""
from alembic import op
import sqlalchemy as sa

revision = "017_k12_timetable_settings"
down_revision = "016_audit_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("k12_classes", sa.Column("timetable_weekdays", sa.String(32), nullable=True))
    op.add_column("k12_classes", sa.Column("timetable_periods_per_day", sa.Integer(), nullable=True))
    op.add_column("k12_classes", sa.Column("timetable_period_minutes", sa.Integer(), nullable=True))
    op.add_column("k12_classes", sa.Column("timetable_break_minutes", sa.Integer(), nullable=True))
    op.add_column("k12_classes", sa.Column("timetable_break_after_period", sa.Integer(), nullable=True))
    op.add_column("k12_classes", sa.Column("timetable_start_time", sa.Time(), nullable=True))

    op.execute(
        """
        UPDATE k12_classes SET
            timetable_weekdays = '[0,1,2,3,4]',
            timetable_periods_per_day = 8,
            timetable_period_minutes = 45,
            timetable_break_minutes = 20,
            timetable_break_after_period = 4,
            timetable_start_time = '08:00:00'
        WHERE timetable_weekdays IS NULL
        """
    )

    op.add_column("k12_timetable_slots", sa.Column("period_index", sa.Integer(), nullable=True))
    op.create_index(
        "ix_k12_timetable_class_day_period",
        "k12_timetable_slots",
        ["class_id", "day_of_week", "period_index"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_k12_timetable_class_day_period", table_name="k12_timetable_slots")
    op.drop_column("k12_timetable_slots", "period_index")
    op.drop_column("k12_classes", "timetable_start_time")
    op.drop_column("k12_classes", "timetable_break_after_period")
    op.drop_column("k12_classes", "timetable_break_minutes")
    op.drop_column("k12_classes", "timetable_period_minutes")
    op.drop_column("k12_classes", "timetable_periods_per_day")
    op.drop_column("k12_classes", "timetable_weekdays")
