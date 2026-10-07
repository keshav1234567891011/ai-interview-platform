from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import COOKIE_NAME, password_hash
from app.models.user import User


def test_registration_and_hash(client, account):
    assert account["email"] == "candidate@example.com"
    assert "password" not in account and "hashed_password" not in account
    with Session(client.engine) as db:
        user = db.scalar(select(User))
        assert user.hashed_password.startswith("$argon2id$")
        assert password_hash.verify("Test-account-password42", user.hashed_password)
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["id"] == account["id"]


def test_duplicate_normalized_email(client, account):
    response = client.post(
        "/api/auth/register",
        json={
            "email": " CANDIDATE@EXAMPLE.COM ",
            "display_name": "Other Candidate",
            "password": "Test-account-password42",
        },
    )
    assert response.status_code == 409


def test_registration_validation_redacts_input(client):
    response = client.post(
        "/api/auth/register", json={"email": "invalid", "display_name": " ", "password": "weak"}
    )
    assert response.status_code == 422
    assert all("input" not in error for error in response.json()["detail"])


def test_login_and_cookie_security(client, account):
    client.cookies.clear()
    response = client.post(
        "/api/auth/login",
        json={"email": "candidate@example.com", "password": "Test-account-password42"},
    )
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]
    assert client.get("/api/auth/me").status_code == 200


def test_login_failure_is_generic(client, account):
    for email in ["candidate@example.com", "missing@example.com"]:
        response = client.post(
            "/api/auth/login", json={"email": email, "password": "wrong-password"}
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Email or password is incorrect."


def test_protected_route_and_invalid_token(client):
    assert client.get("/api/auth/me").status_code == 401
    assert (
        client.get("/api/auth/me", headers={"Authorization": "Bearer invalid"}).status_code == 401
    )


def test_bearer_and_logout_revocation(client, account):
    token = client.cookies.get(COOKIE_NAME)
    client.cookies.clear()
    assert (
        client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    )
    assert (
        client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"}).status_code
        == 204
    )
    assert (
        client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    )


def test_cross_origin_write_rejected(client):
    response = client.post(
        "/api/auth/login",
        headers={"Origin": "https://untrusted.example"},
        json={"email": "candidate@example.com", "password": "wrong-password"},
    )
    assert response.status_code == 403


def test_development_cors_preflight(client):
    from app.core.config import DEVELOPMENT_FRONTEND

    response = client.request(
        "OPTIONS",
        "/api/auth/login",
        headers={
            "Origin": DEVELOPMENT_FRONTEND,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-interviewai-request",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == DEVELOPMENT_FRONTEND
    assert response.headers["access-control-allow-credentials"] == "true"


def test_missing_signing_configuration(client, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.delenv("JWT_SECRET")
    get_settings.cache_clear()
    response = client.post(
        "/api/auth/login", json={"email": "candidate@example.com", "password": "wrong-password"}
    )
    assert response.status_code == 503
