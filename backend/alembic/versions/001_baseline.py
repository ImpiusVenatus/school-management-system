"""Baseline schema — creates all tables from SQLAlchemy models.

For databases already initialized via init_db()/create_all(), run:
  alembic stamp 001_baseline
instead of upgrade.
"""
from alembic import op

revision = "001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.database import Base
    import app.models  # noqa: F401 — register all models
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    from app.database import Base
    import app.models  # noqa: F401
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
