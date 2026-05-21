"""Grade scale colors, calculation rules, K-12 class assignment."""
import sqlalchemy as sa
from alembic import op

revision = "010_grade_scales_enhancements"
down_revision = "009_academic_departments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("grading_scale_intervals", sa.Column("color", sa.String(length=20), nullable=True))
    op.add_column("grading_scales", sa.Column("calculation_rules", sa.Text(), nullable=True))
    op.add_column("grading_scales", sa.Column("updated_by_name", sa.String(length=120), nullable=True))
    op.add_column("k12_classes", sa.Column("grading_scale_id", sa.String(), nullable=True))
    op.create_foreign_key(
        "fk_k12_classes_grading_scale",
        "k12_classes",
        "grading_scales",
        ["grading_scale_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_k12_classes_grading_scale", "k12_classes", type_="foreignkey")
    op.drop_column("k12_classes", "grading_scale_id")
    op.drop_column("grading_scales", "updated_by_name")
    op.drop_column("grading_scales", "calculation_rules")
    op.drop_column("grading_scale_intervals", "color")
