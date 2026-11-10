# Dashboard confirmations before publication

The owner chose dashboard confirmations instead of connecting provider apps, then requested that local preparation finish without repeated dashboard questions. All private dashboard settings below remain **UNVERIFIED**. This is a handoff reference, not a request to repeat the checks now. Local work is complete independently of these production gates. No plan change, secret rotation, save/restart, commit, push or deployment has been authorized. Record only safe setting names and outcomes; never copy keys, passwords, full database URLs or environment exports into chat or this repository.

## Confirmed existing services

- Render backend: https://interviewai-api-d0e5.onrender.com
- Render service dashboard: https://dashboard.render.com/web/srv-dbcetavf3r2c73cqia20
- Vercel project: https://vercel.com/keshavs-projects-cd4903b9/ai-interview-platform
- Public frontend: https://ai-interview-platform-one-mu.vercel.app
- GitHub: https://github.com/keshav1234567891011/ai-interview-platform

The dashboard identifiers above came from public GitHub deployment/status records. They establish existing targets, not authenticated access or current dashboard settings.

## Required read-only checks

| Location (UNVERIFIED) | Expected release value / inspection |
| --- | --- |
| Render service > Settings > Build & Deploy | Docker runtime, repository-root context, backend/Dockerfile, correct repository/main branch, and Auto-Deploy **Off**. Report any external deployment hook/automation that could still deploy on push. |
| Render service > Settings > Health Checks | /ready |
| Render service > Instance Type | Free compute |
| Render workspace > Billing | Hobby/free workspace; no payment method, paid add-on, accrued usage charge or paid build tier. Free compute alone does not establish zero billing. |
| Render service > Environment | APP_ENV production; DATABASE_URL uses the intended production Neon database, MIGRATION_DATABASE_URL uses its direct connection, both TLS protected. Never use 127.0.0.1:55432. Confirm these privately without copying values. |
| Render service > Environment | Preserve existing JWT_SECRET and SETTINGS_ENCRYPTION_KEY. Confirm FRONTEND_ORIGINS includes the exact public Vercel HTTPS origin; STORAGE_BACKEND s3; existing private Supabase S3 variables remain present. |
| Render service > Environment | GEMINI_MODEL gemini-3.1-flash-lite; GEMINI_API_KEY present, pending replacement; AI_TIMEOUT_SECONDS at most 30. Leave optional OPENAI_API_KEY absent and confirm no encrypted OpenAI key is enabled in production owner settings for strict zero-spend operation. |
| Vercel project > Settings > General / Build and Deployment | Root directory frontend; Node.js 24; include repository source outside the root directory for config/development.json. Use the existing project and domain. |
| Vercel project > Settings > Environment Variables | Production BACKEND_API_URL is https://interviewai-api-d0e5.onrender.com. Confirm Google, database, JWT and storage secrets are absent from Vercel and NEXT_PUBLIC variables. |
| Vercel project > Settings > Git | Report the current automatic Git deployment controls, Ignored Build Step and Deploy Hooks. The local vercel.json disables automatic Git deployments, but it has not been published. Do not assume the current dashboard is gated. |
| Vercel team > Settings > Billing | Hobby, with no Pro trial/subscription or paid add-on. This is a personal/non-commercial portfolio deployment. |
| Neon Console > Organization > Billing | Free plan, current usage within allowance, and no paid resource/subscription. Identify the affected production role privately under the production project > Roles. Report rotation pending; do not reset it yet. |
| Supabase Dashboard > Organization > Billing | Free plan and no paid add-on. |
| Supabase production project > Storage > resume bucket > bucket configuration | Public bucket toggle is off; confirm current storage/egress allowance and existing server-side access settings. Do not change policies during this check. |
| Google AI Studio > API keys / Projects | The key's project is Free Tier with no linked billing account. Create/replace/delete actions require the rotation approval below; do not select Set up billing. |
| GitHub account > Settings > Billing and licensing | Account plan/subscriptions and Actions/storage spending settings. The repository is public and the workflow uses standard Linux runners; no larger paid runner or deployment job is configured. |

Provider wording can vary; report the displayed value if a control differs. A pending setting is not a passing check. If a deployment gate is on, request approval to disable that exact control before changing it or pushing.

## Credential rotation approval scope

The owner confirmed both exposed credentials are **not rotated**. The proposed coordinated change requires explicit approval for:

1. Replacing the affected Neon role credential, preserving its database, grants and all application data. Use an overlapping role only after reviewing grants, or schedule an approved reconnect window. Take an approved free backup first where appropriate; do not purchase a provider backup or cloud branch.
2. Creating a replacement Gemini key in the same unbilled project, privately updating local GEMINI_API_KEY and the existing Render environment, and retiring the exposed key. Keep the model unchanged.
3. Privately updating Render DATABASE_URL/MIGRATION_DATABASE_URL together and applying the new credentials with a restart of the **currently deployed commit only** if required. Confirm the actual save/restart behavior before acting. Preserve JWT, encryption, owner credentials and storage variables. New release code is not authorized for deployment by this rotation approval.
4. Verifying read-only /health and /ready after the coordinated change. No Gemini generation is included in this approval; the single synthetic production test needs explicit approval after deployment.

Because account connections were declined, the owner must perform provider-dashboard actions privately. Local configuration updates and validation can be executed by the agent after replacements are supplied securely. Do not paste credentials into chat or put production database credentials in the development backend/.env. Publication and release deployment remain separate approvals.
