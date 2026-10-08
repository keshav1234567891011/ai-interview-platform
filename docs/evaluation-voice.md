# Evaluation and voice answers

Submitted answers receive stored feedback. The overall score uses technical correctness (40%), concept coverage (25%), reasoning (20%), practical examples (10%), and communication (5%). Optional AI evaluation uses validated output and only runs for an AI-enabled session. Errors, refusals, invalid output and missing keys use a deterministic baseline. Baseline estimates are conservative keyword/structure signals, not human-level assessments or hiring judgments. Older completed sessions receive baseline feedback when their results are opened.

Results belong to the interview owner. No expected-concept rubric is sent with an active question. Scores, concise feedback, submitted text/transcripts and delivery signals are persisted; hidden model reasoning is neither requested nor stored.

Microphone permission is requested only after Start recording. Stop, leaving the page, hiding the tab and the five-minute limit end recording and stop tracks. Review/playback and discard controls precede submission. Text remains available even when recording or transcription is unsupported or denied.

When server transcription is configured, candidates explicitly choose Transcribe recording. Browser audio is decoded and converted to mono 16 kHz PCM WAV. The server validates the actual file header, frames, type, size (10 MB) and duration (five minutes), processes it in memory and closes the temporary upload. It does not retain raw audio. The external transcription provider has its own data policies. Without configuration, browser speech recognition may use the browser vendor's service; manual text entry remains the fallback.

Communication analysis reports word count, sentence segments, contextual likely fillers and estimated pace when recording duration exists. Ambiguous fillers are counted only as discourse markers; this intentionally undercounts uncertain cases. Pace categories are descriptive and depend on measured duration and an edited transcript. No silence metrics are invented, and no emotion, personality, psychological confidence or demographic traits are inferred.

Automated tests use synthetic in-memory WAV audio, provider stubs and browser API mocks. They require neither microphone hardware nor paid requests.
