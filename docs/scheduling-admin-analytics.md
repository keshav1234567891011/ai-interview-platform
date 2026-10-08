# Scheduling, analytics and administration

Scheduling stores timezone-aware UTC timestamps. Browser date/time entry is local and is converted to UTC before submission. The API rejects naive/past timestamps and checks availability again when starting. Rescheduling/cancellation/start operate only on the owner’s pending schedule. A row lock and one transaction associate a due schedule with one interview; no notification or external calendar permission is requested. Due pending schedules remain available until started or cancelled. Lists show up to 200 recent schedules; history and admin lists paginate in groups of 50.

Analytics use persisted evaluations from completed interviews. Interview averages are weighted equally; category averages use evaluated answers. Completed sessions without feedback do not become synthetic zero scores. Opening older completed results generates a labeled deterministic baseline. Charts show the latest 50 evaluated sessions; overall averages include all evaluated sessions. Comparisons require at least three sessions or repeated topic observations and describe changes without claiming causation.

The stylized procedural avatar is an optional interface enhancement, not a person. Three.js loads only after Enable 3D interviewer. Reduced motion and limited-resource devices use the static illustration; unavailable/lost WebGL also falls back. Browser speech synthesis begins only after Read question aloud and can be muted or replayed. Recording cancels question speech. Question text and answer controls work independently of all enhancements.

Public registrations always create the `user` role. Authentication reads current role and delegated permissions from the database; clients cannot assign them through registration, profile or safe-field updates. The owner controls administrator creation, promotion and granular permissions through the owner-only control center. Administrators see only explicitly permitted safe account/profile, resume metadata and interview history, never passwords, tokens, raw resume text, storage keys or candidate answer reports. Privileged accounts cannot be edited through candidate management.

The former `grant-admin` CLI is replaced by idempotent `bootstrap-owner`, temporary-password first-login enforcement, and owner-only delegation. See [owner bootstrap and permission reference](owner-control-center.md).

Automated tests isolate persistence, mock browser/provider capabilities and require no real microphone or paid AI calls.
