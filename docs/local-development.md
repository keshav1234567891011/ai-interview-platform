# Local development and validation

Run `npm run dev` from the repository root. Shared addresses live in `config/development.json`:

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:8010`
- Health: `http://127.0.0.1:8010/health`
- API docs: `http://127.0.0.1:8010/docs`

Browser requests use the existing same-origin `/api/*` proxy. The launcher supplies its backend destination from the shared configuration; frontend deployments can still supply `BACKEND_API_URL`. CORS permits explicit frontend origins and credentials, with no wildcard. `FRONTEND_ORIGINS` remains environment configurable.

The launcher starts local Next.js and Uvicorn. It watches Python source files under `backend/app` and restarts its own held Uvicorn child handle on changes. This avoids the observed Windows reload-worker shutdown without recovery. It can reuse an existing InterviewAI service after checking its application responses. It never inspects or terminates the unknown service on port 8000. Shutdown affects only child processes that this launcher started. Reused services keep running under their original launcher.

## Validation on 2026-10-08

The root command started the new backend and safely reused the already running InterviewAI frontend, which reloaded its updated proxy configuration. Health, docs, and frontend/backend communication passed on the configured URLs. A controlled source timestamp change triggered the launcher's backend watcher without changing source contents; the replacement API process returned healthy responses and the frontend proxy continued working.

The opt-in live Playwright test exercised actual browser forms against PostgreSQL: registration, login, authenticated account/dashboard access, profile saving and reload, logout and protected-route removal, resume/job workspaces, and a curated three-question interview. A draft survived reload, one answer was submitted, and session progress persisted. Separate database sessions confirmed profile and answer persistence. Only the generated validation account and its dependent records were deleted afterward. No OpenAI request was made.

Backend verification passed 57 isolated tests, Ruff checks, formatting, dependency consistency, migration round trips, offline PostgreSQL migration compilation, and isolated FastAPI startup checks. The configured live PostgreSQL database is at Alembic revision `0005`. Frontend lint, strict TypeScript, production build, and all 46 existing browser regression tests passed, alongside the live end-to-end test.

Live browser validation can be repeated with `npm run test:live` from `frontend/`, while the root development command is running. It uses repository-local Chromium and temporary profiles. Its traces, screenshots, and videos are disabled. The default browser suite remains isolated on port 3107 with mocked feature responses. Backend tests ignore private local environment files and use isolated databases.

No dependencies, application features, credentials, or migrations were added by this repair. Real `.env` files, uploads, browser profiles, runtime logs, and validation artifacts remain Git ignored. Next.js may regenerate `frontend/AGENTS.md` during development; this generated tooling guidance is now ignored and is not an application dependency.
