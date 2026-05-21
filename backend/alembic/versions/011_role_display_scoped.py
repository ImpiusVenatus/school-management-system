"""Role display_name and scoped_to_assigned_sections."""
import sqlalchemy as sa
from alembic import op

revision = "011_role_display_scoped"
down_revision = "010_grade_scales_enhancements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("roles", sa.Column("display_name", sa.String(length=100), nullable=True))
    op.add_column(
        "roles",
        sa.Column("scoped_to_assigned_sections", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("roles", "scoped_to_assigned_sections")
    op.drop_column("roles", "display_name")
