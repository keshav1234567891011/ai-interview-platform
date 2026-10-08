# Milestones 07–09 verification

## Delivered scope

| Milestone | Commit | Verified before delivery |
| --- | --- | --- |
| 07: evaluation and voice | `374886069a718df4d1deb67f37dcaf04d1ffd248` | 72 backend tests; 51 mocked browser checks; lint, TypeScript, build, migrations and live PostgreSQL results flow |
| 08: scheduling, analytics, admin and avatar | `01f724eb1a3984adb0637eec18b1988466bf4c19` | 78 backend tests; 70 browser checks across the full suite and added admin-save test; lint, TypeScript, build, migrations and live PostgreSQL scheduling/admin flow |
| 09: production preparation | See branch `09-production-readiness` | 101 backend tests; 74 mocked browser checks; standalone build, Ruff, lint, TypeScript, dependency consistency, migration/schema validation and live browser flow |

Each branch is delivered with a normal push and a fast-forward into main; no history rewrite or external deployment is part of this task.

## Real local validation

The root `npm run dev` command was executed and successfully reused healthy InterviewAI services at `http://localhost:3000` and `http://127.0.0.1:8010`. Health, docs, readiness and the frontend API proxy were checked. PostgreSQL connectivity and ORM schema parity were verified at Alembic revision `0008`, applying only reviewed additive migrations to `ai_interview_db`.

The real browser flow checked registration, login, current user, dashboard, profile save/reload, logout/protected redirects, synthetic DOCX upload/reload, job skill matching, deterministic interview drafts/recovery/completion, persisted baseline results, real history/analytics, UTC scheduling/rescheduling/cancellation/start and ordinary-user admin denial. Only a generated validation account was temporarily promoted to verify safe admin details. Its account, files, schedules, answers, evaluations and user-specific quotas were removed afterwards; existing users were untouched. Shared peer-IP counters are operational aggregates and are not erased by account cleanup.

One live run was interrupted during admin navigation while development configuration was being updated. Its cleanup succeeded, and a subsequent stable run passed every stage. No unresolved application error remains from that interruption.

## Security/performance checks

- Tests cover ownership, JWT/session versions, activation/roles, mass-assignment rejection, shared quota persistence/reset, failed-login counting and rate rejection without interview mutation.
- Declared and streamed payload limits are tested before parsing. PDF decompression is bounded before expansion; compressed oversized content is rejected. Audio validation/transcription runs in backend workers and uses only mocks in tests.
- Responses/logs omit private exception details. CORS origins and storage paths are constrained. Git/Docker ignore environment files, upload directories and runtime/browser artifacts.
- Production browser requests prove landing/login/dashboard do not fetch Three.js/Recharts chunks. WebGL/reduced-motion/speech fallbacks are tested; failed 3D module downloads preserve the text draft and submission controls.
- Responsive dark/light pages were checked with Axe and overflow assertions. Real microphone hardware and every browser's speech service were not tested.

## Limits of verification

AI generation, evaluation and server transcription tests use mocks; no paid/live OpenAI request occurred. Successful fallback does not establish provider availability or nuanced scoring accuracy. Voice tests simulate permission/recording boundaries rather than requiring microphone hardware.

Docker CLI is installed, but its Linux daemon was unavailable. With a repository-local Docker configuration, Compose was also unavailable. Local image builds and Compose runtime validation were therefore **not performed**. YAML structure, context exclusion and non-root multi-stage definitions were checked by tests; those checks do not replace actual image builds. Start Docker Desktop manually and use the build commands in [deployment](deployment.md) to validate containers. No global installation/configuration was attempted.

GitHub Actions is configured to run checks and image builds; its hosted result is not claimed by local verification. Production still requires HTTPS/ingress configuration, secret management, backups, durable resume storage and a retention/deletion policy. See [security](security.md) for implemented safeguards and remaining extensions.
