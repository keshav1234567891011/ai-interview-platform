# Deployment preparation

No external deployment is performed or claimed. Dockerfiles and CI prepare the project for a controlled deployment; configure the target infrastructure separately.

## Required environment

Use `backend/.env.example` and `frontend/.env.example` as formats only. Actual files must remain ignored. Configure secrets manually in a deployment secret store/environment, never in Docker build arguments or source.

| Setting | Purpose |
| --- | --- |
| `APP_ENV=production` | Secure session cookies and production behavior |
| `DATABASE_URL` | PostgreSQL URL using `postgresql+psycopg`, URL-encoded credentials and appropriate TLS |
| `JWT_SECRET` | Cryptographically random secret, at least 32 bytes; rotating it invalidates sessions and quota keys |
| `JWT_ALGORITHM=HS256` | Only supported pinned algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session lifetime, default 30 |
| `FRONTEND_ORIGINS` | JSON list of exact frontend HTTPS origins |
| `OPENAI_API_KEY` | Optional server-only key; empty preserves deterministic operation |
| `OPENAI_MODEL`, `AI_TIMEOUT_SECONDS` | Optional generation/evaluation model and bounded provider timeout |
| `STORAGE_DIRECTORY=runtime/uploads` | Backend-relative resume directory, mounted durably |
| `BACKEND_API_URL` | Frontend **build-time** server-only backend destination |

The frontend public URL is the HTTPS origin configured at ingress and in `FRONTEND_ORIGINS`; there is no duplicate browser API URL variable. The backend can remain private, and its address is supplied through `BACKEND_API_URL` during the frontend build. Container defaults use `http://backend:8000` on their private network; this does not change local development's port 8010.

## Database migrations

Back up PostgreSQL before deploying a schema change. Review the migration, then run it once using the new backend image/environment before accepting application traffic:

```text
python -m alembic upgrade head
python -m alembic current
```

These commands run from `backend/` or `/app/backend` inside its image. There is no automatic database creation, deletion, recreation or destructive startup reset. Migration 0008 adds shared rate-limit buckets. Verify `/ready` after applying migrations; it requires the deployed migration head, a working database and JWT configuration. `/health` reports process liveness and can succeed while readiness fails.

Offline/isolated validation does not require secrets:

```text
python -m app.migration_check
```

Production rollback needs a reviewed data/schema strategy; do not blindly downgrade a live database. SQLite round trips are tests, not a production rollback recommendation.

## Container builds

Run from the repository root after Docker is installed and its Linux engine is running:

```text
docker build -f backend/Dockerfile -t interviewai-backend:local .
docker build -f frontend/Dockerfile -t interviewai-frontend:local .
```

Both Dockerfiles use the root build context and root `.dockerignore`. Do not change to an unfiltered parent context. A filtered source copy keeps secrets, environments, user uploads and browser/test artifacts out of images. The backend copies only runtime source/migrations/config; the frontend runtime contains only standalone output and assets. Both run as non-root users. Frontend `--build-arg BACKEND_API_URL=https://YOUR_PRIVATE_BACKEND_HOST` is permitted because the destination is non-secret; do not supply API/database secrets as build arguments.

Images use Node 24 and Python 3.14 slim bases. Frontend dependency versions use the npm lockfile; backend requirements use the reviewed `constraints.txt` snapshot, including transitive versions. Constraints do not install development-only packages into runtime images. Update dependencies deliberately and rerun checks. Pin reviewed base-image digests for a reproducible release and patch them regularly. Runtime images do not contain development tests or browser tooling.

## Production-like Compose

`compose.yaml` starts only the application, not PostgreSQL. Provision a database separately and manually supply environment values reachable from the containers. `localhost` in a database URL refers to the container itself; use the managed database host, or `host.docker.internal` for your already running local PostgreSQL when that host route is available. Do not change PostgreSQL server/global configuration through this project.

An ignored, manually created `backend/.env.production` can hold container-specific values. Do not print it or run `docker compose config` without `--quiet` because rendered configuration can expose secrets.

```text
docker compose --env-file backend/.env.production config --quiet
docker compose --env-file backend/.env.production build
docker compose --env-file backend/.env.production run --rm backend python -m alembic upgrade head
docker compose --env-file backend/.env.production up -d
```

The production default needs HTTPS for authentication: place a TLS reverse proxy in front of the frontend's loopback-bound port. Do not expect Secure cookies to authenticate over plain HTTP. For an isolated HTTP-only local container smoke test, deliberately set `APP_ENV=development` and exact `FRONTEND_ORIGINS=["http://localhost:3000"]` in that ignored configuration; never use that setting for a public deployment. Ordinary local development remains `npm run dev` and does not require Docker.

The named `resume_data` volume persists single-host files. Back it up; do not remove it casually. This is not distributed object storage. For multiple hosts/ephemeral deployment, implement the existing `ResumeStorage` interface with durable private object storage and a retention policy. Audio is not permanently stored by the application.

## Ingress and release checks

- Route browser API traffic through the same-origin frontend proxy. Restrict direct backend access and use TLS at ingress.
- Apply per-client throttling, body/connection limits, upload deadlines and resource limits. Backend forwarded-IP trust is disabled by default; configure only known proxies if changing it.
- Configure HSTS and a tested nonce-based CSP for the target environment; avoid a policy that breaks Next.js hydration or microphone controls.
- Monitor `/ready`, operational event labels, external provider usage/budgets and storage capacity. Keep logs private and redact query strings.
- Perform backup/restore tests and define account/resume/transcript retention and deletion procedures before public launch.
- Run real target-environment auth, upload, audio-permission and accessibility checks. Unit mocks cannot prove every browser/hardware/provider combination works.

## CI

`.github/workflows/ci.yml` validates lint, TypeScript, mocked Chromium UI tests, production build, backend tests/Ruff, SQLite migration round trips/PostgreSQL offline SQL, root development configuration and both image builds. It does not deploy or publish images, needs no OpenAI key and does not connect to a production database. Browser system dependencies are installed only in the ephemeral GitHub runner. The workflow's actual remote result must be checked on GitHub after pushing; creating it is not evidence that its hosted run passed.
## Owner setup

After reviewed migration upgrade, configure `OWNER_BOOTSTRAP_EMAIL` and a private temporary `OWNER_BOOTSTRAP_PASSWORD` in the backend environment and run `python -m app.cli bootstrap-owner` using the backend environment/container. The command is idempotent and refuses a different existing owner. Sign in through HTTPS and perform the mandatory first password change, then remove the bootstrap password from deployment configuration. Do not automatically run bootstrap with a newly generated password on every deployment. Existing administrator permissions must be explicitly reviewed and assigned by the owner. See [owner security and delegation](owner-control-center.md).
