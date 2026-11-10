# Release preparation - 2026-11-10

This report distinguishes current local verification from production verification. The latest source is uncommitted; nothing has been pushed, rotated or deployed by this preparation.

## Source and submission

- Existing branch: main. Existing remote: https://github.com/keshav1234567891011/ai-interview-platform.git.
- A read-only remote check found local HEAD matched remote main before these uncommitted release changes.
- All prior local Gemini, pacing and diagnostic changes are preserved.
- Suggested commit: `feat: release Gemini-powered adaptive InterviewAI`.
- Source guard: `python scripts/check_release.py`. It reports paths/key names only and is repeated in CI. Local databases, environments, node_modules, virtual environments, hosting metadata and runtime artifacts are excluded.
- The [source file manifest](release-files.md) includes both preserved prior Gemini work and changes made during release preparation. No file has been staged or committed.

## Changes prepared

1. Preserve the Gemini 3.1 Flash-Lite provider, official SDK, response_json_schema, Pydantic validation, explicit consent, bounded timeouts/tokens, two-turn/minute and twenty-turn/day budgets, pacing drafts and deterministic fallback.
2. Make report disclaimers depend on actual evaluation sources. Keep the educational/hiring disclaimer. Display semantic topic lists, separated score breakdowns, question/evaluation provenance and readable feedback using the existing design variables.
3. Patch Next.js and its matching ESLint configuration to 16.4.6; update React/React DOM/react-is together to 19.3.1; patch Zod within 4.x and scope a minimatch 11.0.1 override to @typescript-eslint/typescript-estree. The parser still depended on vulnerable 10.x; Node 24 meets the replacement engine requirement and lint verifies the consumed API. No application framework major upgrade or audit-fix force command was used.
4. Prepare Render's verified GEMINI_MODEL and bounded timeout; preserve hosting topology. Disable automatic Vercel Git deployment in repository configuration so publication and deployment remain distinct approvals.
5. Reject local production database targets and extend the existing offline release preflight for this Neon/Supabase/Gemini topology. No schema change is introduced; migration head is 0010.
6. Allow local/container API rewrites 75 seconds so the framework's 30-second default does not cut off two sequential, individually bounded Gemini operations. Provider limits and retry behavior remain unchanged.

## Security review

The fresh online npm audit initially reported 10 affected dependency findings: one critical Next.js finding, one high Zod finding and eight moderate findings in the minimatch/ESLint dependency chain. The patched clean install reported zero known npm vulnerabilities. This is a registry audit, not a penetration-test guarantee or a full Python CVE audit. ESLint 9 remains deprecated upstream but has no current npm audit finding; a future major-toolchain update is separate work.

