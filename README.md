# InterviewAI

Thoughtful preparation for the interview ahead. InterviewAI is a technical mock interview platform being built for students and job candidates, with personalized practice, structured feedback, and a clearer view of progress.

**Current milestone: `01-foundation-ui` — project foundation, design system, premium landing page, and backend foundation.**

The landing page is working. Its dashboards contain explicitly labeled, static demonstration data. Authentication, resume processing, interviews, AI evaluation, and analytics are **planned, not implemented**. Start Practicing and Sign In lead to an availability notice. Privacy and Terms lead to a placeholder notice.

## Planned capabilities

- Account creation, candidate profiles, and interview history
- Resume upload, skill extraction, and job description analysis
- Role-specific AI questions and adaptive interview difficulty
- Technical, reasoning, and communication evaluation
- Strengths, weaknesses, skill gaps, and personalized recommendations
- Performance analytics and progress tracking

These belong to later milestones. No business endpoints, application tables, fake API integration, or real candidate records are included here.

## Tech stack

| Layer | Foundation |
| --- | --- |
| Frontend | Next.js App Router, React, strict TypeScript, Tailwind CSS |
| UI | Geist, Lucide React, reusable local primitives, semantic CSS tokens |
| Backend | Python, FastAPI, Pydantic, pydantic-settings, Uvicorn |
| Database | PostgreSQL, SQLAlchemy, Psycopg |
| Migrations | Alembic, ready for future model discovery |
| Verification | ESLint, TypeScript, Playwright, axe-core, pytest, Ruff |

JWT, OpenAI integration, Docker, and Redis are future considerations. No API key is needed for this milestone. CSS handles the small animations; no animation or charting library is necessary yet.

## Architecture

The frontend and backend are separate applications. The Next.js page composes reusable layout, landing, and UI components. Only navigation and the theme toggle need client-side state. Geist font files are served locally by the installed package, so builds do not fetch fonts from Google.

FastAPI exposes `GET /health` with a Pydantic response schema. Database settings come from the environment or a project-local `backend/.env`. The SQLAlchemy engine is created on demand and does not connect during import or health checks. There are no application database models yet. Alembic uses the shared declarative metadata and reads the same database configuration.

```text
ai-interview-platform/
├── frontend/
│   ├── app/                 # App Router, metadata, favicon, global theme
│   ├── components/
│   │   ├── layout/          # Brand, container, navigation, theme, footer
│   │   ├── landing/         # Landing sections and demonstration dashboards
│   │   └── ui/              # Buttons, cards, section headings
│   ├── lib/                 # Explicitly static demo data
│   ├── public/              # Public assets
│   └── tests/               # Responsive and accessibility browser checks
├── backend/
│   ├── app/
│   │   ├── api/             # Health router
│   │   ├── core/            # Environment configuration
│   │   ├── db/              # Declarative base, lazy engine, session dependency
│   │   ├── models/          # Reserved for future models
│   │   ├── schemas/         # Typed API responses
│   │   ├── services/        # Reserved for future business logic
│   │   └── main.py          # Application factory and ASGI app
│   ├── alembic/             # Migration environment; no migrations yet
│   ├── tests/
│   ├── .env.example         # Placeholders only
│   ├── requirements.txt
│   └── requirements-dev.txt
├── docs/
├── .gitignore
└── README.md
```

## Prerequisites

Use Node.js 24 LTS and Python 3.12 or newer; this milestone was developed with Node 24 and Python 3.14. PostgreSQL is needed only when connecting to a database or running online migrations. Install any missing runtimes or PostgreSQL manually. Project setup does not install system-wide software or change global settings.

## Frontend setup and running

Run from the repository root in PowerShell:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. There is no frontend environment configuration or backend connection yet.

Frontend checks, from `frontend/`:

```powershell
npm run lint
npm run typecheck
npm run build
npm run start
```

Browser verification launches its own production server on port 3107. Keep that port available. Run from `frontend/` and set the browser directory to the absolute path **inside your clone**:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH="C:\Users\Asus\Project\ai-interview-platform\.local\browsers"
npx playwright install chromium --no-shell
npm run test:e2e
```

The suite checks six viewport widths in dark and light themes, horizontal overflow, automated WCAG A/AA accessibility, mobile navigation, Escape behavior, theme persistence, placeholder actions, skip-link focus, and reduced motion. Browser packages and generated reports are ignored by Git.

## Backend setup and running

From the repository root in PowerShell:

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Using the virtual environment executable directly avoids changing PowerShell execution policies. Production dependencies alone are in `requirements.txt`; the development file adds tests and lint tooling. Never install these dependencies into global Python.

Health endpoint: `http://127.0.0.1:8000/health`

```json
{"status":"ok"}
```

API documentation: `http://127.0.0.1:8000/docs`. The health endpoint reports application liveness; it does not test PostgreSQL connectivity.

Backend checks, from `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m alembic heads
```

## PostgreSQL and environment setup

No credentials are required to run the current app or health tests. Before using database functionality, create a PostgreSQL database and a dedicated application user manually. Create `backend/.env` yourself using `backend/.env.example` as the shape:

```dotenv
DATABASE_URL=postgresql+psycopg://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME
APP_ENV=development
```

Replace placeholders locally. URL-encode special characters in the username and password. Supported `APP_ENV` values are `development`, `test`, and `production`. Set environment variables in deployment rather than committing configuration. The database URL is redacted in settings representations and validation errors.

Alembic is ready, but no migrations are needed yet. In a later milestone, register models in `app/models/__init__.py`, then run from `backend/`:

```powershell
.\.venv\Scripts\python.exe -m alembic revision --autogenerate -m "describe schema change"
# Review the generated migration before applying it.
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Online migrations require a reachable PostgreSQL instance and a valid local `DATABASE_URL`.

## Development workflow and Git strategy

Keep each milestone scoped to its feature branch. The foundation branch is `01-foundation-ui`; do not merge it into `main` until it has been reviewed. Later milestones should use their explicitly agreed branch names. Never force push or rewrite published history.

Before committing: inspect `git status`, review changed files, run the relevant checks, review staged content for secrets, and stage only intended project files. The foundation commit message is:

```text
feat: establish project foundation and premium UI
```

Push the foundation branch to the configured repository origin with `git push -u origin 01-foundation-ui`. A remote URL and an authenticated Git workflow are required. Do not embed a token in a remote URL.

## Security

**Never commit `.env` files or credentials.** `.env.example` must contain placeholders only. Real passwords, API keys, tokens, cookies, and private keys must stay out of source, logs, screenshots, and chat. No real credentials have been created for this milestone.

Dependency environments, caches, temporary files, and browser downloads used during automated setup are kept inside this repository and ignored. Global Git, Node, Python, PostgreSQL, and Windows configuration are not changed. Review ignored files before sharing a directory archive.

See [the design system](docs/design-system.md), [milestone scope](docs/foundation.md), and [verification report](docs/verification.md) for implementation and check details.
