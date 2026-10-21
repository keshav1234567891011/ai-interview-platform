import json
from functools import lru_cache
from pathlib import Path, PureWindowsPath
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEVELOPMENT = json.loads(
    (BACKEND_ROOT.parent / "config" / "development.json").read_text(encoding="utf-8")
)
DEVELOPMENT_FRONTEND = f"http://{DEVELOPMENT['frontend']['host']}:{DEVELOPMENT['frontend']['port']}"


class Settings(BaseSettings):
    """Read deployment settings; keep the database URL out of logs and repr."""

    app_env: Literal["development", "test", "production"] = "development"
    database_url: SecretStr | None = None
    migration_database_url: SecretStr | None = None
    database_pool_size: int = Field(default=2, ge=1, le=20)
    database_max_overflow: int = Field(default=3, ge=0, le=20)
    jwt_secret: SecretStr | None = None
    owner_bootstrap_email: str | None = None
    owner_bootstrap_password: SecretStr | None = None
    jwt_algorithm: Literal["HS256"] = "HS256"
    access_token_expire_minutes: int = Field(default=30, ge=1, le=1440)
    openai_api_key: SecretStr | None = None
    settings_encryption_key: SecretStr | None = None
    openai_transcription_model: str = "gpt-4o-mini-transcribe"
    openai_model: str = Field(default="gpt-5-mini", min_length=1, max_length=100)
    ai_timeout_seconds: float = Field(default=15, ge=1, le=30)
    storage_directory: str = "runtime/uploads"
    storage_backend: Literal["local", "s3"] = "local"
    s3_bucket: str | None = None
    s3_region: str = "us-east-1"
    s3_endpoint_url: str | None = None
    s3_access_key_id: SecretStr | None = None
    s3_secret_access_key: SecretStr | None = None
    s3_session_token: SecretStr | None = None
    frontend_origins: list[str] = [DEVELOPMENT_FRONTEND, "http://127.0.0.1:3107"]

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    @field_validator("frontend_origins")
    @classmethod
    def explicit_origins(cls, values: list[str]) -> list[str]:
        from urllib.parse import urlsplit

        if not values or any(
            value == "*"
            or urlsplit(value).scheme not in {"http", "https"}
            or not urlsplit(value).netloc
            or urlsplit(value).path not in {"", "/"}
            or urlsplit(value).username
            or urlsplit(value).query
            or urlsplit(value).fragment
            for value in values
        ):
            raise ValueError("Configure explicit HTTP(S) frontend origins without credentials")
        return [value.rstrip("/") for value in values]

    @field_validator("storage_directory")
    @classmethod
    def project_storage(cls, value: str) -> str:
        if (
            not value
            or Path(value).is_absolute()
            or PureWindowsPath(value).drive
            or ".." in PureWindowsPath(value).parts
            or not (BACKEND_ROOT / value).resolve().is_relative_to(BACKEND_ROOT)
        ):
            raise ValueError("Storage directory must resolve inside the backend directory")
        return value

    @field_validator("s3_endpoint_url")
    @classmethod
    def secure_storage_endpoint(cls, value):
        import re
        from urllib.parse import urlsplit

        if value:
            url = urlsplit(value)
            supabase_s3 = (
                re.fullmatch(r"[a-z0-9-]+(?:\.storage)?\.supabase\.co", url.hostname or "")
                and url.path.rstrip("/") == "/storage/v1/s3"
            )
            if (
                url.scheme != "https"
                or not url.netloc
                or url.username is not None
                or url.password is not None
                or url.query
                or url.fragment
                or (url.path not in {"", "/"} and not supabase_s3)
            ):
                raise ValueError(
                    "S3 endpoint must be HTTPS with no credentials and a supported base path"
                )
        return value.rstrip("/") if value else None

    @field_validator("database_url", "migration_database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr | None) -> SecretStr | None:
        if value is None:
            return None
        try:
            parsed = make_url(value.get_secret_value())
        except Exception:
            raise ValueError("DATABASE_URL must be a valid PostgreSQL URL") from None
        if parsed.drivername != "postgresql+psycopg":
            raise ValueError("DATABASE_URL must use the postgresql+psycopg driver")
        if not parsed.database:
            raise ValueError("DATABASE_URL must include a database name")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
