"""One-time owner bootstrap. Admin delegation belongs to the authenticated owner."""

import argparse

from pydantic import EmailStr, TypeAdapter
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import password_hash
from app.db.session import get_engine
from app.models.user import User
from app.schemas.auth import RegisterRequest
from app.services.administration import audit


def bootstrap_owner() -> bool:
    settings = get_settings()
    email = str(
        TypeAdapter(EmailStr).validate_python(
            (settings.owner_bootstrap_email or "").strip().casefold()
        )
    )
    with Session(get_engine()) as db:
        owner = db.scalar(select(User).where(User.role == "owner").with_for_update())
        if owner is not None:
            if owner.email != email:
                raise ValueError("A different owner exists; ownership transfer is not supported")
            return False
        if not settings.owner_bootstrap_password:
            raise ValueError("Configure OWNER_BOOTSTRAP_PASSWORD locally")
        RegisterRequest.strong_password(settings.owner_bootstrap_password)
        if len(settings.owner_bootstrap_password.get_secret_value()) > 128:
            raise ValueError("Bootstrap password exceeds the supported length")
        user = db.scalar(select(User).where(User.email == email).with_for_update())
        if user is None:
            user = User(email=email, display_name="Application Owner", token_version=0)
            db.add(user)
        elif not user.is_active:
            raise ValueError("Configured account is inactive; review it before bootstrap")
        user.role = "owner"
        user.is_active = True
        user.hashed_password = password_hash.hash(
            settings.owner_bootstrap_password.get_secret_value()
        )
        user.password_change_required = True
        user.token_version += 1
        user.permission_records = []
        db.flush()
        audit(db, user, user, "owner_bootstrapped")
        db.commit()
        return True


def main():
    parser = argparse.ArgumentParser(description="Idempotent primary owner bootstrap")
    parser.add_argument("action", choices=["bootstrap-owner"])
    parser.parse_args()
    try:
        created = bootstrap_owner()
    except Exception:
        parser.exit(
            1,
            "Owner bootstrap failed. Check bootstrap variables, migrations and owner uniqueness; "
            "private details suppressed.\n",
        )
    print(
        "Owner bootstrapped; first password change required."
        if created
        else "Configured owner already exists; password preserved."
    )


if __name__ == "__main__":
    main()
