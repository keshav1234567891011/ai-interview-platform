"""Explicit operator action; grants an existing active account the application admin role."""

import argparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.models.user import User


def grant_admin(email: str):
    with Session(get_engine()) as db:
        user = db.scalar(
            select(User).where(User.email == email.strip().casefold()).with_for_update()
        )
        if user is None or not user.is_active:
            raise ValueError("An existing active account is required")
        user.role = "admin"
        user.token_version += 1
        db.commit()


def main():
    parser = argparse.ArgumentParser(description="Explicit application admin bootstrap")
    parser.add_argument("action", choices=["grant-admin"])
    parser.add_argument("--email", required=True)
    parser.add_argument("--confirm", action="store_true", help="Confirm this privileged operation")
    args = parser.parse_args()
    if not args.confirm:
        parser.error("Pass --confirm after checking the intended account")
    try:
        grant_admin(args.email)
    except Exception:
        parser.exit(
            1,
            "Admin bootstrap failed. Verify an active account and local configuration; "
            "private details suppressed.\n",
        )
    print("Application admin role assigned. Sign in again to use the new role.")


if __name__ == "__main__":
    main()
