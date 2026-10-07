# InterviewAI

A technical interview preparation workspace for students and job candidates. The landing page contains clearly labeled demo dashboards; authenticated pages use real persisted account state.

## Current capabilities

- **02 — Accounts:** PostgreSQL user persistence, Argon2 password hashing, JWT sessions, registration, login, logout, and protected account access.
- **03 — Candidate workspace:** protected dashboard, real profile completion, normalized technical skills, profile editing, and safe account settings.
- **04 — Resume and role context:** private PDF/DOCX uploads, deterministic skill extraction with editable results, job skill analysis, and baseline matching.
- Interviews and AI assistance follow in subsequent milestones. Detailed scoring is not implemented yet.

## Stack and architecture

Next.js App Router, React, strict TypeScript, Tailwind CSS, Geist, and Lucide power the frontend. FastAPI, Pydantic, SQLAlchemy 2.x, Alembic, and Psycopg power the PostgreSQL backend. Layout, UI, and feature components share semantic dark/light theme tokens.

```text
frontend/   Pages, components, API client, browser tests
backend/    API, models, schemas, services, migrations, Python tests
docs/       Design system and milestone documentation
scripts/    Repository-local development orchestration
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

Starts the frontend with hot reload at `http://localhost:3000` and Uvicorn with reload at `http://localhost:8000`. PostgreSQL runs separately on port 5432. API docs: `/docs`; `GET /health` returns `{"status":"ok"}`. Ctrl+C stops the shared command.

Next.js forwards `/api/*` to `127.0.0.1:8000`. Configure `BACKEND_API_URL` in frontend deployments when the backend is elsewhere. No browser-exposed secret is needed. Configure `FRONTEND_ORIGINS` as a JSON list of explicit origins; the example permits `http://localhost:3000`.

## Session security

JWTs stay in an HttpOnly, SameSite=Lax cookie, never localStorage. Cookies are Secure in production. Browser writes require a custom header and an allowed Origin when supplied. Credentialed CORS uses explicit origins. Production requires HTTPS with frontend/backend routed under the same site.

JWT verification pins HS256, expiration, issuer, audience, and the user's session version. Logout revokes all existing account sessions. There is no refresh token; sign in again after expiry. Passwords use Argon2. Validation responses omit raw inputs; database errors remain generic. Auth attempts have a per-process limit; multiple production workers also require shared ingress throttling. Email verification and password reset are future work.

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

**Never commit `.env` files, credentials, or uploaded personal documents.** Examples contain placeholders only. Environments, caches, browsers, and artifacts stay repository-local and ignored. Detailed evaluation is a later milestone.

See [design tokens](docs/design-system.md), [foundation scope](docs/foundation.md), and [authentication decisions](docs/authentication.md).
