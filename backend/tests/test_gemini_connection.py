import json

import httpx
import pytest
from google.genai import Client as SDKClient
from google.genai import errors

from app.core.config import Settings
from app.services.provider_connection import test_gemini_connection as probe


@pytest.mark.parametrize(
    "failure,expected",
    [
        (None, "connected"),
        (TimeoutError(), "timeout"),
        (httpx.ReadTimeout("private transport details"), "timeout"),
        (httpx.ConnectError("private network details"), "provider_unavailable"),
        (429, "rate_limited"),
        (401, "authentication_failed"),
        (403, "authentication_failed"),
        (404, "model_unavailable"),
        (500, "provider_unavailable"),
        ("invalid_json", "provider_unavailable"),
        (400, "authentication_failed"),
    ],
)
def test_synthetic_sdk_probe_is_bounded_and_safe(monkeypatch, failure, expected):
    calls = []

    class Models:
        def generate_content(self, **kwargs):
            calls.append(kwargs)
            assert kwargs["model"] == "gemini-3.1-flash-lite"
            contents = kwargs["contents"]
            assert '"resume_excerpt": ""' in contents
            assert '"previous_answers": []' in contents
            assert '"profile_summary": ""' in contents
            if isinstance(failure, Exception):
                raise failure
            if isinstance(failure, int):
                raise errors.ClientError(failure, {"error": {"message": "API key invalid"}})
            data = (
                "not JSON"
                if failure
                else json.dumps(
                    {
                        "question": "How does an SQL index affect database read performance?",
                        "category": "sql",
                        "difficulty": "Beginner",
                    }
                )
            )
            return type("Response", (), {"text": data})()

    class Client:
        models = Models()

        def __init__(self, **kwargs):
            assert kwargs["http_options"].timeout <= 30000
            assert kwargs["http_options"].retry_options.attempts == 1

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

    monkeypatch.setattr("app.services.ai_provider.genai.Client", Client)
    settings = Settings(_env_file=None, gemini_api_key="synthetic-test-key")
    assert probe(settings) == expected
    assert len(calls) == 1


@pytest.mark.parametrize(
    "model", ["gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"]
)
def test_model_specific_thinking_and_wire_json_schema(monkeypatch, model):
    from app.services.ai_provider import CandidateContext, GeminiQuestionProvider, GeneratedQuestion

    generated = {
        "question": "How do SQL indexes affect reads, writes, and storage?",
        "category": "sql",
        "difficulty": "Beginner",
    }
    payloads = []

    def handler(request):
        payload = json.loads(request.content)
        payloads.append(payload)
        assert request.url.host == "generativelanguage.googleapis.com"
        assert "/v1beta/models/" + model + ":generateContent" in request.url.path
        config = payload["generationConfig"]
        assert "responseSchema" not in config
        assert config["responseJsonSchema"]["additionalProperties"] is False
        assert "additional_properties" not in json.dumps(payload)
        thinking = config["thinkingConfig"]
        if model == "gemini-3.1-flash-lite":
            assert (
                thinking.get("thinkingLevel", thinking.get("thinking_level", "")).lower()
                == "minimal"
            )
            assert "thinkingBudget" not in thinking and "thinking_budget" not in thinking
        else:
            assert thinking.get("thinkingBudget", thinking.get("thinking_budget")) == 0
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {"role": "model", "parts": [{"text": json.dumps(generated)}]},
                        "finishReason": "STOP",
                    }
                ],
                "modelVersion": model,
            },
        )

    def client_factory(**kwargs):
        kwargs["http_options"] = kwargs["http_options"].model_copy(
            update={"client_args": {"transport": httpx.MockTransport(handler), "trust_env": False}}
        )
        return SDKClient(**kwargs)

    monkeypatch.setattr("app.services.ai_provider.genai.Client", client_factory)
    settings = Settings(_env_file=None, gemini_model=model, gemini_api_key="synthetic-test-key")
    context = CandidateContext(
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
    assert GeminiQuestionProvider(settings).generate(context) == GeneratedQuestion(**generated)
    assert len(payloads) == 1
