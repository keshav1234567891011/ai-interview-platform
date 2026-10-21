# Production launch runbook: Vercel, Render, Neon and private object storage

This is a prepared deployment, not a deployed service. Do not publish, connect live infrastructure, run production migrations or incur charges before explicit **GO LIVE** approval. GitHub pushes and CI run tests/builds only. `render.yaml` disables automatic deployments. Creating/importing a hosting project can trigger a deployment: do that only after approval, not as an unattended preparation step.

## Release gates and current configuration blockers

Before public access, require fresh hosted CI success, production configuration and `/ready` checks, private durable storage, backup/restore verification, explicit cost/domain choices and an acceptance test on the actual HTTPS URLs. Local/mocked tests do not establish these properties. Docker Desktop's Linux engine must run to validate local container builds; do not install or alter global tools automatically.

The intended topology is browser → Vercel Next.js same-origin `/api` proxy → Render FastAPI → Neon PostgreSQL. Uploaded resume objects use private S3-compatible storage. No API key belongs in the frontend. No paid resource or provider call is approved by this document.

## 1. Independent production secrets

Configure values privately in the provider's environment/secret interface. Never copy exposed development values into production or put values in CLI arguments, logs, build arguments, chat, source or screenshot reports.

| Backend variable | Requirement |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_URL` | Neon pooled `postgresql+psycopg` URL; retain required TLS parameters |
| `MIGRATION_DATABASE_URL` | Neon direct/unpooled URL for deliberate Alembic runs; retain TLS |
| `JWT_SECRET` | Fresh independent random signing secret, at least 32 bytes |
| `SETTINGS_ENCRYPTION_KEY` | Fresh independent Fernet key; privately backed up and stable |
| `FRONTEND_ORIGINS` | JSON list of exact approved Vercel/custom HTTPS origins |
| `OPENAI_API_KEY` | Optional fallback; omit for deterministic behavior until owner adds a credential |
| `OPENAI_MODEL` / `OPENAI_TRANSCRIPTION_MODEL` | Supported defaults; owner may later change models in the UI |
| `STORAGE_BACKEND` | `s3` |
| `S3_BUCKET`, `S3_REGION` | Dedicated private bucket and region |
| `S3_ENDPOINT_URL` | HTTPS S3-compatible origin, or omit for AWS S3 |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Dedicated least-privilege object credentials |
| `S3_SESSION_TOKEN` | Optional explicit session credential |

The frontend needs only server-side build-time `BACKEND_API_URL=https://YOUR_RENDER_HOST`. No JWT, encryption, API or database secret belongs in Vercel's public variables. Actual deployment must provide the real backend origin before building; Vercel builds reject missing/localhost/plain-HTTP destinations. Environment changes require a rebuild/restart as appropriate.

From the backend runtime, `python -m app.release_check` performs a read-only static configuration preflight with safe blocker names. Passing it does not prove database/storage/network availability or substitute for launch approval.

## 2. Neon schema and existing data

Use a dedicated production role/database with minimum required privileges, TLS (`sslmode=require` or verified TLS according to Neon instructions), and private credentials. The application pool is bounded (default 2 connections + 3 overflow per worker); pooled connections disable automatic prepared statements. The migration process uses a separate direct URL and no persistent pool.

Decide explicitly whether to migrate existing local application records into Neon. Schema migrations alone do not transfer users, owner accounts, interviews or uploaded files. **Do not bootstrap or recreate the existing owner as a substitute for data transfer.** If preserving the same accounts is required, an approved encrypted database export/import and private object transfer must preserve identifiers and password hashes without exposing them. Never paste or commit database exports; use a dedicated ignored project-local backup directory and protect exported personal data. Do not restore into a populated production database without a separately reviewed merge/restore plan.

Before any production migration, take a provider-supported backup/restore point and verify its plan-specific retention and cost. Test restoration into an isolated Neon branch/database with approval; it can incur charges. Verify schema revision, owner count/state and representative record counts without printing passwords, hashes or candidate contents.

Only after approval and reviewed backup/restore arrangements, run from the new backend environment:

```text
python -m alembic upgrade head
python -m alembic current
```

Migration `0010` only creates the AI settings table and preserves existing users/data. Never automatically delete/recreate the database, downgrade a live schema or run bootstrap on startup. Production driver failures must be handled through private/redacted operations logs, never pasted as full connection diagnostics. The application returns generic errors.

## 3. Durable private resume storage

