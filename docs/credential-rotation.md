# Credential rotation plan - approval required

No live credentials were rotated by this preparation. Do not put replacement values in Git, chat, shell arguments, logs, screenshots or this document.

## Findings and scope

- The database password shown in the earlier screenshot must be treated as exposed. Rotate the affected Neon role before the production release. A clean source scan does not undo screenshot exposure.
- The currently configured Gemini key matched an older `backend/.env.example` blob under local Codex capture/checkpoint refs. It did **not** match any checked local branch or remote-tracking history. Treat this old example exposure as a reason to rotate the key before release. Do not describe it as a confirmed public GitHub leak.
- The current working source and checked branch histories contain no matching actual local secrets. This is a bounded pattern/exact-value scan, not a guarantee that no other secret ever existed.
- The local bootstrap temporary password appeared in IDE/chat context. It must never become a production password. Preserve the existing owner's chosen password; if the temporary password is still active, change it through the existing password-change flow with approval. Remove obsolete bootstrap variables from the production environment after confirmed setup.
- No evidence currently requires replacing the production JWT signing key or settings-encryption key. Preserve them. JWT rotation signs users out; encryption-key replacement without re-encryption makes stored credentials unreadable.

## Ordered procedure

1. Obtain explicit approval for the named credentials and identify every consumer privately: Render DATABASE_URL, MIGRATION_DATABASE_URL, local preserved Neon URLs, operator migration tooling, and any separately configured jobs. Inventory key names and presence only. Back up deployment configuration privately. Confirm the current Neon restore/backup capability; do not reset the database.
2. Prefer an overlapping database rotation if the operator's Neon permissions support it: create a replacement role/credential with the same reviewed minimum grants, validate SELECT 1 using it, and keep the old role temporarily available. This changes credentials/grants only, never user tables or interviews. Creating the replacement role requires approval. If only a password reset is available, schedule the brief Render restart/reconnect window; do not promise zero downtime on free hosting.
3. Privately update Render's pooled DATABASE_URL and direct MIGRATION_DATABASE_URL together, preserving the database name, `postgresql+psycopg` driver, encoded password and TLS parameters. Do not use the local `127.0.0.1:55432` database. Update other approved consumers. Deploy/restart only with deployment approval, then confirm `/ready`, existing login and a permitted read of interview history.
4. Revoke the exposed database credential only after all consumers work. Roll back application code with the **new** valid credential if needed; do not restore an exposed password. Protect any retained operator backups and remove obsolete credential copies through a separately approved cleanup.
5. Create a replacement Gemini Developer API key in the same **unbilled** AI Studio project. Restrict it to the intended API where supported; do not enable billing or select another model. Privately update GEMINI_API_KEY in Render and the ignored local backend environment. Preserve GEMINI_MODEL=gemini-3.1-flash-lite. Do not put this key in Vercel.
6. With approval for exactly one quota-consuming synthetic test, verify the new Gemini credential through the owner connection test. The old key can coexist briefly while the replacement is validated. Then revoke the old key. Existing local capture refs will contain only a revoked value; never publish those refs or archive/share the `.git` directory.
7. Review whether any Supabase credential was included in the exposed screenshot. Rotate it only if actually exposed or separately requested; preserve the private bucket, object paths and ownership records. Test an approved private upload using a synthetic document after rotation.
8. Record completion times and safe outcomes, not credentials. Do not rewrite shared Git history or force-push without separate approval. Normal publication must name the reviewed branch explicitly; never use `git push --mirror`.

## Strict zero-spend and dashboard-only operation

The owner has chosen dashboard confirmations rather than connecting provider apps. Read-only confirmations do not authorize a secret change, service restart, publication or deployment. Confirm the actual Render public origin, current plan, production variable names/presence and automatic-deployment settings before any push; repository defaults do not establish live settings.

Do not reset an active Neon password in isolation: Render must be coordinated with the replacement credential. Prefer a reviewed overlapping role when supported, or an explicitly approved reconnect window. Saving environment changes may restart/deploy a service; verify the dashboard's save behavior before proceeding and obtain approval for that effect. A Gemini replacement key should remain in the same unbilled project, with the old key revoked only after approved validation. Do not paste either key or connection URLs into chat.

If the provider's backup/restore point or an additional cloud branch requires payment, stop that operation. The free alternative is an approved, encrypted local `pg_dump` backup and a restore check against an isolated local PostgreSQL database, with the encryption key kept separately. A production export still requires approval because it handles private data. Do not enable a paid backup, paid runner, persistent disk, subscription, trial or billing account as part of this release.

Database tables, interview history, password hashes and stored resumes remain intact. Production rotation, deployment and live smoke tests are separate authorized actions.
