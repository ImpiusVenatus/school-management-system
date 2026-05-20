"""Fee category fields, grading scale default, notification config JSON."""
from alembic import op
import sqlalchemy as sa

revision = "005_settings_extras"
down_revision = "004_school_profile_subjects"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fee_categories", sa.Column("code", sa.String(length=20), nullable=True))
    op.add_column("fee_categories", sa.Column("default_frequency", sa.String(length=20), nullable=True))
    op.add_column("fee_categories", sa.Column("taxable_percent", sa.Float(), nullable=True))
    op.add_column("fee_categories", sa.Column("refundable", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("fee_categories", sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"))

    op.add_column("grading_scales", sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("grading_scale_intervals", sa.Column("gpa_points", sa.Float(), nullable=True))

    op.add_column("education_settings", sa.Column("notification_config", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("education_settings", "notification_config")
    op.drop_column("grading_scale_intervals", "gpa_points")
    op.drop_column("grading_scales", "is_default")
    for col in ("is_active", "refundable", "taxable_percent", "default_frequency", "code"):
        op.drop_column("fee_categories", col)
