# Milestone verification

| Milestone | Backend tests | Browser tests | Scope |
| --- | ---: | ---: | --- |
| 02 | 16 | 16 | Accounts, password hashing, JWT sessions, protected access |
| 03 | 21 | 24 | Profile persistence, normalized skills, candidate workspace |
| 04 | 34 | 30 | Safe upload validation, parsing, skill review, job matching |
| 05 | 40 | 39 | Question selection, session state, drafts, completion, real history |
| 06 | 56 | 46 | Structured AI generation, failures, duplicates, adaptation, consent, fallback |

Each milestone also passed frontend ESLint, strict TypeScript, production build, backend Ruff checks/formatting, dependency consistency, migration round trips against ORM metadata, and offline PostgreSQL SQL validation. Browser tests cover responsive layouts, both themes, keyboard behaviors, accessible forms, and WCAG checks. UI HTTP responses are mocked; backend tests exercise actual ASGI routes and isolated SQLite persistence. Final draft normalization received a further focused 14-test browser regression run.

An isolated Uvicorn process passed health, docs, OpenAPI, and anonymous route protection checks, then was stopped. At the original milestone verification, existing services occupied the normal development ports, so a second root development process was not started. This historical record does not claim a fresh two-process startup or measured hot-reload behavior. Current local development uses the addresses in `config/development.json`, including backend port 8010; see the README for the current workflow.

During the original milestone verification, no live PostgreSQL connection or paid OpenAI request was made. Usable database and JWT configuration were absent. Provider tests include the official SDK's structured parsing through a mocked HTTP transport. All five migrations compiled for PostgreSQL offline and round-tripped in isolated SQLite. Later local runtime verification is recorded separately in [local development validation](local-development.md).

Repository review found no forbidden tracked files or known secret patterns; `.env.example` contains placeholders only. Real environment files, uploads, multipart temporary files, local environments, browsers, databases, logs, and test artifacts are ignored. Git uses the requested local GitHub identity and fast-forward-only milestone integration, without co-authors or force pushes.

Manual configuration: create ignored `backend/.env` with a dedicated PostgreSQL `DATABASE_URL` and a random `JWT_SECRET` of at least 32 bytes. Apply migrations once the database is configured before using account features. `OPENAI_API_KEY` is optional; no key means curated practice. Install or configure missing PostgreSQL services outside this repository manually. Never paste secrets into chat.

Remaining notices: the installed compatible ESLint 9 release carries an upstream deprecation notice; Playwright's color-environment notice is harmless. Production deployment still needs the controls described in the authentication, resume-analysis, and AI-interviewer documents. Detailed evaluation and analytics remain future work, outside milestone 06.
