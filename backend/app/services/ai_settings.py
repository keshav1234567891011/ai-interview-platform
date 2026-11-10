"""Per-request credential resolution. No secrets/ciphertext in responses, repr or logs."""

from datetime import UTC, datetime

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.administration import AuditEvent
from app.models.ai_settings import AISettings
from app.schemas.ai_settings import AISettingsResponse
from app.services.ai_diagnostics import recent_diagnostics


def cipher() -> Fernet:
    key = get_settings().settings_encryption_key
    if not key or not key.get_secret_value():
        raise HTTPException(
            503, "Configure SETTINGS_ENCRYPTION_KEY before managing stored credentials"
        )
    try:
        return Fernet(key.get_secret_value().encode("ascii"))
    except (ValueError, UnicodeError):
        raise HTTPException(
            503,
            "Settings encryption unavailable. Preserve the key; ask the operator to check it.",
        ) from None


def usable(key: SecretStr | None) -> bool:
    return bool(
        key and key.get_secret_value().strip() and not key.get_secret_value().startswith("REPLACE_")
    )


def resolved(db: Session | None = None):
    settings = get_settings()
    record = db.get(AISettings, 1, populate_existing=True) if db is not None else None
    source = "environment" if usable(settings.openai_api_key) else "none"
    key = settings.openai_api_key if source == "environment" else None
    encryption = "missing"
    if settings.settings_encryption_key and settings.settings_encryption_key.get_secret_value():
        try:
            cipher()
            encryption = "ready"
        except HTTPException:
            encryption = "invalid"
    if record and record.encrypted_api_key:
        if encryption == "ready":
            try:
                candidate = SecretStr(
                    cipher().decrypt(record.encrypted_api_key.encode("ascii")).decode("utf-8")
                )
                if not usable(candidate):
                    raise ValueError("Empty credential")
                key, source = candidate, "database"
            except (InvalidToken, UnicodeError, ValueError):
                encryption = "unreadable"
        # An unusable database credential safely falls back to the configured environment key.
    enabled = record.enabled if record else True
    runtime = settings.model_copy(
        update={
            "openai_api_key": key if enabled else None,
            "openai_model": record.text_model if record else settings.openai_model,
            "openai_transcription_model": record.transcription_model
            if record
            else settings.openai_transcription_model,
        }
    )
    from app.services.ai_provider import gemini_enabled

    latest_test = (
        db.scalar(
            select(AuditEvent)
            .where(
                AuditEvent.action == "gemini_connection_tested",
                AuditEvent.details["model"].as_string() == settings.gemini_model,
            )
            .order_by(AuditEvent.created_at.desc())
            .limit(1)
        )
        if db is not None
        else None
    )
    status = AISettingsResponse(
        gemini_diagnostics=recent_diagnostics(db),
        gemini_last_test_status=latest_test.details.get("status") if latest_test else None,
        gemini_last_test_at=latest_test.created_at if latest_test else None,
        gemini_configured=usable(settings.gemini_api_key),
        gemini_model=settings.gemini_model,
        gemini_available=gemini_enabled(db),
        enabled=enabled,
        configured=source != "none",
        database_key_present=bool(record and record.encrypted_api_key),
        credential_source=source,
        encryption_status=encryption,
        text_model=runtime.openai_model,
        transcription_model=runtime.openai_transcription_model,
        fallback_active=not enabled or source == "none",
        updated_at=record.updated_at if record else None,
        updated_by=record.updated_by if record else None,
    )
    return runtime, status


def editable(db: Session, owner) -> AISettings:
    # Caller serializes all owner mutations via the existing owner row lock.
    record = db.get(AISettings, 1)
    if record is None:
        settings = get_settings()
        from app.schemas.ai_settings import TEXT_MODELS, TRANSCRIPTION_MODELS

        record = AISettings(
            id=1,
            enabled=True,
            text_model=settings.openai_model
            if settings.openai_model in TEXT_MODELS
            else TEXT_MODELS[0],
            transcription_model=settings.openai_transcription_model
            if settings.openai_transcription_model in TRANSCRIPTION_MODELS
            else TRANSCRIPTION_MODELS[0],
        )
        db.add(record)
    record.updated_by = owner.id
    record.updated_at = datetime.now(UTC)
    return record


def runtime_settings(db: Session | None = None):
    return resolved(db)[0]
