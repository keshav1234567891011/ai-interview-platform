# Reviewed source file manifest

This is the uncommitted release candidate in the existing repository. It includes the previously implemented Gemini/pacing work, preserved during final preparation. No private .env, local database, runtime logs, virtual environment, node_modules or hosting metadata is included.

## Gemini, interviews and diagnostics

Official SDK generation/evaluation, validated persistence, bounded adaptive context, explicit consent, paced submissions, safe failure categories, owner diagnostics, and mocked regressions.

- [backend/.env.example](../backend/.env.example)
- [backend/app/api/interviews.py](../backend/app/api/interviews.py)
- [backend/app/api/owner.py](../backend/app/api/owner.py)
- [backend/app/core/rate_limit.py](../backend/app/core/rate_limit.py)
- [backend/app/schemas/ai_settings.py](../backend/app/schemas/ai_settings.py)
- [backend/app/schemas/evaluation.py](../backend/app/schemas/evaluation.py)
- [backend/app/services/adaptive_questions.py](../backend/app/services/adaptive_questions.py)
- [backend/app/services/ai_diagnostics.py](../backend/app/services/ai_diagnostics.py)
- [backend/app/services/ai_provider.py](../backend/app/services/ai_provider.py)
- [backend/app/services/ai_settings.py](../backend/app/services/ai_settings.py)
- [backend/app/services/evaluation.py](../backend/app/services/evaluation.py)
- [backend/app/services/provider_connection.py](../backend/app/services/provider_connection.py)
- [backend/tests/conftest.py](../backend/tests/conftest.py)
- [backend/tests/test_ai_pacing.py](../backend/tests/test_ai_pacing.py)
- [backend/tests/test_ai_questions.py](../backend/tests/test_ai_questions.py)
- [backend/tests/test_ai_settings.py](../backend/tests/test_ai_settings.py)
- [backend/tests/test_evaluation.py](../backend/tests/test_evaluation.py)
- [backend/tests/test_gemini_connection.py](../backend/tests/test_gemini_connection.py)

## Report UI and browser verification

Consent and provider feedback, saved drafts/countdown, independent question/evaluation provenance, conditional disclaimers, readable topics/rubrics, and browser regression coverage.

- [frontend/app/reports.css](../frontend/app/reports.css)
- [frontend/components/owner/ai-settings.tsx](../frontend/components/owner/ai-settings.tsx)
- [frontend/components/workspace/interview-results.tsx](../frontend/components/workspace/interview-results.tsx)
- [frontend/components/workspace/interview-session.tsx](../frontend/components/workspace/interview-session.tsx)
- [frontend/components/workspace/interview-setup.tsx](../frontend/components/workspace/interview-setup.tsx)
- [frontend/lib/ai-diagnostics.ts](../frontend/lib/ai-diagnostics.ts)
- [frontend/lib/ai-settings-types.ts](../frontend/lib/ai-settings-types.ts)
- [frontend/lib/api.ts](../frontend/lib/api.ts)
- [frontend/lib/evaluation-types.ts](../frontend/lib/evaluation-types.ts)
- [frontend/live-tests/development.spec.ts](../frontend/live-tests/development.spec.ts)
- [frontend/tests/ai-settings.spec.ts](../frontend/tests/ai-settings.spec.ts)
- [frontend/tests/interviews.spec.ts](../frontend/tests/interviews.spec.ts)
- [frontend/tests/voice-results.spec.ts](../frontend/tests/voice-results.spec.ts)

## Dependencies and CI

Patched compatible frontend packages/lockfile, pinned Google SDK dependencies, mocked-provider isolation, online npm audit, source guard and dependency compatibility checks in CI.

- [.github/workflows/ci.yml](../.github/workflows/ci.yml)
- [backend/constraints.txt](../backend/constraints.txt)
- [backend/requirements.txt](../backend/requirements.txt)
- [frontend/package-lock.json](../frontend/package-lock.json)
- [frontend/package.json](../frontend/package.json)

## Deployment and privacy safeguards

Server-only model configuration, explicit deployment gates, local-production DB rejection, offline release preflight, ignored credential stores and isolated acceptance-server providers.

- [.dockerignore](../.dockerignore)
- [.gitignore](../.gitignore)
- [backend/app/core/config.py](../backend/app/core/config.py)
- [backend/app/release_check.py](../backend/app/release_check.py)
- [backend/tests/test_deployment_config.py](../backend/tests/test_deployment_config.py)
- [compose.yaml](../compose.yaml)
- [frontend/vercel.json](../frontend/vercel.json)
- [frontend/next.config.ts](../frontend/next.config.ts)
- [render.yaml](../render.yaml)
- [scripts/check_release.py](../scripts/check_release.py)
- [scripts/check_containers.py](../scripts/check_containers.py)
- [scripts/isolated_owner_server.py](../scripts/isolated_owner_server.py)

## Documentation and submission

Architecture/setup/privacy documentation, dated verification evidence, safe credential rotation, existing-service deployment/rollback, screenshot provenance and submission description.

- [README.md](../README.md)
- [docs/ai-interviewer.md](../docs/ai-interviewer.md)
- [docs/architecture.md](../docs/architecture.md)
- [docs/credential-rotation.md](../docs/credential-rotation.md)
- [docs/dashboard-confirmations.md](../docs/dashboard-confirmations.md)
- [docs/deployment.md](../docs/deployment.md)
- [docs/production-launch.md](../docs/production-launch.md)
- [docs/release-deployment.md](../docs/release-deployment.md)
- [docs/release-files.md](../docs/release-files.md)
- [docs/release-readiness.md](../docs/release-readiness.md)
- [docs/screenshots/README.md](../docs/screenshots/README.md)
- [docs/screenshots/gemini-report.png](../docs/screenshots/gemini-report.png)
- [docs/security.md](../docs/security.md)

Review with git diff and the untracked-file list before staging. The repository has 61 changed/new source and documentation files in this candidate; no commit or push was made. The ignored .local/final-publish-candidate.json freezes this reviewed set for a later approved publication.
