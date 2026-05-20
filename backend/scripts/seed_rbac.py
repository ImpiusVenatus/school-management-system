"""Optional: sync permission catalog only. Roles are created in the dashboard (Settings → Roles).

Run after reset if needed:
  python scripts/seed_rbac.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.core.permission_catalog import ensure_permission_catalog


def main():
    db = SessionLocal()
    try:
        ensure_permission_catalog(db)
        db.commit()
        print("Permission catalog synced. Create roles at Dashboard → Settings → Roles.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
