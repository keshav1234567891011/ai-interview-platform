import asyncio
import secrets
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.body_limit import MAX_JSON_BYTES, BodyLimitMiddleware
from app.core.config import Settings, get_settings
from app.core.rate_limit import reserve
from app.core.security import COOKIE_NAME, decode_token, signing_key
from app.models.rate_limit import RateLimitBucket


def test_shared_quota_persists_across_sessions_and_resets(client):
    for _ in range(3):
        with Session(client.engine) as db:
            reserve(db, "test", "private@example.com", 3, 60, now=120)
    with Session(client.engine) as db:
        with pytest.raises(HTTPException) as error:
            reserve(db, "test", "private@example.com", 3, 60, now=135)
        assert error.value.status_code == 429
        assert error.value.headers == {"Retry-After": "45"}
        bucket = db.scalar(select(RateLimitBucket))
        assert bucket.count == 3 and len(bucket.key) == 64
        assert "private" not in bucket.key
        reserve(db, "test", "other@example.com", 3, 60, now=135)
        reserve(db, "test", "private@example.com", 3, 60, now=180)
        # A delayed old-window request must not move a newer bucket backwards.
        reserve(db, "test", "private@example.com", 3, 60, now=135)
        db.expire_all()
        assert db.get(RateLimitBucket, bucket.key).window_start == 180


def test_failed_logins_consume_shared_budget(client, account, monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    get_settings.cache_clear()
    for _ in range(10):
        assert (
            client.post(
                "/api/auth/login", json={"email": account["email"], "password": "incorrect"}
            ).status_code
            == 401
        )
    limited = client.post(
        "/api/auth/login", json={"email": account["email"], "password": "incorrect"}
    )
    assert limited.status_code == 429 and "Retry-After" in limited.headers
    assert "private" not in limited.text


def test_processing_quota_does_not_mutate_interview(client, account, monkeypatch):
    created = client.post(
        "/api/interviews", json={"role": "Backend Developer", "question_count": 1}
    ).json()
    with Session(client.engine) as db:
        for _ in range(30):
            reserve(db, "interview-processing", account["id"], 30, 60)
    monkeypatch.setenv("APP_ENV", "development")
    get_settings.cache_clear()
    response = client.post(f"/api/interviews/{created['id']}/start")
    assert response.status_code == 429
    assert client.get(f"/api/interviews/{created['id']}").json()["status"] == "created"


def test_body_limit_before_json_validation(client):
    response = client.post(
        "/api/auth/login",
        content=b"x" * (MAX_JSON_BYTES + 1),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert response.json() == {"detail": "Request body is too large."}


def test_streamed_body_limit_without_content_length():
    called = False
    sent = []

    async def application(scope, receive, send):
        nonlocal called
        called = True

    chunks = iter(
        [
            {"type": "http.request", "body": b"x" * MAX_JSON_BYTES, "more_body": True},
            {"type": "http.request", "body": b"x", "more_body": False},
        ]
    )

    async def receive():
        return next(chunks)

    async def send(message):
        sent.append(message)

    asyncio.run(
        BodyLimitMiddleware(application)(
            {"type": "http", "method": "POST", "headers": [(b"content-type", b"application/json")]},
            receive,
            send,
        )
    )
    assert not called and sent[0]["status"] == 413


def test_ready_requires_migrations_and_safe_failure(client, monkeypatch):
    monkeypatch.setattr("app.api.health.get_engine", lambda: client.engine)
    assert client.get("/ready").status_code == 503
    with client.engine.begin() as connection:
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        connection.execute(text("INSERT INTO alembic_version VALUES ('0007')"))
    assert client.get("/ready").status_code == 503
    with client.engine.begin() as connection:
        connection.execute(text("UPDATE alembic_version SET version_num = '0008'"))
    assert client.get("/ready").json() == {"status": "ready"}

    def unavailable():
        raise RuntimeError("PRIVATE_DATABASE_DIAGNOSTIC")

    monkeypatch.setattr("app.api.health.get_engine", unavailable)
    response = client.get("/ready")
    assert response.status_code == 503 and "PRIVATE" not in response.text


def test_unexpected_errors_are_private(client, caplog):
    @client.application.get("/internal-test-error")
    def explode():
        raise RuntimeError("PRIVATE_TRANSCRIPT_DIAGNOSTIC")

    response = client.get("/internal-test-error")
    assert response.status_code == 500
    assert "PRIVATE" not in response.text and "PRIVATE" not in caplog.text
    assert "unexpected_request_failure" in caplog.text


def test_production_cookie_secure(client, account, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()
    response = client.post(
        "/api/auth/login", json={"email": account["email"], "password": "Test-account-password42"}
    )
    assert response.status_code == 200
    assert "Secure" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]


@pytest.mark.parametrize("version", [True, "0", -1, 0.5])
def test_jwt_version_claim_is_strict(client, version):
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(secrets.token_hex(16)),
            "ver": version,
            "iat": now,
            "exp": now + timedelta(minutes=5),
            "iss": "interviewai",
            "aud": "interviewai-web",
        },
        signing_key(),
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as error:
        decode_token(token)
    assert error.value.status_code == 401


def test_oversized_session_rejected(client):
    client.cookies.set(COOKIE_NAME, "x" * 5000)
    assert client.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize(
    "origin", ["*", "https://user:password@example.com", "https://example.com/path"]
)
def test_explicit_cors_configuration(origin):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, frontend_origins=[origin])


def test_storage_configuration_stays_in_backend():
    assert (
        Settings(_env_file=None, storage_directory="runtime/uploads").storage_directory
        == "runtime/uploads"
    )
    with pytest.raises(ValidationError):
        Settings(_env_file=None, storage_directory="C:/outside-project")


def test_profile_mass_assignment_rejected(client, account):
    response = client.put("/api/profile", json={"display_name": "Candidate", "role": "admin"})
    assert response.status_code == 422
    assert client.get("/api/auth/me").json()["role"] == "user"


def test_offline_migration_validation():
    from app.migration_check import validate

    validate()