Primary references: [Next.js advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [Next.js patched release](https://github.com/vercel/next.js/releases/tag/v16.4.6), [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).

A secret scan found no matching current local credential in publishable source or checked branch/remote histories. The current Gemini key matched a local Codex checkpoint/capture blob, so its earlier example exposure remains a rotation concern. The earlier database-password screenshot independently requires rotation. No history rewrite or live rotation was done. See the [ordered rotation plan](credential-rotation.md).

## Production boundaries

The existing Vercel homepage returned HTTP 200 and showed InterviewAI. Its unauthenticated `/api/auth/me` returned the expected 401 after a cold-start timeout/retry. This verifies public routing/liveness only; it does not establish production Gemini, Neon schema, account login or private Supabase policy.

Render/Vercel account connections are not confirmed. Dashboard environment key presence, the actual Render public origin, effective auto-deploy controls, backups and storage policy require account inspection. No production secret values were requested or printed. Docker Desktop was initially stopped; starting the installed engine allowed both local container builds and smoke checks to pass. Hosted CI and final production smoke checks remain pending approved publication/deployment. Existing production deployments have not received this release's dependency fixes.

## Fresh local verification

Executed with Node.js 24.21.0 and Python 3.14.3, using the repository lockfile and backend virtual environment:

| Check | Result |
| --- | --- |
| `npm ci --prefix frontend` | Passed; patched lockfile installed cleanly |
| Backend `pip install -r requirements-dev.txt` | Passed in existing .venv |
| Ruff lint / formatting | Passed; 93 files formatted correctly |
| Full pytest suite | **189 passed**, including five AI evaluations, saved adaptive context, consent, ownership, pacing, and provider errors |
| Alembic validation | Upgrade/downgrade, metadata parity and PostgreSQL offline SQL passed |
| `pip check` | No broken requirements |
| ESLint / TypeScript | Passed |
| `npm run test:dev-config` | Passed; shared 3000/8010 configuration |
| Production Next.js build | Passed with 16.4.6; security-advisory build failure no longer reproduced |
| Full mocked Playwright suite | **118 passed**, including all-AI, all-baseline and mixed report disclaimers |
| Isolated owner integration | **1 passed**: real FastAPI login, mandatory delegated-admin password change, permission revocation, encrypted settings; in-memory SQLite |
| Online npm audit | **0 known vulnerabilities** after patching; Zod 4.6.7 and scoped minimatch 11.0.1 installed |
| Source guard / diff whitespace check | Passed; no private environment files or matching credential patterns in publishable source |
| Client JavaScript artifact scan | 35 assets scanned; no configured Gemini/JWT/encryption/storage secret values found |
| Isolated local PostgreSQL | SELECT 1 passed; existing Alembic head 0010 and one owner; no schema/data changes |
| Local Gemini configuration | Key present; gemini-3.1-flash-lite loaded; **zero live Gemini calls** during this preparation |
| Container builds | Both backend Python 3.14 and frontend Node 24 images built successfully |
| Container smoke check | Liveness/home 200; missing DB readiness 503; unauthenticated API proxy 401; both processes non-root; backend pip compatibility passed |
| Proxy deadline regression | A 31-second synthetic FastAPI response passed through the frontend container in 31.04 seconds with HTTP 200; owned containers/network were removed |

The SDK emits one Python 3.14 deprecation warning about a typing alias scheduled for removal in Python 3.17. Playwright emits a harmless NO_COLOR/FORCE_COLOR warning; the non-root container pip check disables an unwritable cache. None failed verification. A full Python CVE audit, independent penetration test and deployment-hosted CI are not claimed.

The browser suite exercises mocked resume/profile/job workflows, consent, answer persistence across reload, countdown/retry, independent question/evaluation labels, detailed feedback, history, authorization, mobile layouts and accessibility. Backend tests verify actual stored evaluation JSON with isolated databases and block Google SDK construction unless explicitly mocked. The owner acceptance server also forbids live Gemini. The [reviewed report screenshot](screenshots/gemini-report.png) contains synthetic data only.

The local frontend/backend were restored after verification: `http://localhost:3000/login`, backend `/health`, and `/ready` each returned 200; the same-origin `/api/auth/me` returned the expected unauthenticated 401. Existing secrets and owner credentials were preserved. Database connectivity checks were explicitly restricted to local PostgreSQL; automated suites use isolated databases and blocked/mocked Google clients.

The container smoke script completed its ownership-checked cleanup successfully. A later independent Docker inventory check found the Desktop daemon unavailable again, so no subsequent inventory result is claimed. Restart the existing local engine before repeating container checks; the completed image builds and 31-second regression test passed while it was running.

Google currently lists Standard input/output for gemini-3.1-flash-lite in its [free tier](https://ai.google.dev/gemini-api/docs/pricing). This does not establish this project's billing state or guarantee availability. The owner must confirm an unbilled project and current quotas before release. Free-tier submitted content can be used to improve Google's products; consent and data minimization remain required.

## Release gates

- [x] Fresh local verification completed, including container builds and smoke checks.
- [ ] Credential rotations approved and completed.
- [ ] Existing Render/Vercel settings and auto-deploy gates confirmed.
- [ ] Commit/push explicitly approved; hosted GitHub Actions passed.
- [ ] Backend deployment approved; confirmed health/readiness and existing data.
- [ ] Frontend deployment approved; public login/proxy/authorization verified.
- [ ] Optional synthetic production Gemini check explicitly approved and recorded.
- [ ] Submission identifies exactly which functionality was verified locally and in production.

## Final publication recheck - 2026-11-09 23:42 UTC / 2026-11-10 IST

The complete current backend suite passed again: **189 tests**. Ruff, formatting, migration upgrade/downgrade/metadata parity/offline PostgreSQL SQL and pip compatibility passed. Frontend ESLint, TypeScript, production build and development configuration passed again; **118 Playwright tests plus one isolated owner/admin integration test passed**. The fresh online npm audit reported zero findings. Automated Google calls remained blocked/mocked, and no live Gemini request was made.

The fresh secret scan inspected 265 publishable source files and 550 historical blobs before these final documentation edits. No actual current credential matched publishable files or branch/remote history. The current Gemini key still matched a local checkpoint blob for backend/.env.example. Private environment files, virtual environments, dependencies, runtime uploads and local artifacts are ignored. The client artifact scan checked 35 JavaScript assets and found no configured secret values. No private checkpoint refs will be included in a normal named-branch push.

The owner confirmed that credential rotation is not complete and chose dashboard confirmations instead of provider account connections. [Exact dashboard locations and rotation scope](dashboard-confirmations.md) are prepared. No production secret changes or restarts are authorized. Plans, environment values, live auto-deploy gates and private bucket permissions remain pending explicit confirmation.

The owner confirmed the Render origin. Read-only checks returned: frontend homepage 200, Render /health 200, Render /ready 200 and frontend /api/auth/me 401. Render cold startup took about 39 seconds. The public backend OpenAPI document has no Gemini probe route, so the latest Gemini release is not production verified. Public GitHub deployment/status records and the last successful GitHub Actions run reference the older main commit 84e3fcba08f09020d7b1d1225fa6880f93be58bb; this is not a final release commit or proof of current frontend alias settings.

Fresh container reruns could not start because Docker Desktop did not expose its Linux engine despite startup attempts; no Docker Desktop/backend process remained available. The earlier successful container builds and 31-second proxy regression above are historical preparation evidence. The complete backend/browser checks listed in this recheck were executed fresh.

No commit, push, deployment, credential rotation, production migration, billing activation or purchase occurred. Existing production data was not modified. Publication remains gated on credential rotation, actual deployment-control confirmation, and explicit commit/push approval; release deployment and the single synthetic Gemini test require separate approval.

The final owner instruction is to finish all local work and mark private settings UNVERIFIED without repeated questions or more Docker startup attempts. The deployment checklist and publication procedure below are prepared for a later explicitly approved action. No publication or production action is implied by this handoff.

## Project submission description

InterviewAI is a full-stack technical interview practice platform using Next.js, FastAPI, PostgreSQL and Google's Gemini API. It supports consented resume/job-aware question generation, rubric-based evaluation, adaptive follow-ups, persistent feedback and private resume storage, with role-based administration and quota-aware fallback.
