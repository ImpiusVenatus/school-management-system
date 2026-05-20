"""
Reset database to empty state and re-run migrations.

WARNING: Deletes ALL application data. Use only in development.

Usage (from backend/):
  python scripts/reset_db.py
  python scripts/reset_db.py --yes   # skip confirmation
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from alembic import command
from alembic.config import Config

from app.database import engine, Base
import app.models  # noqa: F401
from app.core.permission_catalog import ensure_permission_catalog
from app.database import SessionLocal


def reset_database(skip_confirm: bool = False) -> None:
    if not skip_confirm:
        answer = input("This will DELETE ALL DATA in the database. Type 'reset' to continue: ")
        if answer.strip().lower() != "reset":
            print("Aborted.")
            return

    print("Dropping all tables...")
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
        conn.commit()

    print("Running migrations...")
    alembic_cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    command.upgrade(alembic_cfg, "head")

    print("Syncing permission catalog...")
    db = SessionLocal()
    try:
        ensure_permission_catalog(db)
        db.commit()
    finally:
        db.close()

    print("Done. Database is empty — open http://localhost:3000/setup to configure again.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset SMS database (dev only)")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompt")
    args = parser.parse_args()
    reset_database(skip_confirm=args.yes)
