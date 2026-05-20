"""School profile fields and K-12 subject metadata."""
from alembic import op
import sqlalchemy as sa

revision = "004_school_profile_subjects"
down_revision = "003_academic_year_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("education_settings", sa.Column("school_code", sa.String(length=20), nullable=True))
    op.add_column("education_settings", sa.Column("tagline", sa.String(length=255), nullable=True))
    op.add_column("education_settings", sa.Column("affiliation_board", sa.String(length=80), nullable=True))
    op.add_column("education_settings", sa.Column("registration_number", sa.String(length=80), nullable=True))
    op.add_column("education_settings", sa.Column("recognition_year", sa.String(length=10), nullable=True))
    op.add_column("education_settings", sa.Column("address", sa.Text(), nullable=True))
    op.add_column("education_settings", sa.Column("phone", sa.String(length=40), nullable=True))
    op.add_column("education_settings", sa.Column("email", sa.String(length=120), nullable=True))
    op.add_column("education_settings", sa.Column("website", sa.String(length=255), nullable=True))
    op.add_column("education_settings", sa.Column("brand_color", sa.String(length=20), nullable=True))

    op.add_column("k12_subjects", sa.Column("department", sa.String(length=50), nullable=True))
    op.add_column("k12_subjects", sa.Column("grades_label", sa.String(length=30), nullable=True))
    op.add_column("k12_subjects", sa.Column("periods_per_week", sa.Integer(), nullable=True))


def downgrade() -> None:
    for col in (
        "periods_per_week",
        "grades_label",
        "department",
    ):
        op.drop_column("k12_subjects", col)
    for col in (
        "brand_color",
        "website",
        "email",
        "phone",
        "address",
        "recognition_year",
        "registration_number",
        "affiliation_board",
        "tagline",
        "school_code",
    ):
        op.drop_column("education_settings", col)
