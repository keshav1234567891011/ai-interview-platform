import secrets
from uuid import UUID

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.cli import bootstrap_owner
from app.core.config import get_settings
from app.core.permissions import PERMISSIONS
from app.core.security import COOKIE_NAME, password_hash
from app.models.administration import AuditEvent
from app.models.user import User


def password():
    return "Validation7-" + secrets.token_urlsafe(24)


def login(client, email, secret):
    return client.post("/api/auth/login", json={"email": email, "password": secret})


def change(client, current, new, **extra):
    return client.post(
        "/api/auth/change-password",
        json={"current_password": current, "new_password": new, "confirm_password": new, **extra},
    )


@pytest.fixture
def pending_owner(client, monkeypatch):
    temporary = password()
    monkeypatch.setattr("app.cli.get_engine", lambda: client.engine)
    monkeypatch.setenv("OWNER_BOOTSTRAP_EMAIL", "owner-validation@example.com")
    monkeypatch.setenv("OWNER_BOOTSTRAP_PASSWORD", temporary)
    get_settings.cache_clear()
    assert bootstrap_owner()
    response = login(client, "owner-validation@example.com", temporary)
    assert response.status_code == 200
    return {"user": response.json(), "temporary": temporary}


@pytest.fixture
def owner(client, pending_owner):
    chosen = password()
    response = change(client, pending_owner["temporary"], chosen)
    assert response.status_code == 200
    return {"user": response.json(), "password": chosen, "temporary": pending_owner["temporary"]}


def create_admin(client, **overrides):
    temporary = password()
    payload = {
        "email": "delegated@example.com",
        "display_name": "Delegated Admin",
        "password": temporary,
        "confirm_password": temporary,
        "permissions": ["users.view"],
        **overrides,
    }
    return client.post("/api/owner/admins", json=payload), payload


def owner_session(client):
    return httpx.Cookies(client.cookies)


def test_owner_bootstrap_forces_change_blocks_all_workspace_and_logs(client, pending_owner):
    assert pending_owner["user"]["role"] == "owner"
    assert pending_owner["user"]["password_change_required"]
    assert set(pending_owner["user"]["permissions"]) == set(PERMISSIONS)
    assert client.get("/api/auth/me").status_code == 200
    for path in [
        "/api/profile",
        "/api/dashboard",
        "/api/admin",
        "/api/owner/admins",
        "/api/owner/ai-settings",
    ]:
        assert client.get(path).status_code == 403
    with Session(client.engine) as db:
        user = db.get(User, UUID(pending_owner["user"]["id"]))
        assert password_hash.verify(pending_owner["temporary"], user.hashed_password)
        assert db.scalar(select(func.count()).select_from(User).where(User.role == "owner")) == 1
        assert db.scalar(select(AuditEvent)).action == "owner_bootstrapped"
    assert client.post("/api/auth/logout").status_code == 204


def test_bootstrap_idempotent_preserves_changed_password_and_rejects_other_owner(
    client, owner, monkeypatch
):
    with Session(client.engine) as db:
        before = db.get(User, UUID(owner["user"]["id"])).hashed_password
    monkeypatch.setenv("OWNER_BOOTSTRAP_PASSWORD", password())
    get_settings.cache_clear()
    assert bootstrap_owner() is False
    with Session(client.engine) as db:
        user = db.get(User, UUID(owner["user"]["id"]))
        assert user.hashed_password == before and not user.password_change_required
        assert db.scalar(select(func.count()).select_from(User)) == 1
    monkeypatch.setenv("OWNER_BOOTSTRAP_EMAIL", "unrelated@example.com")
    get_settings.cache_clear()
    with pytest.raises(ValueError):
        bootstrap_owner()