Provision a dedicated private S3-compatible bucket after provider/cost approval. Disable public access. Allow only the application prefix `resumes/` and necessary PutObject/DeleteObject privileges; operator backup/read access should be separate. Require TLS and provider-side encryption at rest, versioning/backup policies and restricted administrative access. The adapter does not issue public ACLs, browser download URLs or list-bucket requests. Keys are application-generated identifiers validated on every operation. Explicit credentials are required; SDK profile paths are redirected to project-local paths, preventing reads of personal AWS files or ambient credential discovery.

The app stores extracted text and metadata in PostgreSQL. Existing local upload objects do not automatically move to object storage; migrate them deliberately while preserving storage keys and counts. Do not switch a populated instance's storage backend until transfer and retrieval/cleanup paths have been validated. Raw audio remains short-lived and is not permanently stored by the application.

Missing bucket/provider credentials are a real launch blocker. Local/container filesystem storage is appropriate only for development or a deliberately backed-up single-host volume, not Render's ephemeral filesystem.

## 4. Render backend

After GO LIVE approval, connect the existing GitHub repository and choose the reviewed `main` commit. The prepared `render.yaml` uses the backend Dockerfile from the repository root, environment values supplied privately, `/ready`, and automatic deployments off. No PostgreSQL resource or paid disk is created by this blueprint. The container runs as a non-root account, binds `0.0.0.0:$PORT` (default 8000), suppresses access logs and disables untrusted forwarded-header handling. Container liveness uses `/health`; the hosting readiness gate uses `/ready`.

The blueprint selects Free to avoid an unapproved paid tier. Render describes Free as a preview/hobby option and does not recommend it for production. It spins down on idle, has cold starts and ephemeral local files. Choose explicitly between a portfolio preview with these limits and an approved paid production service; do not promise production uptime or silently upgrade. Free also lacks some operator capabilities. A controlled one-off migration runner may be required; do not add schema mutation to ordinary startup to work around missing shell/pre-deploy features.

## 5. Vercel frontend

After GO LIVE approval, import the same repository with root directory `frontend`, framework Next.js and the provided `frontend/vercel.json`. Include repository source outside the root directory so `config/development.json` is available for the build; it supplies only local defaults, never production secrets. Supply the real HTTPS backend `BACKEND_API_URL` before building. Select the intended plan/domain within approved cost limits; existing Git integration must not publish changes before approval.

Set Render `FRONTEND_ORIGINS` to the exact approved Vercel/custom origin(s), never a credentialed wildcard. Do not allow every arbitrary preview domain. Test cookies through the same-origin proxy over HTTPS: Secure/HttpOnly/SameSite cookies and CSRF custom headers remain required. Configure/test HSTS, target-specific nonce CSP, trusted ingress/client throttling and platform resource/body limits without breaking microphone or Next.js hydration.

## 6. Acceptance, monitoring and rollback

Verify public frontend, backend liveness/readiness, authentication/authorization, owner AI controls, delegated admin permission changes, private uploads, deterministic interview/recovery/results, scheduling and analytics. Use temporary approved accounts; do not change the real owner's password or mutate their provider settings for tests. Real paid AI requests and actual microphone hardware remain separate opt-in checks.

Monitor readiness, safe operational failure labels, provider usage/cost, object-storage capacity and quotas. Do not enable HTTP/SQL/provider debug logging or retain raw sensitive transcripts in logs. Coordinate API-key, encryption-key and database credential rotations with a tested rollback procedure and private key backups. Rolling back application images does not roll back schema or personal data. Restore production data only with explicit approval.

## Retention and remaining account workflows

Current behavior: account/profile, extracted resume text, job descriptions, submitted answers/transcripts, evaluations, schedules and audit records remain until an authorized deletion/retention operation is deliberately performed. Raw audio is not retained permanently; provider-side retention is governed separately by provider policy. Shared abuse counters are swept after approximately two days of inactivity. No general self-service erasure/retention scheduler exists.

Before public launch, choose and document actual retention periods, a user data-request/deletion process and matching database/object-backup expiry. Never invent legal consent or automated erasure. Email verification and public email-based password recovery are **not implemented**: no sender/provider infrastructure exists in this repository. To implement them, an approved email provider, verified sending domain/from address, server-only provider credentials and approved frontend URL are needed, followed by hashed single-use expiring token persistence, generic responses, rate limits, session revocation and isolated delivery tests. No paid email provider is assumed.

References: [Render Blueprint specification](https://render.com/docs/blueprint-spec), [Render Free limitations](https://render.com/docs/free), [Vercel monorepos](https://vercel.com/docs/monorepos), [Neon pooling](https://neon.com/docs/connect/connection-pooling).
