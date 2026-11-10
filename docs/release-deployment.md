# Existing-service deployment and rollback

Prepared for the current InterviewAI repository and existing services. Nothing in this runbook authorizes a commit, push, secret change, production migration, paid resource or deployment.

## Architecture and confirmed boundaries

Vercel Next.js -> same-origin `/api/*` rewrite -> existing Render `interviewai-api` FastAPI Docker service -> Neon PostgreSQL and private Supabase S3-compatible resume storage.

- Repository: https://github.com/keshav1234567891011/ai-interview-platform
- Existing public frontend: https://ai-interview-platform-one-mu.vercel.app
- Local PostgreSQL: 127.0.0.1:55432, development only.
- Confirmed Render origin: https://interviewai-api-d0e5.onrender.com. Health/readiness URLs are https://interviewai-api-d0e5.onrender.com/health and https://interviewai-api-d0e5.onrender.com/ready. Dashboard environment settings and effective deployment gates still require the [specific dashboard confirmations](dashboard-confirmations.md).
- Repository preflight rejects local production database URLs. `python -m app.release_check` validates deployment variables offline without reading a workstation `.env`; it does not prove live access, private-bucket policy, backups or free-tier billing state.

## Environment review

Configure secrets privately in the existing Render service only. Preserve existing valid values unless rotation is approved.

| Render variable | Release requirement |
| --- | --- |
| APP_ENV | production |
| DATABASE_URL | Existing production Neon pooled URL, `postgresql+psycopg`, TLS required; never localhost or port 55432's development database |
| MIGRATION_DATABASE_URL | Existing production Neon direct/unpooled URL with TLS; used only for approved operator migrations |
| JWT_SECRET | Preserve the existing secure signing secret; do not copy the local secret |
| SETTINGS_ENCRYPTION_KEY | Preserve the exact existing valid Fernet key and private backup |
| FRONTEND_ORIGINS | JSON array containing `https://ai-interview-platform-one-mu.vercel.app` and any explicitly approved custom HTTPS origin |
| GEMINI_API_KEY | New/rotated key from an unbilled Gemini Developer API project, backend only |
| GEMINI_MODEL | gemini-3.1-flash-lite |
| AI_TIMEOUT_SECONDS | 30 |
| STORAGE_BACKEND | s3 |
| S3_BUCKET, S3_REGION | Preserve the existing private Supabase bucket and region |
| S3_ENDPOINT_URL | Existing HTTPS Supabase S3 endpoint ending `/storage/v1/s3` |
| S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY | Preserve existing valid least-privilege storage credentials unless rotation is approved |
| S3_SESSION_TOKEN | Preserve only if the existing storage credential requires it |
| DATABASE_POOL_SIZE, DATABASE_MAX_OVERFLOW | Preserve/review existing bounded pool settings against the current Neon allowance; allow capacity for `/ready` during AI work |
| OPENAI_API_KEY | Optional legacy server transcription only; absent is supported. Never required to complete interviews |

The existing Vercel project needs **server-only build-time** BACKEND_API_URL set to the confirmed Render HTTPS origin. No JWT, Google, database or storage secret belongs in Vercel or NEXT_PUBLIC variables. The existing Next configuration rejects missing/insecure/local Vercel destinations. Retain root directory `frontend` and include repository source outside the root directory so `config/development.json` is available. Preserve the public domain.

Local/container Next rewrites allow 75 seconds for a submitted answer: evaluation and a follow-up can each consume the backend's 30-second limit. This does not increase SDK timeouts, retries or quotas. Vercel separately documents a [120-second external-origin timeout](https://vercel.com/docs/errors/router_external_target_error); free Render cold starts may still exceed the available window, so retain saved-draft/reload recovery.

## Publication and deployment order

