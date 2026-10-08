# Owner and delegated administration

One initial application owner delegates access to separate administrator accounts. Public registration always creates a candidate (`user`). The role hierarchy is `owner`, `admin`, `user`; request schemas reject undeclared role/security fields.

## Bootstrap

Apply reviewed migrations first. Set `OWNER_BOOTSTRAP_EMAIL` and `OWNER_BOOTSTRAP_PASSWORD` privately in ignored `backend/.env`. The local project owner email is configured by the operator; passwords are never supplied through CLI arguments, checked into source, displayed or logged. Use a temporary password of 10–128 characters including a letter and a number. From `backend/`, run:

```powershell
.venv/Scripts/python.exe -m app.cli bootstrap-owner
```

This command creates or explicitly promotes only the configured active account, hashes its temporary password with Argon2, revokes earlier sessions and requires a first password change. A partial unique database index permits at most one owner; a check constraint prevents deactivating that owner. A different existing owner causes bootstrap to fail, rather than perform an ownership transfer. Repeating bootstrap for the same owner preserves their password and password-change state, even after they choose their own password. It never automatically resets them. A concurrent first bootstrap can fail safely on the uniqueness constraint; repeat the command to confirm the existing owner.

Remove `OWNER_BOOTSTRAP_PASSWORD` from the environment after completing setup. Bootstrap is an explicit trusted operator action, not a public API. The old `grant-admin` CLI is removed: only the authenticated owner delegates administrators.

## Password lifecycle

Login uses the same HttpOnly JWT cookie for every role. The login response directs candidates to `/dashboard`, admins to `/admin`, and the owner to `/owner`. A temporary-password account instead opens `/change-password`. Until it changes its password, the API permits only authentication status, password change and logout; candidate and privileged APIs refuse access. Frontend guards also prevent rendering normal workspace content.

Password change requires the current password, a different validated new password and matching confirmation. A row lock serializes changes; token version increment invalidates all old sessions and a new cookie keeps only the requesting browser signed in. The temporary password immediately stops authenticating. Owner → Account & security supports subsequent changes. Existing passwords/hashes are never returned. Public email-based password recovery is not implemented.

## Delegation and permissions

`/owner/admins` lists administrator account state, creation/last-login dates and permissions. `/owner/admins/new` creates a separate admin with a temporary password and forced first password change. Existing active candidates can be promoted explicitly from their user-detail page; email collisions never trigger implicit promotion. The UI clears password fields and shows only “Admin account created.” Share temporary credentials privately outside the app.

| Permission | Backend access |
| --- | --- |
| `users.view` | Safe account list, profile and user detail; owner account excluded for admins |
| `users.manage` | Candidate display name, activation and explicitly validated profile/skill updates |
| `support.manage` | Candidate display-name edits only; cannot activate or edit profile |
| `interviews.view` | Interview scores/history and schedules within user detail (also requires `users.view`) |
| `resumes.view` | Resume metadata within user detail (also requires `users.view`) |
| `analytics.view` | Aggregate application activity totals |

Permissions are normalized database rows, read on each request. Revocation affects the next request without waiting for JWT expiry. Owner access implicitly includes all permissions. Existing admins retain their role during migration but receive no permissions automatically; the owner must review and assign them.

Only the owner can create/promote admins, change their permissions, activate/deactivate them, reset a temporary password or revoke the admin role. Deactivation, reset and revocation invalidate sessions. Revoking preserves the candidate account and existing interview/profile data; an outstanding forced-password-change requirement remains in force. Administrator resets force a fresh password change.

Even a fully delegated admin cannot modify a privileged account, create an owner/admin, assign roles, change another user's password, or access owner settings. Owner self-deactivation, demotion and deletion are unavailable through ordinary APIs. Ownership transfer is intentionally absent.

## AI settings and audit

`GET /api/owner/ai-settings` is owner-only and returns only configured/not-configured, model name and environment-management status. Keys and encryption settings remain server environment configuration; the application does **not** provide a web key editor or return any secret/key fragment. No-key deterministic functionality remains available. Neither owner nor admin account APIs expose password hashes, cookies, tokens, raw SQL, resume content or shell/filesystem access.

Audit events are stored in the same transaction as successful changes: bootstrap, creation/promotion, permissions, reset, enable/disable, revoke, password changes and safe candidate updates. They retain action names, account identifiers, timestamps and permission identifiers only. Request bodies, passwords and secrets are never copied into audit metadata. Owner-only `/api/owner/audit` is paginated. Deleted-account identifiers become null through foreign keys; production audit retention/export remains an operator policy.

Shared PostgreSQL limits cover password changes and owner-management operations. Owner/admin mutations use row locks; the database owner constraint is the final bootstrap concurrency safeguard. Tests use generated synthetic credentials and isolated SQLite, mocked UI and PostgreSQL migration checks. The real owner's first password change is deliberately left to the owner.
