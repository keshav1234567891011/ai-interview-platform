"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { User } from "../auth/auth-provider";
import { PasswordField } from "../auth/password-field";
import { PermissionPicker } from "./permission-picker";
import { Card } from "../ui/card";
import { Button, ButtonLink } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";

export function AdminManagement({ created = false }: { created?: boolean }) {
  const [offset, setOffset] = useState(0);
  const resource = useResource<User[]>(`/owner/admins?offset=${offset}`);
  return <><div className="workspace-heading"><div><p className="eyebrow">SCOPED ACCESS, CLEAR OWNERSHIP</p><h1>Delegated administrators.</h1><p>Each admin signs in with their own account. Only you can grant or revoke their access.</p></div><ButtonLink href="/owner/admins/new">Create Admin</ButtonLink></div>{created && <p className="success-message" role="status">Admin account created.</p>}{!resource.data || resource.loading || resource.error ? <WorkspaceState loading={resource.loading} error={resource.error} retry={resource.reload} /> : <>{resource.data.length ? <div className="admin-account-list">{resource.data.map(admin => <AdminAccount key={`${admin.id}-${admin.password_change_required}-${admin.is_active}-${admin.permissions.join(",")}`} admin={admin} reload={resource.reload} />)}</div> : <Card className="workspace-panel"><h2>Careful delegation starts here.</h2><p className="panel-copy">No administrators yet. Create a dedicated account when you need help managing InterviewAI.</p></Card>}<div className="form-actions"><Button variant="secondary" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous admins</Button><Button variant="secondary" disabled={resource.data.length < 50} onClick={() => setOffset(offset + 50)}>More admins</Button></div></>}</>;
}
function AdminAccount({ admin, reload }: { admin: User; reload: () => void }) {
  const [panel, setPanel] = useState<"permissions" | "reset" | null>(null); const [selected, setSelected] = useState(admin.permissions); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  async function action(path: string, payload?: object) {
    setBusy(true); setError(""); setSuccess("");
    try { await api(`/owner/admins/${admin.id}/${path}`, { method: path === "permissions" || path === "state" ? "PUT" : "POST", ...(payload ? { body: JSON.stringify(payload) } : {}) }); setPanel(null); setSuccess(path === "reset-password" ? "Temporary password set. The admin must choose a new password at next login." : "Administrator updated."); if (path !== "reset-password") reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update this administrator."); }
    finally { setBusy(false); }
  }
  async function reset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const payload = Object.fromEntries(new FormData(form).entries());
    if (payload.password !== payload.confirm_password) { setError("Temporary password and confirmation must match."); return; }
    await action("reset-password", payload); form.reset();
  }
  return <Card className="workspace-panel"><div className="panel-header"><div><h2>{admin.display_name}</h2><p className="panel-copy">{admin.email}</p></div><span className="category-badge">{admin.is_active ? "Active" : "Inactive"}</span></div><p className="fine-note">Created {new Date(admin.created_at).toLocaleDateString()} · Last login {admin.last_login_at ? new Date(admin.last_login_at).toLocaleString() : "Not yet signed in"}</p><div className="skill-chips" aria-label="Assigned permissions">{admin.permissions.length ? admin.permissions.map(permission => <span key={permission}>{permission}</span>) : <span>No permissions assigned</span>}</div><div className="admin-actions"><Button variant="secondary" disabled={busy} onClick={() => setPanel(panel === "permissions" ? null : "permissions")}>Edit Admin Permissions</Button><Button variant="secondary" disabled={busy} onClick={() => void action("state", { is_active: !admin.is_active })}>{admin.is_active ? "Deactivate Admin" : "Activate Admin"}</Button><Button variant="secondary" disabled={busy} onClick={() => setPanel(panel === "reset" ? null : "reset")}>Reset Admin Password</Button><Button variant="secondary" disabled={busy} onClick={() => { if (window.confirm("Revoke this administrator's role and invalidate their sessions? Their candidate account will remain.")) void action("revoke"); }}>Revoke Admin</Button></div>{panel === "permissions" && <form className="admin-edit-panel" onSubmit={event => { event.preventDefault(); void action("permissions", { permissions: selected }); }}><PermissionPicker value={selected} onChange={setSelected} disabled={busy} /><Button type="submit" disabled={busy}>Save permissions</Button></form>}{panel === "reset" && <form className="admin-edit-panel" onSubmit={reset}><h3>Set a new temporary password</h3><PasswordField name="password" id={`password-${admin.id}`} label="New temporary password" disabled={busy} /><PasswordField name="confirm_password" id={`confirm-${admin.id}`} label="Confirm temporary password" disabled={busy} /><p className="fine-note">All existing sessions will be invalidated. Share the new temporary password privately.</p><Button type="submit" disabled={busy}>Set temporary password</Button></form>}{error && <p className="form-error" role="alert">{error}</p>}{success && <p role="status">{success}</p>}</Card>;
}
