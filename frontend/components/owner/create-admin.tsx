"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { User } from "../auth/auth-provider";
import { PasswordField } from "../auth/password-field";
import { PermissionPicker } from "./permission-picker";
import { Card } from "../ui/card";
import { Button, ButtonLink } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";

export function CreateAdmin({ existingUserId }: { existingUserId?: string }) {
  return existingUserId ? <PromotionLoader id={existingUserId} /> : <AdminForm />;
}
function PromotionLoader({ id }: { id: string }) {
  const resource = useResource<{ user: User }>(`/admin/users/${encodeURIComponent(id)}`);
  if (!resource.data || resource.loading || resource.error) return <WorkspaceState loading={resource.loading} error={resource.error} retry={resource.reload} />;
  if (resource.data.user.role !== "user" || !resource.data.user.is_active) return <Card className="workspace-panel"><h1>Choose an active candidate account.</h1><ButtonLink href="/admin/users">View users</ButtonLink></Card>;
  return <AdminForm existing={resource.data.user} />;
}
function AdminForm({ existing }: { existing?: User }) {
  const [permissions, setPermissions] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const element = event.currentTarget; const form = new FormData(element);
    const payload = Object.fromEntries(form.entries());
    if (payload.password !== payload.confirm_password) { setError("Temporary password and confirmation must match."); return; }
    setBusy(true); setError("");
    try { await api("/owner/admins", { method: "POST", body: JSON.stringify({ ...payload, permissions, ...(existing ? { existing_user_id: existing.id } : {}) }) }); element.reset(); router.replace("/owner/admins?created=1"); }
    catch (err) { setError(err instanceof Error ? err.message : "Admin creation failed."); }
    finally { setBusy(false); }
  }
  return <><div className="workspace-heading"><div><p className="eyebrow">DELEGATE WITH INTENT</p><h1>{existing ? "Promote this candidate." : "Create an administrator."}</h1><p>A separate account, scoped permissions, and a required first password change.</p></div><ButtonLink variant="secondary" href="/owner/admins">All admins</ButtonLink></div><form onSubmit={submit} aria-busy={busy}><div className="workspace-two-columns"><Card className="workspace-panel"><h2>Account details</h2><div className="field"><label htmlFor="display_name">Full Name</label><input id="display_name" name="display_name" defaultValue={existing?.display_name} minLength={2} maxLength={80} autoComplete="off" required disabled={busy} /></div><div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={existing?.email} readOnly={Boolean(existing)} maxLength={254} autoComplete="off" required disabled={busy} /></div><PasswordField name="password" label="Temporary Password" disabled={busy} /><PasswordField name="confirm_password" label="Confirm Temporary Password" disabled={busy} /><p className="fine-note">Use at least 10 characters, including a letter and a number. Deliver the temporary password privately. It will never be displayed after submission.</p></Card><Card className="workspace-panel"><h2>Assigned permissions</h2><p className="panel-copy">Start with the smallest useful set. Access changes take effect on the next request.</p><PermissionPicker value={permissions} onChange={setPermissions} disabled={busy} /></Card></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><span>Owner access is never delegated.</span><Button type="submit" disabled={busy}>{busy ? "Creating admin…" : existing ? "Promote to Admin" : "Create Admin"}</Button></div></form></>;
}
