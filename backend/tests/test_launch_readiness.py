import secrets
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import SecretStr, ValidationError

from app.core.config import Settings, get_settings
from app.release_check import blockers
from app.services.object_storage import S3ResumeStorage
from app.services.storage import get_storage


def test_production_preflight_reports_configuration_blockers_without_values():
    settings = Settings(_env_file=None)
    result = blockers(settings)
    assert "APP_ENV=production" in result
    assert "DATABASE_URL" in result and "MIGRATION_DATABASE_URL" in result
    assert "durable private S3 storage configuration" in result
    ready = settings.model_copy(
        update={
            "app_env": "production",
            "database_url": SecretStr("postgresql+psycopg://db.example/app?sslmode=require"),
            "migration_database_url": SecretStr(
                "postgresql+psycopg://direct.example/app?sslmode=require"
            ),
            "frontend_origins": ["https://app.example.com"],
            "storage_backend": "s3",
            "s3_bucket": "private-bucket",
            "s3_access_key_id": SecretStr(secrets.token_urlsafe(24)),
            "s3_secret_access_key": SecretStr(secrets.token_urlsafe(48)),
        }
    )
    assert blockers(ready) == []
    ready.migration_database_url = SecretStr(
        "postgresql+psycopg://db-pooler.example/app?sslmode=require"
    )
    assert "MIGRATION_DATABASE_URL must use a direct connection" in blockers(ready)
    ready.database_url = SecretStr("postgresql+psycopg://localhost/app")
    assert "DATABASE_URL remote TLS configuration" in blockers(ready)


@pytest.mark.parametrize(
    "custom_endpoint", [None, "https://example.storage.supabase.co/storage/v1/s3"]
)
def test_s3_adapter_private_explicit_credentials_and_safe_keys(monkeypatch, custom_endpoint):
    monkeypatch.setenv("STORAGE_BACKEND", "s3")
    monkeypatch.setenv("S3_BUCKET", "synthetic-private-bucket")
    monkeypatch.setenv("S3_ACCESS_KEY_ID", secrets.token_urlsafe(24))
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", secrets.token_urlsafe(48))
    monkeypatch.setenv("S3_ENDPOINT_URL", custom_endpoint or "")
    get_settings.cache_clear()
    calls = []

    def client(**kwargs):
        calls.append(kwargs)

    factory_options = []

    class Session:
        def __init__(self, **kwargs):
            self.session = kwargs["botocore_session"]
            assert "backend" in self.session.get_config_variable("config_file")
            assert "runtime" in self.session.get_config_variable("credentials_file")

        def client(self, service, **kwargs):
            factory_options.append(kwargs)
            assert service == "s3"
            return SimpleNamespace(put_object=client, delete_object=client)

    monkeypatch.setattr("boto3.session.Session", Session)
    storage = get_storage()
    assert isinstance(storage, S3ResumeStorage)
    key = storage.save(b"synthetic resume data", "pdf")
    assert calls[0]["Key"] == "resumes/" + key
    assert "ACL" not in calls[0] and calls[0]["Bucket"] == "synthetic-private-bucket"
    assert factory_options[0]["aws_access_key_id"] and factory_options[0]["aws_secret_access_key"]
    assert factory_options[0]["verify"] is True
    assert factory_options[0]["endpoint_url"] == custom_endpoint
    assert factory_options[0]["config"].s3["addressing_style"] == (
        "path" if custom_endpoint else "auto"
    )
    storage.delete(key)
    assert len(calls) == 2
    with pytest.raises(ValueError):
        storage.delete("invalid/storage-key")
    assert len(calls) == 2


def test_s3_configuration_absence_and_failures_do_not_discover_credentials(monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "s3")
    monkeypatch.delenv("S3_ACCESS_KEY_ID", raising=False)
    monkeypatch.delenv("S3_SECRET_ACCESS_KEY", raising=False)
    get_settings.cache_clear()
    with pytest.raises(HTTPException) as error:
        get_storage()
    assert error.value.status_code == 503
    storage = S3ResumeStorage.__new__(S3ResumeStorage)
    storage.bucket = "synthetic-private-bucket"

    def unavailable(**kwargs):
        raise RuntimeError("private-storage-diagnostic")

    storage.client = SimpleNamespace(put_object=unavailable, delete_object=unavailable)
    with pytest.raises(HTTPException) as error:
        storage.save(b"synthetic", "pdf")
    assert error.value.status_code == 503 and "private-storage-diagnostic" not in str(error.value)


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://untrusted.example",
        "https://user:password@storage.example",
        "https://storage.example/path",
        "https://storage.example?secret=value",
        "https://example.storage.supabase.co/storage/v1/object",
        "https://storage.example/storage/v1/s3",
        "https://example.storage.supabase.co.evil.example/storage/v1/s3",
        "https://example.storage.supabase.co/storage/v1/s3/other",
        "https://example.storage.supabase.co/storage/v1/s3?credential=synthetic",
        "https://example.storage.supabase.co/storage/v1/s3#fragment",
        "https://@example.storage.supabase.co/storage/v1/s3",
    ],
)
def test_s3_endpoint_must_be_explicit_https_origin(endpoint):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, s3_endpoint_url=endpoint)


@pytest.mark.parametrize(
    "endpoint",
    [
        "https://example.storage.supabase.co/storage/v1/s3",
        "https://example.supabase.co/storage/v1/s3",
        "https://example.storage.supabase.co/storage/v1/s3/",
        "https://private-s3.example",
    ],
)
def test_s3_endpoint_accepts_supabase_base_path_and_existing_origins(endpoint):
    assert Settings(_env_file=None, s3_endpoint_url=endpoint).s3_endpoint_url == endpoint.rstrip(
        "/"
    )


def test_migration_connection_prefers_explicit_direct_url(monkeypatch):
    from app.db.session import get_migration_database_url

    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://pooled.example/app?sslmode=require")
    monkeypatch.setenv(
        "MIGRATION_DATABASE_URL", "postgresql+psycopg://direct.example/app?sslmode=require"
    )
    get_settings.cache_clear()
    assert "direct.example" in get_migration_database_url()
    monkeypatch.delenv("MIGRATION_DATABASE_URL")
    get_settings.cache_clear()
    assert "pooled.example" in get_migration_database_url()


def test_container_server_uses_platform_port_without_affecting_development(monkeypatch):
    from app.serve import main

    calls = []
    monkeypatch.setattr("app.serve.uvicorn.run", lambda *args, **kwargs: calls.append(kwargs))
    monkeypatch.setenv("PORT", "10000")
    main()
    assert calls[0]["port"] == 10000 and calls[0]["access_log"] is False
    assert calls[0]["proxy_headers"] is False
    monkeypatch.setenv("PORT", "invalid")
    with pytest.raises(SystemExit):
        main()