1. Complete the current release report and credential-rotation approvals. Review the exact source file list and proposed commit. Recheck `git status`, the current remote main SHA and the secret guard. This release is prepared on existing main without discarding local changes.
2. Confirm automatic deployment gates in the actual dashboards **before any push**. `render.yaml` prepares `autoDeployTrigger: off`; `frontend/vercel.json` sets `git.deploymentEnabled: false` for automatic Git deployments. Existing dashboard configuration and other deployment hooks must still be checked. GitHub Actions validates but does not deploy. Do not assume a main-branch push is harmless before this check.
3. With separate approval, commit and push only the reviewed source. Suggested message: `feat: release Gemini-powered adaptive InterviewAI`. Use a normal named-branch push, never mirror or force. Wait for the hosted GitHub Actions checks; a local pass is not hosted CI evidence.
4. Record the current Render commit/image, Vercel deployment ID, environment configuration version and database schema revision for rollback. Keep actual secrets out of the record. Do not create replacement hosting projects or paid services.

   Public metadata observed before publication: main commit 84e3fcba08f09020d7b1d1225fa6880f93be58bb; [Render deployment dep-dbp33r0n74is73cmd8k0](https://dashboard.render.com/web/srv-dbcetavf3r2c73cqia20/deploys/dep-dbp33r0n74is73cmd8k0); [Vercel deployment record](https://vercel.com/keshavs-projects-cd4903b9/ai-interview-platform/4yjcobKBoGw2StCkmiXrjLG6SM8Y). Recheck the current IDs at approval time; these are baseline records, not the new release.
5. In existing Render `interviewai-api`, verify Docker runtime, repository-root context, `backend/Dockerfile`, existing free plan, `/ready` health check and automatic deployment disabled. Keep the Docker start command (`python -m app.serve`), which binds 0.0.0.0 and honors PORT. Do not add startup migrations or owner bootstrap.
6. Inspect the deployed Alembic revision through an approved production read. This release adds **no database migration**; head remains `0010`. If production is already at head, run no migration. If it is behind, stop for a reviewed backup/direct-connection upgrade plan and explicit migration approval. Never downgrade, drop or recreate production tables to deploy this release.
7. After approved secret updates/rotations, manually deploy the reviewed backend commit through the existing service. Run `python -m app.release_check` offline in a private operator process using the reviewed production variables; it ignores the workstation's development `.env` and makes no network requests. Do not copy production credentials into `backend/.env`. Render Free has no dashboard/SSH shell or one-off job capability, so do not upgrade or add a paid runner to execute this check. Check the confirmed Render origin's `/health` and `/ready`. Preserve HTTPS, existing owner credentials, JWT session rules and encryption. Test existing authenticated reads and private storage using authorized synthetic data only; never create artificial production interview history automatically.
8. Build and deploy the frontend to the existing Vercel project only after backend readiness. With Vercel account/CLI authorization, from `frontend`, link to the **existing** project, pull its production environment privately, build, and deploy the prebuilt output:

```powershell
# Execute only after explicit Vercel deployment approval.
Push-Location frontend
npx vercel link
npx vercel pull --yes --environment=production
npx vercel build --prod
npx vercel deploy --prebuilt --prod
Pop-Location
```

The ignored `.vercel` directory may contain pulled secrets. Do not create a new project when linking. A connected Vercel deployment tool may be used instead with the same explicit project/commit approval. Manual/CLI deployment is distinct from disabled automatic Git deployment. See [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).

9. Verify the existing public domain, same-origin `/api/auth/me` behavior, Secure/HttpOnly cookies over HTTPS, existing owner/user login, authorization, resume ownership and report/history persistence. A 401 for an unauthenticated `/api/auth/me` is expected, not proof of database or Gemini readiness. Google key/model never enter browser responses.
10. If explicitly authorized, run one synthetic owner Gemini test and record safe model/status only. A manual consented interview may consume up to 2N model calls for N questions, subject to two turns/minute and twenty/day. Respect countdowns and quota; never enable billing to bypass limits. Have the owner perform any real-candidate acceptance test knowingly.

## Prepared GitHub procedure - not executed

The private `.local/final-publish-candidate.json` records the reviewed changed/new file paths, their SHA-256 hashes, the baseline main commit and a candidate fingerprint. It contains no credentials and is ignored. It must be regenerated and reviewed if any source file changes. The existing repository remains on main with no staged files.

After explicit commit/push approval **and** resolution of the security and live deployment-control gates, the agent can execute this PowerShell procedure from the existing repository. The owner is not being asked to run it now. Stop on authentication failure, a changed baseline or unexpected staged files; never force-push.

```powershell
$releaseRoot = 'C:\Users\Asus\Downloads\accenture\ai-interview-platform'
Push-Location -LiteralPath $releaseRoot
try {
    $releasePlan = Get-Content -LiteralPath '.local/final-publish-candidate.json' -Raw | ConvertFrom-Json
    if ((git branch --show-current).Trim() -ne 'main') { throw 'Review the current branch first.' }
    if ((git rev-parse HEAD).Trim() -ne $releasePlan.base_head) { throw 'The baseline changed; review again.' }
    $releaseRemote = git ls-remote origin refs/heads/main
    if ($LASTEXITCODE -ne 0 -or ($releaseRemote -split '\s+')[0] -ne $releasePlan.base_head) { throw 'Remote main changed or is inaccessible; review before proceeding.' }
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Existing staged work requires review.' }
    foreach ($releaseEntry in $releasePlan.files) {
        $releaseActual = (Get-FileHash -LiteralPath $releaseEntry.path -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($releaseActual -ne $releaseEntry.sha256) { throw 'The candidate changed; review again.' }
    }
    & '.\backend\.venv\Scripts\python.exe' scripts/check_release.py
    if ($LASTEXITCODE -ne 0) { throw 'Source guard failed.' }
    $releasePaths = @($releasePlan.files | ForEach-Object { $_.path })
    git add -- @releasePaths
    if ($LASTEXITCODE -ne 0) { throw 'Staging failed.' }
    $releaseStaged = @(git diff --cached --name-only)
    if (Compare-Object -ReferenceObject $releasePaths -DifferenceObject $releaseStaged) { throw 'Staged paths differ from the reviewed candidate.' }
    git diff --cached --check
    if ($LASTEXITCODE -ne 0) { throw 'Staged whitespace check failed.' }
    git diff --cached --stat
    git commit -m 'feat: release Gemini-powered adaptive InterviewAI'
    if ($LASTEXITCODE -ne 0) { throw 'Commit failed.' }
    git push origin HEAD:refs/heads/main
    if ($LASTEXITCODE -ne 0) { throw 'Push failed; do not force-push.' }
    $releaseCommit = (git rev-parse HEAD).Trim()
    $releasePublished = git ls-remote origin refs/heads/main
    if ($LASTEXITCODE -ne 0 -or ($releasePublished -split '\s+')[0] -ne $releaseCommit) { throw 'Remote verification is pending.' }
} finally {
    Pop-Location
}
```

Inspect the hosted [GitHub Actions run](https://github.com/keshav1234567891011/ai-interview-platform/actions/workflows/ci.yml) for the new commit. Existing green runs for baseline commits are not release CI results. Publishing source does not authorize a Render/Vercel deployment.

## Consolidated existing-service deployment checklist

| Gate | Current evidence / required state |
| --- | --- |
| Credential replacement | **BLOCKED**: exposed Neon credential and checkpoint Gemini key are not rotated. Approval and coordinated provider actions are required. Preserve JWT/encryption keys and data. |
| Account cost controls | **UNVERIFIED**: actual Vercel Hobby, Render Hobby workspace/Free compute/no payment method, Neon Free, Supabase Free, Gemini unbilled Free Tier, GitHub account subscriptions/storage budgets. Repository code does not prove account billing. |
| Automatic deployments | **UNVERIFIED live controls**. Repository Render auto-deploy is off and Vercel Git deployment is disabled. Effective dashboard settings/hooks must be resolved before push. See the linked dashboard locations; do not change them without approval. |
| GitHub release | **PENDING approval**: commit the reviewed candidate, normal push to existing main, verify the exact remote SHA and new hosted CI. |
| Render target/startup | Confirmed existing service/origin above. Repository uses root Docker context, backend/Dockerfile, python -m app.serve, PORT binding and /ready. **Live dashboard values UNVERIFIED**. |
| Render environment | **UNVERIFIED**: APP_ENV production; intended production Neon pooled/direct TLS URLs; stable JWT/encryption keys; exact HTTPS frontend origin; private Supabase S3 configuration; rotated backend-only GEMINI_API_KEY and GEMINI_MODEL gemini-3.1-flash-lite. Local database addresses and development secrets must not enter production. |
| Database upgrade | No new migration in this release; head 0010. Current public /ready returns 200. Confirm the intended production target; if an upgrade is needed, require an approved free backup/restore-tested plan and separate migration approval. |
| Backend deployment | **NOT authorized**. After approval, deploy the verified commit to the existing free service, check logs and /health and /ready, and verify existing authorized account/history/storage reads. Do not add migrations to startup. |
| Vercel environment/build | **UNVERIFIED**: existing project, frontend root, Node 24 and production BACKEND_API_URL https://interviewai-api-d0e5.onrender.com. Include shared repository config. Keep all Google/database/JWT/storage secrets out of Vercel and NEXT_PUBLIC variables. |
| Frontend deployment | **NOT authorized**. After backend readiness and separate approval, build/deploy the verified commit to the existing project/domain. Check public authentication, proxy behavior, resume ownership and historical reports. |
| Gemini production smoke | **NOT authorized/not verified**. Allow at most one separately approved synthetic connection test after deployment; use synthetic fixtures/mocks for the rest. Actual public API currently lacks the Gemini probe route. |
| Rollback/submission | Preserve data and valid rotated credentials. Restore recorded existing deployments if needed, then repeat health/auth checks. Publish final commit/deployment/test results only after verification; no uptime or zero-billing guarantee is inferred from free-plan configuration. |

## Repeating the isolated container checks

The cross-platform smoke script preserves the original CI health/readiness and non-root checks and adds real container-to-container proxying plus a 31-second synthetic response. It creates uniquely labeled local containers/network, sends no external AI requests, and removes only resources whose ownership label matches. The delayed route exists only in the disposable test process.

```powershell
docker build -f backend/Dockerfile -t interviewai-backend:ci .
docker build -f frontend/Dockerfile -t interviewai-frontend:ci .
backend/.venv/Scripts/python.exe scripts/check_containers.py
```

Run from the repository root with Docker Desktop running. Do not inject production environment files or credentials. GitHub Actions runs the same script after building these tags.

## Rollback

Stop the rollout if `/ready`, proxy login, private storage or authorization fails. Restore the previous verified Render code/image and previous Vercel deployment, using the recorded identifiers in the existing services. Keep the same schema and all user data. This release requires no downgrade. Keep replacement **valid** credentials after a security rotation; do not roll back to exposed keys. Never change the stable encryption key to fix a decrypt error. Confirm `/ready`, login and historical report reads again. Free hosting cold starts can delay recovery, so do not promise zero downtime.

## Approval boundaries

Commit/push, live credential rotation, any production migration, Render deployment, Vercel deployment and quota-consuming production smoke tests require explicit scope approval. The published demo may remain on older code until those actions are completed and independently verified.
