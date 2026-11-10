"""Only allowlisted operation/reason/model metadata; never exception text or prompts."""

import logging
from collections import Counter

import httpx
from google.genai import errors
from pydantic import ValidationError
from sqlalchemy import select

from app.core.config import get_settings
from app.models.administration import AuditEvent

SERVICE_FAILURES = {
    "quota",
    "authentication",
    "model_unavailable",
    "request_rejected",
    "timeout",
    "network",
    "provider_error",
}


def failure_reason(exc: Exception) -> tuple[str, int | None]:
    if isinstance(exc, errors.APIError):
        return (
            {
                429: "quota",
                401: "authentication",
                403: "authentication",
                404: "model_unavailable",
                400: "request_rejected",
                408: "timeout",
                504: "timeout",
            }.get(exc.code, "provider_error"),
            exc.code,
        )
    if isinstance(exc, (httpx.TimeoutException, TimeoutError)):
        return "timeout", None
    if isinstance(exc, httpx.RequestError):
        return "network", None
    if isinstance(exc, (ValidationError, ValueError, TypeError)):
        return "invalid_output", None
    return "provider_error", None


def configuration_reason(db=None) -> str:
    from app.models.ai_settings import AISettings

    record = db.get(AISettings, 1) if db is not None else None
    return "disabled" if record and not record.enabled else "not_configured"


def record_fallback(db, operation: str, reason: str, *, attempted=False, http_code=None):
    logging.getLogger("interviewai").warning(
        "gemini_fallback operation=%s reason=%s attempted=%s http_code=%s model=%s",
        operation,
        reason,
        attempted,
        http_code,
        get_settings().gemini_model,
    )
    if db is not None:
        db.add(
            AuditEvent(
                action="gemini_fallback",
                details={
                    "operation": operation,
                    "reason": reason,
                    "attempted": attempted,
                    "http_code": http_code,
                    "model": get_settings().gemini_model,
                },
            )
        )


def recent_diagnostics(db) -> list[dict]:
    if db is None:
        return []
    events = db.scalars(
        select(AuditEvent)
        .where(
            AuditEvent.action == "gemini_fallback",
            AuditEvent.details["model"].as_string() == get_settings().gemini_model,
        )
        .order_by(AuditEvent.created_at.desc())
        .limit(100)
    ).all()
    counts = Counter((e.details["operation"], e.details["reason"]) for e in events)
    return [
        {"operation": operation, "reason": reason, "count": count}
        for (operation, reason), count in sorted(counts.items())
    ]
