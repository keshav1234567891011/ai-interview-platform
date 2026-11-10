# Gemini assisted interviewing

Current release/security status and fresh test counts are in the [release report](release-readiness.md). Verification sections below record earlier implementation stages; their dependency warnings and counts are historical.

Interview question generation and answer evaluation use Google's official `google-genai` Python SDK from the FastAPI backend. The model defaults to `gemini-3.1-flash-lite`; backend `GEMINI_MODEL` also accepts legacy `gemini-2.5-flash` and `gemini-2.5-flash-lite` for previously eligible projects. Model listing does not prove generateContent access. Gemini 3.1 Flash-Lite uses thinking_level=minimal; the legacy 2.5 models use thinking_budget=0. No automatic model switching occurs. No Google billing account is needed for the Gemini 3.1 Flash-Lite free tier, subject to Google's current availability and project quotas. The application does not configure billing or automatically fall back to paid models. Check the [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) for current terms. Google's free-tier data-use terms apply.

## Configure a key

Create a key in [Google AI Studio](https://aistudio.google.com/app/apikey) from a project with no billing account linked, then set `GEMINI_API_KEY` only in the backend environment. For local development, add it to ignored `backend/.env` (see `backend/.env.example`). On Render, open the FastAPI web service's Environment settings and add `GEMINI_API_KEY`, then save/redeploy. Never add it to a `NEXT_PUBLIC_*` variable, frontend environment file, browser request, source control, or build argument. No database migration is needed. Without a key, the app stays on curated questions and deterministic feedback.

## Consent and data sent

AI assistance is off by default for each interview. Checking the explicit consent box allows the backend to send the candidate's role, selected skills/focus areas, bounded profile summary, resume excerpt and job-description excerpt, interview prompts, and up to three recent submitted answers to Google Gemini. The key remains in FastAPI. Leaving consent unchecked means candidate context and answers are not sent to Gemini. Google's free tier permits submitted content to be used to improve its products; review the linked terms and remove sensitive data before consenting.

On an opted-in session, Gemini generates a context-aware first question and adaptive follow-ups. Each submitted answer is evaluated for technical correctness, concept coverage, reasoning, practical application, and communication. A validated rubric and improved sample answer are stored with the existing question/answer records in PostgreSQL and shown in results. The question and evaluation provider never receives hidden expected concepts in the active question request. Structured output is schema-validated, and candidate material is treated as untrusted input.

The provider request uses a fixed model, a bounded timeout, JSON schema output, no tools, and no automatic retries. Google rate limits, quota exhaustion, network failures, invalid output, and refusals preserve the answer and use the curated question bank/deterministic rubric. Provider exception content is not returned or logged. Deterministic feedback is an estimate based on concepts and answer structure; it cannot establish nuanced correctness.

The existing owner AI settings and OpenAI integration remain for the separately optional legacy server-side transcription feature. Stored OpenAI credentials and models do not override Gemini. The owner enable/disable switch applies to both providers. The owner page separately shows Gemini configuration and offers a deliberate synthetic generation test. Configuration alone does not verify a live connection. Do not configure an OpenAI key if you do not want that optional transcription integration.


## Local and Render smoke test

1. In ignored `backend/.env`, set `GEMINI_API_KEY` to an AI Studio key from an **unbilled** project and `GEMINI_MODEL=gemini-3.1-flash-lite` and `AI_TIMEOUT_SECONDS=30`. Keep existing database, JWT and storage settings. Do not copy secrets into frontend files.
2. Locally run `npm run dev` from the repository root. For a future authorized deployment, manually add the three variables under Render > interviewai-api > Environment; preserve Neon/Supabase variables and Vercel BACKEND_API_URL. No live deployment was performed by this task.
3. Sign in as owner, enable the provider, and choose **Test Gemini connection**. A successful synthetic generation status verifies an actual validated generation. It consumes one request; no private candidate data is sent.
4. Sign in as candidate, create a three-question interview, explicitly check Gemini consent, and start. Confirm **Gemini AI question**. A bank question indicates fallback, regardless of key configuration.
5. Submit a technically weak answer, then a detailed correct answer. Follow-ups receive the saved technical evaluation, missed concepts and feedback. Weak technical scores lower difficulty; strong correctness and reasoning raise it. Missing concepts guide targeted follow-ups.
6. Finish and open results. Confirm **Gemini AI feedback**, five rubric scores, covered/missed concepts, feedback and improved sample answer. Reload to check persistence. Results never expose future sample answers.
7. Remove the local key and restart, or use a mocked 429 in tests. Interviews must still complete with bank questions and **Fallback mode** / baseline estimates. Leave consent unchecked and confirm no Gemini generation occurs.

Free-tier availability is project-dependent. The application cannot guarantee zero charges on an arbitrary billed Google account. Use an unbilled project, verify current AI Studio quotas, and never enable billing to resolve quota errors. Each N-question opted-in interview uses at most 2N generation attempts (N questions and N evaluations), with one SDK attempt per operation. A separate per-user Gemini budget allows two turns per minute and twenty per day (at most two calls per turn), pacing short bursts and using fallback when the daily allowance is exhausted. Existing processing quotas also bound requests; repeats cannot regenerate a started question or resubmit a completed answer. Prompts omit explicit identity fields, bound excerpts, and remain untrusted reference material; excerpts can still contain personal data, so review resume contents before consent.


## Implementation audit

The current tree already had a partial Gemini implementation. Creation still uses deterministic role/focus/profile/resume/job skill selection to persist exactly the requested number of bank questions. Start replaces only the first question after successful Gemini validation. Submitting an answer persists it, validates a Gemini rubric, stores the result in existing `answer_evaluations.details`, then generates the next question with that saved rubric and recent context. A backend `ai_enabled` check gates both generation and evaluation. GET/session responses hide future questions; completed results use stored evaluations and never call Gemini again. Legacy missing evaluations receive only deterministic estimates. Analytics use persisted scores.

The remaining deterministic behavior is deliberate: default bank mode, error/budget fallback, weighted overall-score calculation, aggregate analytics and communication delivery statistics. Fallback adaptation uses an effort heuristic; successful AI evaluation replaces that with technical/ reasoning score progression and supplies missing concepts and constructive feedback to Gemini. Resume/job skill extraction remains deterministic; no resume upload itself calls Gemini. Existing JWT/ownership checks and row locks serialize start/answer operations. No schema migration was necessary.

Owner OpenAI credentials remain encrypted and optional for transcription. Gemini uses only backend GEMINI_API_KEY, the owner master switch, and an allowlisted backend model. The key field in `.env.example` must always be blank; any credential previously placed in that example should be rotated by its owner if real.


## Verification (2026-11-10)

Verified on Node 24.21.0 and Python 3.14.3 using the existing backend virtual environment. Installed `backend/requirements-dev.txt` and ran `npm ci --prefix frontend`; Chromium was installed with `npx playwright install chromium` from `frontend`. Windows sandbox restrictions required elevated execution for npm install scripts, browser processes, the Next build worker and pytest temporary directories.

- Backend Ruff lint and formatting checks: passed.
- All backend tests: **164 passed**. Google SDK client construction is blocked by default in tests and explicitly mocked where needed; no Gemini quota was consumed.
- Migration checker: passed isolated SQLite upgrade/downgrade, metadata parity, and offline PostgreSQL SQL; no production connection.
- Frontend lint and typecheck: passed.
- Full Playwright suite: **104 passed**; after the final session-label correction, the focused interview/results/owner suite passed **29 tests** against the rebuilt app.
- Production build: passed on immediate retry after the pre-existing Next.js dependency security warning. npm install reported 10 dependency vulnerabilities (8 moderate, 1 high, 1 critical); security upgrades remain separate work.
- Root `npm run test:dev-config`, `pip check` and `git diff --check`: passed.
- GitHub Actions still targets Node 24 and Python 3.14; backend Gemini credentials are explicitly blank in CI. Hosted CI and Docker builds were inspected but not executed remotely.

No live Gemini request, deployment, commit, push, billing change, production migration or live secret change was performed. Live project model access and quota must be checked using the owner synthetic probe and manual smoke test above. A nonempty provider credential was removed from the example environment file; if real, its owner should rotate it.


## Gemini 3.1 model selection

The local development model is selected through ignored backend `.env`, not browser configuration. The allowlist includes only explicitly reviewed free-tier text models; no automatic discovery, paid-model selection or model upgrade occurs. Google currently documents [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite) with structured output support and [free-tier Standard text input/output](https://ai.google.dev/gemini-api/docs/pricing). Project quota and unbilled status must still be verified in AI Studio. Metadata/list access is distinct from generation eligibility, especially for restricted 2.5 models. Failed generation remains visibly labeled fallback.

The provider explicitly selects Gemini Developer API v1beta (not Vertex AI), keeps retries disabled and adapts thinking configuration to the selected model. Owner connection tests record only the model identifier and safe outcome in existing audit records. The page shows the last test for the current model after reload; configured credentials are never treated as proof of successful generation. No database migration is needed. Existing Render/Vercel production configuration is unchanged; a future authorized deployment must set backend GEMINI_MODEL explicitly.


The provider uses `response_json_schema=Schema.model_json_schema()` and validates the returned JSON again with Pydantic. The old `response_schema=Schema` route emitted `additional_properties` into Google's narrower Schema protobuf and was rejected with HTTP 400 INVALID_ARGUMENT. A regression test exercises the real installed Google SDK against an httpx mock transport and checks the serialized request body, preserving `additionalProperties` only inside `responseJsonSchema`. Model-specific thinking controls are tested for both 3.1 and legacy 2.5.


### Latest local live verification (2026-11-10)

The configured key successfully listed `models/gemini-3.1-flash-lite` with `generateContent`. Legacy `gemini-2.5-flash` model metadata was also readable; listing is not proof of generation eligibility. Exactly one synthetic replacement-model generation was attempted. It returned HTTP 400 `INVALID_ARGUMENT`: unknown `additional_properties` in `generation_config.response_schema`. The provider was then corrected to use `response_json_schema`, with real SDK serialization verified against an in-memory HTTP mock. After the owner explicitly authorized one additional synthetic attempt, the corrected request succeeded with `gemini-3.1-flash-lite`. Pydantic validated a generated SQL question, a full technical rubric (10/100 technical correctness for the deliberately incorrect synthetic answer), and a targeted follow-up from that single response. The owner page now retains `connected` for that model. No candidate data was sent and no further live generation occurred. Project billing-tier confirmation remains an owner responsibility; no billing setting was changed.


Model-change verification: 179 backend tests passed, including real SDK serialization over mocked HTTP and a consented two-question flow using the actual question/evaluation providers with mocked SDK output. The local browser read the persisted `connected` status and displayed the selected 3.1 model after reload without any additional generation. No live interview workflow was run; all personalization/adaptation/evaluation workflow requests were mocked to respect the live-call budget.

The full mocked Playwright suite passed 113 tests after the model change. Frontend lint/typecheck and the production build passed; the existing Next.js dependency security advisory still requires separate review before a public deployment.


## AI pacing and fallback diagnostics

The per-user safeguard remains **two AI turns per fixed minute and twenty per day**. An initial question uses one turn; each submitted answer uses one turn, for its evaluation and at most one next question. A five-question session therefore needs six turns and at most ten Gemini requests. SDK retries remain disabled. Each interview still has exactly the requested number of questions.

Previously, exhausting the minute allowance silently switched both evaluation and question generation to fallback. A rapid five-answer session could receive AI feedback only for its first answer. Short-term pacing now returns HTTP 429 with Retry-After, preserves the answer as a draft, and shows a countdown. The candidate retries submission after waiting; the countdown never sends automatic requests. Daily-budget exhaustion and actual provider errors still complete answers using labeled baseline estimates. Repeated starts and already-submitted answers do not consume another AI turn. Ownership, consent, question ordering and row-lock checks still apply.

New evaluation JSON records include a safe fallback reason and, for validated AI results, the configured model. The question's source remains independent of its evaluation's source. Results GET/reload uses saved data without requesting Gemini. Older history is not rewritten and may lack a fallback reason. No table changes or migration are needed.

Fixed diagnostic logs and existing audit records contain only the model, operation, an allowlisted reason, whether a request was attempted, and an HTTP code when available. They contain no prompts, answers, resume text, exception messages, keys, user/session IDs, or email addresses. The owner page aggregates the last 100 diagnostic events for the selected model. Reasons distinguish local minute pacing, daily budget, Gemini quota, timeouts, network/auth/model problems and invalid output. A service-level evaluation failure suppresses the immediate follow-up request in that same turn; later submissions may try again under the existing budget. No permanent session circuit breaker is added.

Adaptive prompts reuse the latest saved AI rubric's correctness/reasoning, missed concepts and constructive guidance. Communication statistics and the improved sample answer are omitted from the next-question context to reduce unnecessary tokens. If the latest assessment was baseline, its estimate is not treated as a Gemini assessment.


Pacing verification (2026-11-10): the inspected completed five-question session lasted 18 seconds, with all submissions in the same fixed minute. Consent remained enabled, the first evaluation and second question were saved as AI, and the local minute bucket was full at two turns. The latest five-question regression test runs with the real rate-limit code and a simulated clock: it verifies two paced submissions remain drafts, six total reserved turns, exactly ten mocked SDK calls, five AI evaluations, saved missing-concept adaptation, no calls for duplicate submissions/results reload, and persistent feedback. Additional tests verify daily exhaustion and safely diagnosed quota/timeout/network/malformed-output fallback. All 185 backend tests, Ruff, migration parity, frontend lint/typecheck and production build passed. No production data or historical evaluations were modified, and no live Gemini requests were made during this repair.

The full Playwright suite passed 115 tests, including the paced draft/countdown/retry path, distinct question/evaluation provenance, corrected fallback formatting, and owner diagnostic categories. A read-only local browser check also verified the actual existing report still has five saved assessments and displays the corrected labels. The existing Next.js dependency security advisory remains separate work; the production build passed on its documented immediate retry.
