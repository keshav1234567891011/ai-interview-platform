# Foundation verification

Verified on October 8, 2026, on branch `01-foundation-ui` with Node.js 24.21.0, Python 3.14.3, Next.js 16.4.0, TypeScript 6.0.3, and repository-local environments.

## Results

| Check | Result |
| --- | --- |
| ESLint, zero-warning threshold | Passed |
| TypeScript, `tsc --noEmit` | Passed |
| Next.js production build | Passed; landing page and favicon generated |
| Frontend dependency tree, `npm ls --all` | Passed; no dependency conflicts |
| Production dependency audit | Zero vulnerabilities reported |
| Playwright browser checks | 10 passed |
| Backend pytest suite | 6 passed, no warnings in final run |
| Ruff lint | Passed |
| Ruff format check | Passed |
| Python dependency consistency, `pip check` | Passed |
| Alembic heads | Passed; no revisions exist |
| Alembic offline PostgreSQL upgrade | Passed with placeholder URL; no database connection |
| Candidate source and environment example review | No forbidden files or known secret patterns detected; example uses placeholders |

## Browser coverage

Chromium tests use a dedicated production server at `127.0.0.1:3107`. The suite checks widths of 320, 375, 768, 1024, 1440, and 1920px in both dark and light themes. Every width passes the horizontal overflow assertion and axe WCAG 2 A/AA and WCAG 2.1 AA scans. Additional checks cover mobile menu disclosure, Escape and focus return, navigation anchors, theme persistence, honest placeholder actions, skip-link focus, reduced motion, button hover contrast, and expanded mobile navigation accessibility.

Desktop dark/light and mobile screenshots were inspected. Generated images and traces remain in the ignored `frontend/test-results/` directory. Automated accessibility scans do not replace human assistive technology testing.

## Backend coverage

Tests import every application module, create the FastAPI app, verify `GET /health` returns HTTP 200 and `{"status":"ok"}`, inspect OpenAPI metadata, confirm empty application metadata, validate and redact settings, verify a helpful missing-database error, and construct a PostgreSQL/Psycopg engine without opening a connection. HTTP verification uses HTTPX's ASGI transport against the real app.

No live PostgreSQL connection or online migration was attempted. No credentials, application tables, authentication, or AI endpoints are needed or implemented in this milestone.

## Resolved setup issues and remaining tooling notices

- Sandbox network restrictions initially blocked npm and pip. Scoped retries succeeded with caches, temporary files, dependencies, and browsers inside the repository.
- Python pip bootstrapping and Next.js workers initially hit execution sandbox permissions; scoped local retries succeeded.
- TypeScript 7 is incompatible with the installed Next.js lint parser. TypeScript is constrained to the compatible 6.0 series.
- ESLint 10 produces peer conflicts with the current Next.js plugins. ESLint 9 is used for compatibility; npm reports that release as deprecated. Lint itself passes without warnings.
- npm reports an unapproved optional `unrs-resolver` postinstall script. It was not needed for the successful lint/build checks; no global installation was performed.
- Playwright emits a harmless `NO_COLOR` / `FORCE_COLOR` environment notice from its runner. All browser tests pass.
- Port 3000 was already occupied. Verification uses port 3107 and does not stop or change the existing service.
- Early accessibility scans ran during entrance/theme transitions. The suite waits for animations to settle. A separate hover check identified and verified a fix for CTA contrast.

## Git delivery

Only intended source, configuration, documentation, lockfiles, tests, and the placeholder environment example are eligible for the foundation commit. Dependency directories, caches, virtual environments, temporary files, and test artifacts are ignored.

At verification time no `origin` remote was configured. GitHub delivery requires the repository URL and a normal authenticated Git workflow. No credentials were inspected or created.
