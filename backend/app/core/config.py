import json
from functools import lru_cache
from pathlib import Path
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
    jwt_secret: SecretStr | None = None
    jwt_algorithm: Literal["HS256"] = "HS256"
    access_token_expire_minutes: int = Field(default=30, ge=1, le=1440)
    openai_api_key: SecretStr | None = None
    openai_model: str = Field(default="gpt-5-mini", min_length=1, max_length=100)
    ai_timeout_seconds: float = Field(default=15, ge=1, le=30)
    frontend_origins: list[str] = [DEVELOPMENT_FRONTEND, "http://127.0.0.1:3107"]

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    @field_validator("database_url")
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
