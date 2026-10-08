"""Short-lived in-memory PCM audio; no recording is retained by this application."""

import wave
from io import BytesIO
from typing import Protocol

import httpx
from fastapi import HTTPException
from openai import OpenAI

from app.core.config import get_settings
from app.services.ai_provider import ai_configured

MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_DURATION = 300


def validate_audio(data: bytes, filename: str, content_type: str) -> float:
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "Recording exceeds the 10 MB limit")
    if not filename.lower().endswith(".wav") or content_type not in {
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
    }:
        raise HTTPException(415, "Send a PCM WAV recording")
    try:
        with wave.open(BytesIO(data), "rb") as recording:
            duration = recording.getnframes() / recording.getframerate()
            if (
                recording.getcomptype() != "NONE"
                or recording.getnchannels() != 1
                or recording.getsampwidth() != 2
                or recording.getframerate() != 16000
            ):
                raise ValueError("Unsupported format")
            if not 0 < duration <= MAX_DURATION:
                raise ValueError("Invalid duration")
            if len(recording.readframes(recording.getnframes())) != recording.getnframes() * 2:
                raise ValueError("Truncated audio")
    except Exception:
        raise HTTPException(
            422, "Recording must be valid mono 16 kHz PCM audio, at most five minutes"
        ) from None
    return duration


class TranscriptionProvider(Protocol):
    def transcribe(self, data: bytes) -> str: ...


class OpenAITranscriptionProvider:
    def transcribe(self, data: bytes) -> str:
        settings = get_settings()
        with httpx.Client(timeout=settings.ai_timeout_seconds, trust_env=False) as transport:
            with OpenAI(
                api_key=settings.openai_api_key.get_secret_value(),
                base_url="https://api.openai.com/v1",
                max_retries=0,
                timeout=settings.ai_timeout_seconds,
                http_client=transport,
            ) as client:
                response = client.audio.transcriptions.create(
                    model="gpt-4o-mini-transcribe", file=("answer.wav", data, "audio/wav")
                )
                text = response.text.strip()
                if not text or len(text) > 12000:
                    raise ValueError("Invalid transcript")
                return text


def get_transcription_provider() -> TranscriptionProvider | None:
    return OpenAITranscriptionProvider() if ai_configured() else None
