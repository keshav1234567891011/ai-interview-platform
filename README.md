# InterviewAI

A technical interview preparation workspace for students and job candidates. The landing page contains clearly labeled demo dashboards; authenticated pages use real persisted account state.

## Current capabilities

- **02 — Accounts:** PostgreSQL user persistence, Argon2 password hashing, JWT sessions, registration, login, logout, and protected account access.
- **03 — Candidate workspace:** protected dashboard, real profile completion, normalized technical skills, profile editing, and safe account settings.
- **04 — Resume and role context:** private PDF/DOCX uploads, deterministic skill extraction with editable results, job skill analysis, and baseline matching.
- **05 - Interviews:** role-aware question bank, persisted sessions and drafts, safe state transitions, and real interview history.
- **06 - AI assistance:** optional structured question generation, transparent adaptive difficulty, and automatic curated fallback.
- **07 — Evaluation and voice:** stored rubric-based feedback, private results, descriptive delivery signals, deliberate microphone recording, optional server/browser transcription, and always-available text answers.
- **08 — Complete workspace:** timezone-aware scheduling, score history, real analytics, an optional procedural 3D interviewer, question speech, and role-protected administration.

See [evaluation and audio privacy](docs/evaluation-voice.md) and [scheduling, analytics and admin bootstrap](docs/scheduling-admin-analytics.md).

## Stack and architecture

Next.js App Router, React, strict TypeScript, Tailwind CSS, Geist, and Lucide power the frontend. FastAPI, Pydantic, SQLAlchemy 2.x, Alembic, and Psycopg power the PostgreSQL backend. Layout, UI, and feature components share semantic dark/light theme tokens.

```text
frontend/   Pages, components, API client, browser tests
backend/    API, models, schemas, services, migrations, Python tests
docs/       Design system and milestone documentation
scripts/    Repository-local development orchestration
config/     Shared local frontend/backend addresses
```

## Setup

Use Node.js 24 and Python 3.12+. Install missing runtimes and PostgreSQL manually. From the repository root in PowerShell:

```powershell
npm --prefix frontend ci
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
```

Create `backend/.env` manually using `backend/.env.example` as the format. Set `DATABASE_URL` to your dedicated PostgreSQL database, and `JWT_SECRET` to a cryptographically random value of at least 32 bytes. Never paste secrets into chat or commit them. URL-encode special characters in database credentials. Placeholder values are not live credentials. `/health` works without a database; account endpoints require database and JWT configuration.

Apply reviewed migrations from `backend/`:

```powershell
.venv/Scripts/python.exe -m alembic upgrade head
```

## Development

From the repository root:

```powershell
npm run dev
```

Starts the frontend with hot reload at `http://localhost:3000` and FastAPI at `http://127.0.0.1:8010`. The root launcher watches Python files under `backend/app` and restarts only its own Uvicorn child on edits, avoiding a stalled Windows reload worker. PostgreSQL runs separately on port 5432. Open API docs at `http://127.0.0.1:8010/docs`; `http://127.0.0.1:8010/health` returns `{"status":"ok"}`. Ctrl+C stops processes started by this shared command. A healthy existing InterviewAI service may be reused; reused processes are never terminated by the launcher.

Local addresses are defined once in `config/development.json`, shared by the root launcher, Next.js API proxy, backend development CORS defaults, and live browser validation. Next.js forwards browser `/api/*` requests to `http://127.0.0.1:8010`; the browser stays on the frontend origin. Configure `BACKEND_API_URL` in frontend deployments when the backend is elsewhere. No browser-exposed secret is needed. Keep `config/` alongside the backend/frontend when packaging this monorepo. Configure `FRONTEND_ORIGINS` as a JSON list of explicit origins for deployment; the development example permits `http://localhost:3000`. Backend listen ports do not change the permitted browser origin.

## Session security

JWTs stay in an HttpOnly, SameSite=Lax cookie, never localStorage. Cookies are Secure in production. Browser writes require a custom header and an allowed Origin when supplied. Credentialed CORS uses explicit origins. Production requires HTTPS with frontend/backend routed under the same site.

JWT verification pins HS256, expiration, issuer, audience, and the user's session version. Logout revokes all existing account sessions. There is no refresh token; sign in again after expiry. Passwords use Argon2. Validation responses omit raw inputs; database errors remain generic. Auth attempts have a per-process limit; multiple production workers also require shared ingress throttling. Email verification and password reset are future work.

## Optional AI assistance

Set `OPENAI_API_KEY` only in ignored `backend/.env` to enable AI-assisted session setup. Keep it empty to use curated questions without an external AI service. `OPENAI_MODEL=gpt-5-mini` and `AI_TIMEOUT_SECONDS=15` are configurable. Candidates explicitly opt in before profile/resume/job context and recent answers are sent to OpenAI. Missing keys, timeouts, rate limits, and invalid output fall back automatically; the interview and submitted answers remain intact. Automated tests never need a paid request. See [AI privacy, adaptation limits, and provider decisions](docs/ai-interviewer.md).

## Checks

Frontend, from `frontend/`:

```powershell
npm run lint
npm run typecheck
npm run build
$env:PLAYWRIGHT_BROWSERS_PATH="C:\Users\Asus\Project\ai-interview-platform\.local\browsers"
npx playwright install chromium --no-shell
npm run test:e2e
```

Browser verification starts a production server on port 3107. Adjust the browser path to the absolute path inside your clone. UI tests mock HTTP responses; backend integration tests exercise real routes separately.

For opt-in end-to-end validation against the running development stack and configured PostgreSQL, run `npm run test:live` from `frontend/` after `npm run dev`. It uses the repository-local Chromium installation, creates a clearly marked temporary account, verifies registration/login/profile persistence and curated interview progress, then deletes only that account and its dependent records. No OpenAI key or paid API call is required. Browser traces/screenshots are disabled for this test to avoid retaining authenticated state.

Backend, from `backend/`:

```powershell
.venv/Scripts/python.exe -m pytest
.venv/Scripts/python.exe -m ruff check app alembic tests
.venv/Scripts/python.exe -m ruff format --check app alembic tests
.venv/Scripts/python.exe -m pip check
.venv/Scripts/python.exe -m alembic heads
```

Integration tests use isolated in-memory SQLite databases. Migrations are round-trip tested and compared with ORM metadata, and PostgreSQL SQL is validated offline with `scripts/validate_migrations.py` from `backend/`. These checks do not claim live PostgreSQL connectivity. Run `npm run test:dev-config` at the root to validate shared development configuration.

## Git and security

Each milestone branch fast-forwards from latest `main` before coding. After checks and source/secret review, commit and push it, then fast-forward and push `main`. Never force push or rewrite published history. Preserve the repository-local GitHub identity; do not modify global Git configuration or add co-author trailers.

**Never commit `.env` files, credentials, or uploaded personal documents.** Examples contain placeholders only. Environments, caches, browsers, and artifacts stay repository-local and ignored.

See [design tokens](docs/design-system.md), [foundation scope](docs/foundation.md), [authentication decisions](docs/authentication.md), [resume analysis](docs/resume-analysis.md), and [interview sessions](docs/interview-engine.md).

See [milestones 02-06 verification and configuration limits](docs/milestones-02-06.md).

See [current local development validation](docs/local-development.md) for the port repair and live PostgreSQL/browser verification.
