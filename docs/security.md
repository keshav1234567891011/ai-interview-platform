# Security and privacy

This is a deployment baseline, not a claim of an independent penetration test. Automated checks use mocks for AI/audio and isolated databases. Live development PostgreSQL checks are reported separately.

## Accounts and sessions

- Argon2 hashes passwords; plaintext passwords are never stored. Normalized email has a database uniqueness constraint.
- JWT validation pins HS256, issuer, audience, expiry and required claims. Session versions must be nonnegative integers; oversized tokens are rejected. Every protected request checks current activation, version and role in the database.
- JWT cookies are HttpOnly, SameSite=Lax and Secure in `APP_ENV=production`. They are restricted to `/api`; the browser does not store them in localStorage. Logout revokes all sessions for that account. There is no refresh-token mechanism.
- Browser writes require `X-InterviewAI-Request: 1` and an explicitly allowed Origin when supplied. Credentialed CORS rejects wildcard origins. Deploy the frontend and API proxy on the same HTTPS origin.
- Registration cannot set roles. Request DTOs forbid undeclared fields; profile/admin updates assign only explicitly safe attributes. Users cannot grant themselves admin. Candidate management cannot edit privileged accounts. Only the owner delegates admins and permissions; a unique partial index protects the single active owner. Temporary-password accounts must change password before normal API access. Password changes/resets invalidate previous sessions. See [owner controls](owner-control-center.md).

## Abuse controls

Quotas are atomic and shared in PostgreSQL, including across workers/restarts:

| Scope | Limit |
| --- | --- |
| Authentication per peer IP | 40 requests/minute |
| Registration per peer IP | 10 attempts/10 minutes |
| Login per normalized email | 10 attempts/minute |
| Interview creation/start/submitted answers and schedule creation/start per user | 30/minute and 300/day |
| Audio transcription per user | 6/minute and 100/day |

Rejected requests return 429 and `Retry-After`; they do not discard answers or progress. Failed authentication/provider attempts count. Fixed windows can allow a burst around a boundary; these are safeguards rather than billing guarantees. Bucket identifiers are keyed hashes, swept after approximately two days of inactivity. `APP_ENV=test` bypasses route quotas for isolated tests; quota implementation tests explicitly exercise counters. Never deploy in test mode.

The backend container disables forwarded-IP trust by default. Behind the Next.js proxy, peers may share an IP quota. For a public deployment, enforce per-client throttling at the trusted ingress and explicitly configure a trusted proxy chain if forwarding real client IPs. Never trust arbitrary `X-Forwarded-For` or use unrestricted proxy trust. Keep the backend private. Also set connection/concurrency limits, request deadlines and body limits at ingress; app quotas begin after credential/schema validation and do not replace network DoS protection.

Before JSON/multipart parsing, bounded buffering rejects JSON bodies over 128 KiB and other request bodies over 11 MiB, including chunked requests. Set equivalent/lower ingress limits and deadlines to bound concurrent buffering.

## Uploads and storage

Resume uploads allow PDF/DOCX only, at most 5 MiB. MIME, extension and magic bytes are checked. Parsing rejects encrypted/oversized PDFs and oversized/encrypted/macro DOCX archives. Context-local PDF limits bound decompressed streams to 8 MiB before expansion and disable external image decoders; limits also bound page-tree traversal/form invocations. OCR and execution are unsupported. Parsers still process untrusted complex formats: keep dependencies patched and use resource-constrained workers for public high-volume deployments. Add malware scanning if required by your deployment policy.

Storage keys are random identifiers, never user-supplied paths. `STORAGE_DIRECTORY` must resolve inside the backend directory. Raw resume text is private and excluded from public/admin DTOs and operational logs. The local adapter persists resumes until removal/retention operations are deliberately implemented. There is no complete self-service account/data-erasure feature yet; operators must establish and document a retention/deletion policy before public launch. Back up database and stored files consistently.

## Microphone and AI privacy

Microphone permission is requested only after Start recording. Recording and elapsed time are visible. Stop/discard, page hiding and unmount stop tracks; playback URLs are revoked. Text mode is always available. Browser-native recognition support varies and may use the browser vendor's transcription service; users may instead enter text.

Optional server transcription accepts validated mono 16 kHz PCM WAV, at most 10 MiB and five minutes. Backend audio is held in memory, not permanently written, and upload resources are closed after processing. Browser recordings exist temporarily for review and are discarded/reset on leaving or recording again. Transcript/duration and evaluation persist when saved. Speaking rate is an estimate; uncertain pause metrics are omitted. Metrics describe delivery only and do not infer protected traits, mental state or truthfulness.

When AI is explicitly enabled for an interview, bounded profile/resume/job excerpts and recent answers may be sent to OpenAI. Server transcription has its own deliberate action. API keys remain server-side. Provider requests use timeouts, no retries, a pinned endpoint and validated structured output; question/evaluation response storage is disabled where supported. Application audio non-retention does not override an external provider's own retention policy. Review that provider policy before public use.

Untrusted candidate content is JSON-delimited in user messages and never promoted to system instructions. Output validation, constrained categories, ownership and duplication checks limit effects. Prompt injection cannot be guaranteed impossible; generated text has no tools, database privileges or code execution. Only concise rubric fields are stored, never hidden model reasoning. Provider failure falls back safely. Deterministic scores remain labeled baseline estimates.

## Errors, headers and operations

Validation responses omit input values. Database and unexpected failures return generic messages. Operational logging uses fixed event labels without provider exceptions, SQL parameters, credentials or candidate text. Do not enable HTTP/provider/SQL debug logs in production. Disable access logs or redact request query strings at ingress; admin searches can contain names/emails.

Frontend headers prohibit framing, sniffing, geolocation/camera access and cross-origin microphone use; the same-origin microphone remains allowed. A nonce-based Content Security Policy and HSTS should be configured/tested with the chosen TLS ingress before public launch. They are not claimed as implemented by this repository.

Secrets are environment-driven and ignored by Git/Docker. Never commit `.env`, tokens, keys, uploads, recordings or test databases. Production requires HTTPS, a random signing secret, explicit CORS origins, patched pinned/locked dependencies, backups and monitored readiness. Email verification, password reset, comprehensive audit trails and distributed object storage remain future extensions rather than completed features.
