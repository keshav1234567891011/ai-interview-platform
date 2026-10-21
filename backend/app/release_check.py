"""Read-only release preflight; reports names of missing controls, never values."""

import sys

from sqlalchemy.engine import make_url

from app.core.config import get_settings
from app.core.security import signing_key
from app.services.ai_settings import cipher


def blockers(settings) -> list[str]:
    missing = []
    if settings.app_env != "production":
        missing.append("APP_ENV=production")
    for name, secret in [
        ("DATABASE_URL", settings.database_url),
        ("MIGRATION_DATABASE_URL", settings.migration_database_url),
    ]:
        if not secret:
            missing.append(name)
            continue
        url = make_url(secret.get_secret_value())
        if url.host in {None, "localhost", "127.0.0.1", "::1"} or url.query.get("sslmode") not in {
            "require",
            "verify-full",
            "verify-ca",
        }:
            missing.append(name + " remote TLS configuration")
        if name == "MIGRATION_DATABASE_URL" and "-pooler" in (url.host or ""):
            missing.append("MIGRATION_DATABASE_URL must use a direct connection")
    if not settings.frontend_origins or any(
        not origin.startswith("https://") for origin in settings.frontend_origins
    ):
        missing.append("FRONTEND_ORIGINS with exact HTTPS origins")
    if settings.storage_backend != "s3" or not all(
        [settings.s3_bucket, settings.s3_access_key_id, settings.s3_secret_access_key]
    ):
        missing.append("durable private S3 storage configuration")
    if settings.owner_bootstrap_password and settings.owner_bootstrap_password.get_secret_value():
        missing.append("remove obsolete OWNER_BOOTSTRAP_PASSWORD after setup")
    return missing


def main():
    try:
        missing = blockers(get_settings())
        try:
            signing_key()
        except Exception:
            missing.append("valid JWT_SECRET")
        try:
            cipher()
        except Exception:
            missing.append("valid SETTINGS_ENCRYPTION_KEY")
        if missing:
            print("Release preflight BLOCKED: " + "; ".join(missing))
            return 1
        print(
            "Release configuration preflight passed. Live services, storage, backups, CI "
            "and GO LIVE approval must still be verified."
        )
        return 0
    except Exception:
        print("Release configuration preflight failed; private details suppressed.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
