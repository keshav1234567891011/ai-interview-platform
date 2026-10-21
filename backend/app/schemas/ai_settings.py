from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, SecretStr, field_validator, model_validator

TextModel = Literal["gpt-5-mini", "gpt-5-nano"]
TranscriptionModel = Literal["gpt-4o-mini-transcribe", "gpt-4o-transcribe"]
TEXT_MODELS = ["gpt-5-mini", "gpt-5-nano"]
TRANSCRIPTION_MODELS = ["gpt-4o-mini-transcribe", "gpt-4o-transcribe"]


class AISettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    enabled: bool
    text_model: TextModel
    transcription_model: TranscriptionModel


class APIKeyReplace(BaseModel):
    model_config = ConfigDict(extra="forbid")
    api_key: SecretStr
    confirm_api_key: SecretStr

    @field_validator("api_key", "confirm_api_key")
    @classmethod
    def valid_key(cls, value: SecretStr):
        secret = value.get_secret_value()
        if (
            not 20 <= len(secret) <= 512
            or not secret.startswith("sk-")
            or not all(c.isascii() and (c.isalnum() or c in "-_") for c in secret)
        ):
            raise ValueError("Enter a valid provider API key without whitespace")
        return value

    @model_validator(mode="after")
    def match(self):
        if self.api_key.get_secret_value() != self.confirm_api_key.get_secret_value():
            raise ValueError("API key and confirmation must match")
        return self


class AISettingsResponse(BaseModel):
    enabled: bool
    configured: bool
    database_key_present: bool
    credential_source: Literal["database", "environment", "none"]
    encryption_status: Literal["ready", "missing", "invalid", "unreadable"]
    text_model: str
    transcription_model: str
    text_models: list[str] = TEXT_MODELS
    transcription_models: list[str] = TRANSCRIPTION_MODELS
    fallback_active: bool
    fallback_available: bool = True
    updated_at: datetime | None
    updated_by: UUID | None


class ConnectionResult(BaseModel):
    status: Literal[
        "connected",
        "authentication_failed",
        "rate_limited",
        "provider_unavailable",
        "model_unavailable",
        "not_configured",
        "disabled",
    ]
