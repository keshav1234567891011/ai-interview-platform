import asyncio
import importlib
import pkgutil

import httpx
import pytest
from pydantic import SecretStr, ValidationError
from sqlalchemy import create_engine

import app
from app.core.config import Settings, get_settings
from app.db.base import Base
from app.db.session import get_database_url, get_engine
from app.main import create_app


def test_all_application_modules_import() -> None:
    for module in pkgutil.walk_packages(app.__path__, prefix="app."):
        importlib.import_module(module.name)


def test_health_without_database(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    async def request_health() -> httpx.Response:
        transport = httpx.ASGITransport(app=create_app())
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get("/health")

    response = asyncio.run(request_health())
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_application_metadata_and_schema() -> None:
    application = create_app()
    assert application.title == "InterviewAI API"
    assert application.version == "0.1.0"
    assert "/health" in application.openapi()["paths"]
    assert "users" in Base.metadata.tables


def test_settings_validate_and_redact_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    url = "postgresql+psycopg://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME"
    settings = Settings(_env_file=None, database_url=SecretStr(url))
    assert settings.database_url is not None
    assert settings.database_url.get_secret_value() == url
    assert "PASSWORD" not in repr(settings)
    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None, database_url=SecretStr("invalid-sensitive-value"))
    assert "invalid-sensitive-value" not in str(error.value)


def test_missing_database_configuration_is_explicit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.db.session.get_settings", lambda: Settings(_env_file=None, database_url=None)
    )
    get_engine.cache_clear()
    from fastapi import HTTPException

    with pytest.raises(HTTPException, match="Configure DATABASE_URL"):
        get_database_url()
    get_settings.cache_clear()


def test_postgresql_engine_can_be_created_without_connecting() -> None:
    engine = create_engine(
        "postgresql+psycopg://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME",
        pool_pre_ping=True,
    )
    assert engine.dialect.name == "postgresql"
    assert engine.dialect.driver == "psycopg"
    engine.dispose()
