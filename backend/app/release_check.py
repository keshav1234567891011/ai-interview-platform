"""Read-only release preflight; reports names of missing controls, never values."""

import sys
from urllib.parse import urlsplit

from cryptography.fernet import Fernet
from sqlalchemy.engine import make_url

from app.core.config import Settings


def blockers(
    settings, *, require_ai=False, verify_topology=False, verify_crypto=False
) -> list[str]:
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
    if require_ai:
        key = settings.gemini_api_key.get_secret_value() if settings.gemini_api_key else ""
        if not key.strip() or key.startswith("REPLACE_"):
            missing.append("GEMINI_API_KEY for AI interviews")
        if settings.gemini_model != "gemini-3.1-flash-lite":
            missing.append("GEMINI_MODEL=gemini-3.1-flash-lite")
    if verify_topology:
        for name, value in (
            ("DATABASE_URL", settings.database_url),
            ("MIGRATION_DATABASE_URL", settings.migration_database_url),
        ):
            if value and not (make_url(value.get_secret_value()).host or "").endswith(".neon.tech"):
                missing.append(name + " must use the production Neon host")
        endpoint = urlsplit(settings.s3_endpoint_url or "")
        if (
            not (endpoint.hostname or "").endswith(".supabase.co")
            or endpoint.path.rstrip("/") != "/storage/v1/s3"
        ):
            missing.append("S3_ENDPOINT_URL for the existing Supabase storage")
        if "https://ai-interview-platform-one-mu.vercel.app" not in settings.frontend_origins:
            missing.append("FRONTEND_ORIGINS must include the existing Vercel application")
    if verify_crypto:
        key = settings.jwt_secret.get_secret_value() if settings.jwt_secret else ""
        if len(key) < 32 or key.startswith("REPLACE_"):
            missing.append("valid JWT_SECRET")
        try:
            Fernet(settings.settings_encryption_key.get_secret_value().encode())
        except Exception:
            missing.append("valid SETTINGS_ENCRYPTION_KEY")
    return missing


def main():
    try:
        # Check deployment variables only, without reading a workstation's private .env.
        settings = Settings(_env_file=None)
        missing = blockers(settings, require_ai=True, verify_topology=True, verify_crypto=True)
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