def test_bootstrap_explicit_promotion_missing_credential_and_unique_owner(
    client, account, monkeypatch
):
    monkeypatch.setattr("app.cli.get_engine", lambda: client.engine)
    monkeypatch.setenv("OWNER_BOOTSTRAP_EMAIL", account["email"])
    monkeypatch.delenv("OWNER_BOOTSTRAP_PASSWORD", raising=False)
    get_settings.cache_clear()
    with pytest.raises(ValueError):
        bootstrap_owner()
    temporary = password()
    monkeypatch.setenv("OWNER_BOOTSTRAP_PASSWORD", temporary)
    get_settings.cache_clear()
    assert bootstrap_owner()
    assert client.get("/api/auth/me").status_code == 401
    with Session(client.engine) as db:
        assert db.get(User, UUID(account["id"])).role == "owner"
        db.add(
            User(
                email="second@example.com",
                display_name="Second",
                hashed_password=password_hash.hash(password()),
                role="owner",
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        db.get(User, UUID(account["id"])).is_active = False
        with pytest.raises(IntegrityError):
            db.commit()


def test_password_change_revokes_old_sessions_and_temporary_login(client, pending_owner):
    old_token = client.cookies.get(COOKIE_NAME)
    assert change(client, password(), password()).status_code == 400
    assert change(client, pending_owner["temporary"], pending_owner["temporary"]).status_code == 422
    assert (
        change(
            client, pending_owner["temporary"], password(), confirm_password=password()
        ).status_code
        == 422
    )
    chosen = password()
    updated = change(client, pending_owner["temporary"], chosen)
    assert updated.status_code == 200 and not updated.json()["password_change_required"]
    assert client.get("/api/owner/admins").status_code == 200
    assert (
        client.get("/api/auth/me", headers={"Authorization": f"Bearer {old_token}"}).status_code
        == 401
    )
    client.cookies.clear()
    assert (
        login(client, pending_owner["user"]["email"], pending_owner["temporary"]).status_code == 401
    )
    assert login(client, pending_owner["user"]["email"], chosen).status_code == 200


def test_owner_creates_admin_forced_change_password_reset_and_audit(client, owner):
    owner_cookie = owner_session(client)
    response, payload = create_admin(client)
    assert response.status_code == 201
    admin = response.json()
    assert admin["role"] == "admin" and admin["password_change_required"]
    assert payload["password"] not in response.text and "hashed_password" not in response.text
    assert login(client, payload["email"], payload["password"]).status_code == 200
    assert client.get("/api/admin/users").status_code == 403
    chosen = password()
    old_token = client.cookies.get(COOKIE_NAME)
    assert change(client, payload["password"], chosen).status_code == 200
    assert client.get("/api/admin/users").status_code == 200
    assert login(client, payload["email"], payload["password"]).status_code == 401
    assert (
        client.get("/api/auth/me", headers={"Authorization": f"Bearer {old_token}"}).status_code
        == 401
    )
    client.cookies = owner_cookie
    reset = password()
    assert (
        client.post(
            f"/api/owner/admins/{admin['id']}/reset-password",
            json={"password": reset, "confirm_password": reset},
        ).status_code
        == 204
    )
    assert login(client, payload["email"], chosen).status_code == 401
    assert login(client, payload["email"], reset).json()["password_change_required"]
    assert client.get("/api/admin/users").status_code == 403
    assert change(client, reset, password()).status_code == 200
    client.cookies = owner_cookie
    audit = client.get("/api/owner/audit").json()
    assert {row["action"] for row in audit} >= {
        "owner_password_changed",
        "admin_created",
        "admin_password_changed",
        "admin_password_reset",
    }
    assert not any(term in str(audit) for term in [payload["password"], reset, "hashed_password"])


def test_permission_enforcement_revocation_safe_fields_and_owner_protection(client, owner):
    cookie = owner_session(client)
    candidate_password = password()
    candidate = client.post(
        "/api/auth/register",
        json={
            "email": "candidate-validation@example.com",
            "display_name": "Candidate Validation",
            "password": candidate_password,
        },
    ).json()
    client.cookies = cookie
    response, payload = create_admin(client, permissions=list(PERMISSIONS))
    admin = response.json()
    assert response.status_code == 201
    assert login(client, payload["email"], payload["password"]).status_code == 200
    assert change(client, payload["password"], password()).status_code == 200
    admin_cookie = owner_session(client)
    assert client.get("/api/admin").status_code == 200
    users = client.get("/api/admin/users").json()
    assert all(item["role"] != "owner" for item in users)
    assert client.get(f"/api/admin/users/{owner['user']['id']}").status_code == 403
    for target in [owner["user"]["id"], admin["id"]]:
        assert (
            client.put(f"/api/admin/users/{target}", json={"is_active": False}).status_code == 409
        )
        assert client.put(f"/api/admin/users/{target}", json={"role": "owner"}).status_code == 422
    for path in [
        "/api/owner/admins",
        "/api/owner/ai-settings",
        "/api/owner/audit",
        "/api/owner/permissions",
    ]:
        assert client.get(path).status_code == 403
    assert create_admin(client)[0].status_code == 403
    assert (
        client.put(
            f"/api/admin/users/{candidate['id']}", json={"display_name": "Updated"}
        ).status_code
        == 200
    )
    client.cookies = cookie
    assert (
        client.put(
            f"/api/owner/admins/{admin['id']}/permissions", json={"permissions": []}
        ).status_code
        == 200
    )
    client.cookies = admin_cookie
    # Same session, next request: no stale token permissions.
    assert client.get("/api/admin/users").status_code == 403
    assert client.get("/api/admin").status_code == 403
    assert (
        client.put(
            f"/api/admin/users/{candidate['id']}", json={"display_name": "Denied"}
        ).status_code
        == 403
    )
    client.cookies = cookie
    settings = client.get("/api/owner/ai-settings")
    assert settings.status_code == 200 and set(settings.json()) == {
        "configured",
        "model",
        "management",
    }
    for path, method, body in [
        ("state", "PUT", {"is_active": False}),
        ("permissions", "PUT", {"permissions": []}),
        ("reset-password", "POST", {"password": password(), "confirm_password": password()}),
        ("revoke", "POST", None),
    ]:
        if path == "reset-password":
            body["confirm_password"] = body["password"]
        assert (
            client.request(
                method,
                f"/api/owner/admins/{owner['user']['id']}/{path}",
                **({"json": body} if body else {}),
            ).status_code
            == 409
        )


def test_activation_revocation_promotion_and_validation(client, owner):
    cookie = owner_session(client)
    response, payload = create_admin(client)
    id = response.json()["id"]
    assert create_admin(client)[0].status_code == 409
    assert (
        create_admin(client, email="unknown@example.com", permissions=["owner.manage"])[
            0
        ].status_code
        == 422
    )
    assert create_admin(client, email="escalate@example.com", role="owner")[0].status_code == 422
    assert client.put(f"/api/owner/admins/{id}/state", json={"is_active": False}).status_code == 200
    assert login(client, payload["email"], payload["password"]).status_code == 401
    client.cookies = cookie
    assert client.put(f"/api/owner/admins/{id}/state", json={"is_active": True}).status_code == 200
    assert client.post(f"/api/owner/admins/{id}/revoke").json()["role"] == "user"
    assert client.get("/api/owner/admins").json() == []
    promoted, _ = create_admin(client, email=payload["email"], existing_user_id=id)
    assert promoted.status_code == 201
    actions = {row["action"] for row in client.get("/api/owner/audit").json()}
    assert actions >= {"admin_enabled", "admin_disabled", "admin_revoked", "admin_promoted"}


def test_public_user_and_admin_cannot_manage_administrators(client, account):
    assert create_admin(client)[0].status_code == 403
    for role in ["admin", "owner"]:
        assert (
            client.post(
                "/api/auth/register",
                json={
                    "email": "escalate@example.com",
                    "display_name": "Escalate",
                    "password": password(),
                    "role": role,
                },
            ).status_code
            == 422
        )


def test_support_permission_cannot_change_activation_or_profile(client, owner):
    cookie = owner_session(client)
    candidate = client.post(
        "/api/auth/register",
        json={
            "email": "supported@example.com",
            "display_name": "Supported",
            "password": password(),
        },
    ).json()
    client.cookies = cookie
    response, payload = create_admin(client, permissions=["users.view", "support.manage"])
    assert response.status_code == 201
    login(client, payload["email"], payload["password"])
    change(client, payload["password"], password())
    path = f"/api/admin/users/{candidate['id']}"
    assert client.put(path, json={"display_name": "Supported Candidate"}).status_code == 200
    assert client.put(path, json={"is_active": False}).status_code == 403
    assert (
        client.put(path + "/profile", json={"display_name": "Supported Candidate"}).status_code
        == 403
    )
    data = client.get(path).json()
    assert data["interviews"] == data["resumes"] == data["scheduled"] == []
    assert not any(key in str(data) for key in ["hashed_password", "token_version", "jwt_secret"])


def test_password_change_failure_budget(client, owner, monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    get_settings.cache_clear()
    for _ in range(5):
        assert change(client, password(), password()).status_code == 400
    assert change(client, password(), password()).status_code == 429


def test_owner_profile_management_safe_schema_and_permission_storage(client, owner):
    cookie = owner_session(client)
    candidate = client.post(
        "/api/auth/register",
        json={
            "email": "profile-validation@example.com",
            "display_name": "Profile Validation",
            "password": password(),
        },
    ).json()
    client.cookies = cookie
    path = f"/api/admin/users/{candidate['id']}/profile"
    update = {
        "display_name": "Reviewed Candidate",
        "target_role": "Backend Developer",
        "experience_level": "entry",
        "summary": "Reviewed profile.",
        "skill_ids": ["python", "sql"],
    }
    assert client.put(path, json={**update, "role": "owner"}).status_code == 422
    assert client.put(path, json=update).status_code == 200
    saved = client.get(f"/api/admin/users/{candidate['id']}").json()
    assert saved["profile"]["target_role"] == update["target_role"]
    assert {skill["id"] for skill in saved["profile"]["skills"]} == {"python", "sql"}
    assert saved["user"]["role"] == "user"
    response, _ = create_admin(client)
    path = f"/api/owner/admins/{response.json()['id']}/permissions"
    assert (
        client.put(path, json={"permissions": ["users.view", "analytics.view"]}).status_code == 200
    )
    assert client.put(path, json={"permissions": ["users.view", "resumes.view"]}).status_code == 200
    assert client.put(path, json={"permissions": ["users.view", "users.view"]}).status_code == 422


def test_admin_reset_invalidates_current_session_and_preserves_candidate_data(client, owner):
    cookie = owner_session(client)
    response, payload = create_admin(client)
    id = response.json()["id"]
    login(client, payload["email"], payload["password"])
    chosen = password()
    assert change(client, payload["password"], chosen).status_code == 200
    current_token = client.cookies.get(COOKIE_NAME)
    client.cookies = cookie
    new_temporary = password()
    assert (
        client.post(
            f"/api/owner/admins/{id}/reset-password",
            json={"password": new_temporary, "confirm_password": new_temporary},
        ).status_code
        == 204
    )
    assert (
        client.get("/api/auth/me", headers={"Authorization": f"Bearer {current_token}"}).status_code
        == 401
    )
    assert login(client, payload["email"], new_temporary).json()["password_change_required"]
    client.cookies = cookie
    assert client.post(f"/api/owner/admins/{id}/revoke").json()["password_change_required"]
    assert login(client, payload["email"], new_temporary).json()["role"] == "user"
    assert client.get("/api/dashboard").status_code == 403
