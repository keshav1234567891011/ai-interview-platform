"""Explicit metadata-only connection probe: no generation or transcription call."""

import httpx

from app.schemas.ai_settings import TEXT_MODELS, TRANSCRIPTION_MODELS


def test_connection(settings) -> str:
    if (
        settings.openai_model not in TEXT_MODELS
        or settings.openai_transcription_model not in TRANSCRIPTION_MODELS
    ):
        return "model_unavailable"
    try:
        with httpx.Client(
            timeout=min(settings.ai_timeout_seconds, 5), trust_env=False, follow_redirects=False
        ) as transport:
            for model in (settings.openai_model, settings.openai_transcription_model):
                response = transport.get(
                    f"https://api.openai.com/v1/models/{model}",
                    headers={
                        "Authorization": "Bearer " + settings.openai_api_key.get_secret_value()
                    },
                )
                if response.status_code in {401, 403}:
                    return "authentication_failed"
                if response.status_code == 429:
                    return "rate_limited"
                if response.status_code == 404:
                    return "model_unavailable"
                if response.status_code != 200:
                    return "provider_unavailable"
            return "connected"
    except Exception:
        # No provider body, request, exception, header or URL is logged or returned.
        return "provider_unavailable"
