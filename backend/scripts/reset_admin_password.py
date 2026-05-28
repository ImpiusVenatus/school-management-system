"""
Reset a user's password (dev utility).

Usage (from backend/):
  python scripts/reset_admin_password.py --email admin@sms.com --password "newpass"

Notes:
- bcrypt only supports up to 72 bytes; longer passwords are rejected.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models import User
from app.core.security import get_password_hash


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset a user's password (dev)")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).first()
        if not user:
            raise SystemExit(f"User not found: {args.email}")
        user.hashed_password = get_password_hash(args.password)
        db.commit()
        print(f"Password updated for {args.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

