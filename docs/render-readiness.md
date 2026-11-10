# Render readiness repair for release 0196bea

The failing production deployment starts Uvicorn but never passes `/ready`.
The original endpoint returned the same generic 503 for every failure and logged
no stage. Its pool, connection and statement timeouts were each five seconds;
their combined duration could exceed Render's [five-second HTTP health-check
deadline](https://render.com/docs/health-checks). This is a confirmed deadline
defect, not proof of the specific production database failure.

Local read-only checks pass JWT validation, `SELECT 1`, and migration head `0010`.
Both locally available database URLs target the development database. Production
credentials and private Render logs are not available to the local diagnostic.
Do not replace existing production URLs/JWT settings or run migrations on this
evidence. The owner reports production is already at `0010`.

## Local verification

- Full backend suite: **218 passed**, including simulated connection/query failures,
  HTTP deadline enforcement, duplicate-probe prevention, secret-safe logs and recovery.
- Ruff lint and formatting, migration roundtrip/metadata/offline PostgreSQL SQL,
  dependency compatibility and source secret guard passed on Python 3.14.3.
- Real Uvicorn HTTP smoke against the isolated development PostgreSQL database:
  a simulated slow connection returned 503 in **3.514 seconds**; a repeated probe
  returned 503 in **0.006 seconds**; liveness stayed 200; readiness recovered to
  200 in **0.008 seconds** after the slow operation finished. Database checks were
  read-only; no Gemini requests were made.
- Docker/Render source configuration passed. A fresh Docker image build/run could
  not execute because the Docker daemon is unavailable; Docker Desktop was not started.
- The first full-suite attempt hit Windows sandbox permissions on pytest temporary
  directories. The successful run used approved access outside that restricted token.
  The remaining warning is the existing Google SDK Python deprecation warning.

## Patch behavior

- `/ready` still verifies JWT configuration, a real query through the application's
  database engine/pool, and exact migration-head parity. Failure returns generic 503.
- A 3.5-second response deadline includes worker scheduling, pool checkout, DNS,
  TLS, engine initialization, SQL and cleanup. Database work runs outside the
  event loop; liveness remains independent.
- Only one database probe can run at a time. Synchronous driver operations can
  outlive a response deadline; retries return 503 while that operation finishes.
  A later successful probe recovers automatically. No cached success is returned.
- PostgreSQL probe transactions are read-only, use a one-second local statement
  timeout, and roll back on close. Application and migration connection settings
  are preserved; no schema/data writes or Gemini calls are added.
- Safe `readiness_failed` logs contain the failing stage, fixed reason code,
  elapsed time and validated SQLSTATE when available. They never include exception
  text, tracebacks, database URLs, hostnames, passwords or API keys.

## Evidence required from the next approved deployment

Inspect **interviewai-api → latest deployment → Logs**, filtering `readiness_`.
Provide only those safe lines and the deployed commit/status. For example,
`stage=database_connection reason=database_authentication sqlstate=28P01` is a
credential failure; it is an example, not an observed production result.

| Stage / reason | Meaning and safe next step |
| --- | --- |
| `jwt_configuration` | Signing-key validation failed; inspect the existing value privately, preserve it unless a correction is approved. |
| `migration_files` | The deployed image cannot identify one migration head; inspect image packaging, not database version stamps. |
| `database_configuration` | The configured engine could not be created; review variable format privately. |
| `database_connection` | Pool checkout, DNS, TLS, connection or initial driver queries failed. Reason codes distinguish pool timeout, DNS, refused connection, TLS, authentication and invalid driver options when recognized. |
| `database_query_setup` / `database_query` | The read-only setup or real `SELECT 1` failed. SQLSTATE `57014` means statement timeout. |
| `migration_query` / `migration_table_missing` | The runtime connection cannot read `alembic_version`; verify that its database/schema matches the already migrated target. |
| `migration_version` / `migration_mismatch` | The runtime connection's revision rows do not match the packaged head. Verify the target before considering a separately approved migration; never fake a version. |
| `response_timeout` | The logged stage exceeded the HTTP deadline. A later worker log records completion/failure; a worker success after the deadline alone does not imply an HTTP 200. |
| `probe_in_progress` | A previous timed-out or concurrent probe still owns the single worker; no duplicate database query was launched. |
| `database_cleanup` | Closing/rolling back the read-only connection failed or exceeded the deadline. |
| `worker_queue` | Thread scheduling exceeded the deadline; inspect application load rather than database credentials. |

## Publication and deployment gate

Prepare only `backend/app/api/health.py`, `backend/tests/test_health.py` and this
document on top of `0196bea`. Suggested commit:
`fix: bound Render readiness probes and log safe failure stages`.
Commit/push and deployment of this new patch require explicit approval; earlier
approval covered deployment of `0196bea` only. Do not force-push.

After approval, deploy the exact patch commit to the **existing Free** Render
service using **Manual Deploy → Deploy a specific commit**. Keep `/ready`, port
configuration, current credentials and `GEMINI_MODEL=gemini-3.1-flash-lite`.
No migrations, new resources, plan changes or frontend deployment are required
for this patch. If it still fails, use the safe log stage to resolve the actual
production issue instead of bypassing readiness.

Verify Render Live, `/health` 200 and `/ready` 200, then an existing authorized
authentication flow. Readiness 200 proves `SELECT 1` and migration parity on the
runtime connection. Existing data is not modified by the patch, but production
history/authentication must still be checked after deployment. The separately
authorized single synthetic Gemini test remains reserved for a healthy backend.
