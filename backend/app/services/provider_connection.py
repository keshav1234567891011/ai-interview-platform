"""Separate OpenAI metadata and synthetic Gemini generation connection probes."""

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


def test_gemini_connection(settings) -> str:
    """Deliberate synthetic generation; never uses candidate data."""
    from google.genai import errors

    from app.services.ai_provider import CandidateContext, GeminiQuestionProvider

    try:
        GeminiQuestionProvider(settings).generate(
            CandidateContext(
                role="Backend Developer",
                difficulty="Beginner",
                focus_areas=["sql"],
                skills=["sql"],
                profile_summary="",
                resume_excerpt="",
                job_excerpt="",
                previous_questions=[],
                previous_answers=[],
            )
        )
        return "connected"
    except (httpx.TimeoutException, TimeoutError):
        return "timeout"
    except errors.APIError as exc:
        if exc.code == 400 and "api key" in (exc.message or "").casefold():
            return "authentication_failed"
        return {
            400: "request_rejected",
            401: "authentication_failed",
            403: "authentication_failed",
            404: "model_unavailable",
            408: "timeout",
            504: "timeout",
            429: "rate_limited",
        }.get(exc.code, "provider_unavailable")
    except Exception:
        return "provider_unavailable"
