"""Descriptive delivery signals, not psychological or correctness judgments."""

import re
from collections import Counter

from app.schemas.evaluation import CommunicationSignals


def communication_signals(text: str, duration: float | None = None) -> CommunicationSignals:
    words = re.findall(r"\b[\w']+\b", text)
    fillers = Counter(word.lower() for word in words if word.lower() in {"um", "uh"})
    # Ambiguous expressions count only as comma-separated discourse markers.
    # 'I like SQL' and 'sort of algorithm' are not classified as fillers.
    for term in ("like", "you know", "actually", "basically", "so", "i mean", "kind of", "sort of"):
        pattern = r"(?:^|[,;.!?]\s*)" + re.escape(term) + r"\s*,"
        count = len(re.findall(pattern, text, flags=re.I))
        if count:
            fillers[term] = count
    count = sum(fillers.values())
    wpm = round(len(words) * 60 / duration, 1) if duration and duration > 0 else None
    pace = (
        None
        if wpm is None
        else (
            "very slow"
            if wpm < 80
            else "measured"
            if wpm < 120
            else "balanced"
            if wpm <= 180
            else "fast"
            if wpm <= 220
            else "very fast"
        )
    )
    suggestions = ["Start with the core definition, then explain your approach and an example."]
    if count:
        suggestions.append(
            "Try a brief silent pause instead of filling thinking time with 'um' or 'uh'."
        )
    if pace in {"fast", "very fast"}:
        suggestions.append(
            "Leave a little space between ideas so an interviewer can follow the explanation."
        )
    if len(words) > 350:
        suggestions.append(
            "Lead with the key point and keep supporting details relevant to the question."
        )
    return CommunicationSignals(
        word_count=len(words),
        sentence_count=len(re.findall(r"[^.!?]+(?:[.!?]|$)", text.strip())),
        filler_count=count,
        fillers_per_100_words=round(100 * count / max(1, len(words)), 1),
        frequent_fillers=dict(fillers.most_common()),
        duration_seconds=duration,
        words_per_minute=wpm,
        pace=pace,
        recommendations=suggestions,
    )
