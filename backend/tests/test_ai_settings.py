import secrets
from uuid import UUID

import httpx
import pytest
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.permissions import PERMISSIONS
from app.models.ai_settings import AISettings
from app.models.user import User
from app.services.administration import assign_permissions
from app.services.ai_provider import get_question_provider
from app.services.ai_settings import resolved
from app.services.evaluation import get_evaluation_provider
from app.services.transcription import get_transcription_provider


def fake_key():
    return "sk-" + secrets.token_urlsafe(36)


@pytest.fixture
def configured_owner(client, account, monkeypatch):
    monkeypatch.setenv("SETTINGS_ENCRYPTION_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()
    with Session(client.engine) as db:
        db.get(User, UUID(account["id"])).role = "owner"
        db.commit()
    return account


def save_key(client, key):
    return client.put("/api/owner/ai-settings/key", json={"api_key": key, "confirm_api_key": key})


def controls(client, enabled=True, text="gpt-5-mini", transcription="gpt-4o-mini-transcribe"):
    return client.put(
        "/api/owner/ai-settings",
        json={"enabled": enabled, "text_model": text, "transcription_model": transcription},
    )


def test_key_encrypted_added_replaced_never_exposed_or_logged(client, configured_owner, caplog):
    first, second = fake_key(), fake_key()
    for key in (first, second):
        response = save_key(client, key)
        assert response.status_code == 200
        status = response.json()
        assert status["configured"] and status["database_key_present"]
        assert status["credential_source"] == "database" and status["encryption_status"] == "ready"
        with Session(client.engine) as db:
            record = db.get(AISettings, 1)
            encrypted = record.encrypted_api_key
            hidden = encrypted != key and key not in encrypted
            assert hidden
            matches = (
                Fernet(get_settings().settings_encryption_key.get_secret_value().encode())
                .decrypt(encrypted.encode())
                .decode()
                == key
            )
            assert matches
            assert record.updated_by == UUID(configured_owner["id"])
        assert key not in response.text and encrypted not in response.text
    audit = client.get("/api/owner/audit")
    assert {row["action"] for row in audit.json()} >= {"ai_key_added", "ai_key_replaced"}
    for result in [audit.text, client.get("/api/owner/ai-settings").text, caplog.text]:
        assert first not in result and second not in result and encrypted not in result


def test_resolution_priority_removal_environment_fallback_and_disable(
    client, configured_owner, monkeypatch
):
    environment, database = fake_key(), fake_key()
    monkeypatch.setenv("OPENAI_API_KEY", environment)
    get_settings.cache_clear()
    assert client.get("/api/owner/ai-settings").json()["credential_source"] == "environment"
    assert save_key(client, database).status_code == 200
    assert controls(client, text="gpt-5-nano", transcription="gpt-4o-transcribe").status_code == 200
    with Session(client.engine) as db:
        for factory in [get_question_provider, get_evaluation_provider, get_transcription_provider]:
            provider = factory(db)
            selected = provider.settings.openai_api_key.get_secret_value() == database
            assert selected
            assert provider.settings.openai_model == "gpt-5-nano"
            assert provider.settings.openai_transcription_model == "gpt-4o-transcribe"
    assert controls(client, enabled=False).status_code == 200
    assert client.get("/api/interviews/capabilities").json() == {
        "ai_available": False,
        "transcription_available": False,
    }
    with Session(client.engine) as db:
        assert all(
            factory(db) is None
            for factory in [
                get_question_provider,
                get_evaluation_provider,
                get_transcription_provider,
            ]
        )
    assert client.request("DELETE", "/api/owner/ai-settings/key").json()["enabled"] is False
    assert controls(client, enabled=True).json()["credential_source"] == "environment"
    monkeypatch.setenv("OPENAI_API_KEY", "")
    get_settings.cache_clear()
    assert client.get("/api/owner/ai-settings").json()["fallback_active"]
    assert client.get("/api/interviews/capabilities").json()["ai_available"] is False
    assert (
        client.post(
            "/api/interviews",
            json={"role": "Backend Developer", "question_count": 1, "ai_enabled": True},
        ).status_code
        == 201
    )


def test_replacement_used_on_next_provider_request_without_restart(client, configured_owner):
    first, second = fake_key(), fake_key()
    save_key(client, first)
    with Session(client.engine) as db:
        initial = get_question_provider(db)
        save_key(client, second)
        updated = get_question_provider(db)
        changed = (
            initial.settings.openai_api_key.get_secret_value() == first
            and updated.settings.openai_api_key.get_secret_value() == second
        )
        assert changed


@pytest.mark.parametrize("configured", [None, "invalid", "different-valid-key"])
def test_encryption_missing_invalid_or_changed_fails_safely(
    client, configured_owner, monkeypatch, configured
):
    key, environment = fake_key(), fake_key()
    assert save_key(client, key).status_code == 200
    if configured is None:
        monkeypatch.delenv("SETTINGS_ENCRYPTION_KEY")
    else:
        monkeypatch.setenv(
            "SETTINGS_ENCRYPTION_KEY",
            Fernet.generate_key().decode() if configured == "different-valid-key" else configured,
        )
    monkeypatch.setenv("OPENAI_API_KEY", environment)
    get_settings.cache_clear()
    response = client.get("/api/owner/ai-settings")
    assert response.json()["credential_source"] == "environment"
    assert response.json()["database_key_present"]
    with Session(client.engine) as db:
        selected = resolved(db)[0].openai_api_key.get_secret_value() == environment
        assert selected
    if configured != "different-valid-key":
        assert save_key(client, fake_key()).status_code == 503
        assert client.request("DELETE", "/api/owner/ai-settings/key").status_code == 503
    else:
        assert response.json()["encryption_status"] == "unreadable"
        assert save_key(client, fake_key()).status_code == 200


def test_corrupted_ciphertext_never_exposed_and_falls_back(client, configured_owner):
    assert save_key(client, fake_key()).status_code == 200
    with Session(client.engine) as db:
        db.get(AISettings, 1).encrypted_api_key = "invalid-ciphertext"
        db.commit()
    response = client.get("/api/owner/ai-settings")
    assert response.json()["encryption_status"] == "unreadable"
    assert response.json()["fallback_active"] and "invalid-ciphertext" not in response.text


@pytest.mark.parametrize("role", ["user", "admin"])
def test_nonowner_cannot_access_any_ai_settings_even_with_all_permissions(client, account, role):
    with Session(client.engine) as db:
        user = db.get(User, UUID(account["id"]))
        user.role = role
        assign_permissions(user, list(PERMISSIONS))
        db.commit()
    key = fake_key()
    for method, path, payload in [
        ("GET", "", None),
        (
            "PUT",
            "",
            {
                "enabled": True,
                "text_model": "gpt-5-mini",
                "transcription_model": "gpt-4o-mini-transcribe",
            },
        ),
        ("PUT", "/key", {"api_key": key, "confirm_api_key": key}),
        ("DELETE", "/key", None),
        ("POST", "/test", None),
    ]:
        assert (
            client.request(
                method, "/api/owner/ai-settings" + path, **({"json": payload} if payload else {})
            ).status_code
            == 403
        )


def test_validation_redacts_key_mismatch_and_rejects_uncontrolled_models(client, configured_owner):
    secret = fake_key()
    response = client.put(
        "/api/owner/ai-settings/key", json={"api_key": secret, "confirm_api_key": fake_key()}
    )
    assert response.status_code == 422 and secret not in response.text
    assert controls(client, text="https://untrusted.example").status_code == 422
    assert controls(client, transcription="arbitrary-model").status_code == 422
    assert (
        client.put(
            "/api/owner/ai-settings",
            json={
                "enabled": "yes",
                "text_model": "gpt-5-mini",
                "transcription_model": "gpt-4o-mini-transcribe",
            },
        ).status_code
        == 422
    )
    assert client.get("/api/owner/ai-settings").json()["updated_at"] is None


@pytest.mark.parametrize(
    "http_status,expected",
    [
        (200, "connected"),
        (401, "authentication_failed"),
        (403, "authentication_failed"),
        (429, "rate_limited"),
        (500, "provider_unavailable"),
        (404, "model_unavailable"),
        (302, "provider_unavailable"),
    ],
)
def test_explicit_connection_test_is_mocked_metadata_only(
    client, configured_owner, monkeypatch, http_status, expected
):
    secret = fake_key()
    save_key(client, secret)
    client_class = httpx.Client
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(http_status, json={"error": "private-provider-diagnostic"})

    monkeypatch.setattr(
        "app.services.provider_connection.httpx.Client",
        lambda **kwargs: client_class(transport=httpx.MockTransport(handler), **kwargs),
    )
    response = client.post("/api/owner/ai-settings/test")
    assert response.status_code == 200 and response.json() == {"status": expected}
    assert requests and all(
        request.method == "GET"
        and request.url.host == "api.openai.com"
        and request.url.path.startswith("/v1/models/")
        for request in requests
    )
    assert "private-provider-diagnostic" not in response.text and secret not in response.text
    assert "ai_connection_tested" in {
        row["action"] for row in client.get("/api/owner/audit").json()
    }


def test_connection_timeout_and_disabled_provider_make_no_generation_calls(
    client, configured_owner, monkeypatch
):
    client_class = httpx.Client

    def timeout(request):
        raise httpx.ReadTimeout("private timeout detail")

    monkeypatch.setattr(
        "app.services.provider_connection.httpx.Client",
        lambda **kwargs: client_class(transport=httpx.MockTransport(timeout), **kwargs),
    )
    assert client.post("/api/owner/ai-settings/test").json()["status"] == "not_configured"
    save_key(client, fake_key())
    response = client.post("/api/owner/ai-settings/test")
    assert response.json()["status"] == "provider_unavailable" and "private" not in response.text
    controls(client, enabled=False)
    assert client.post("/api/owner/ai-settings/test").json()["status"] == "disabled"


def test_model_toggle_remove_audits_and_probe_rate_limit(client, configured_owner, monkeypatch):
    save_key(client, fake_key())
    controls(client, enabled=False, text="gpt-5-nano")
    controls(client, enabled=True)
    assert client.request("DELETE", "/api/owner/ai-settings/key").status_code == 200
    actions = {row["action"] for row in client.get("/api/owner/audit").json()}
    assert actions >= {
        "ai_provider_enabled",
        "ai_provider_disabled",
        "ai_models_changed",
        "ai_key_removed",
    }
    monkeypatch.setenv("APP_ENV", "development")
    get_settings.cache_clear()
    for _ in range(3):
        assert client.post("/api/owner/ai-settings/test").status_code == 200
    assert client.post("/api/owner/ai-settings/test").status_code == 429
