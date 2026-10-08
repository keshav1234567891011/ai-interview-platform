"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth, type User } from "../auth/auth-provider";
import { useResource } from "@/lib/use-resource";
import { can } from "@/lib/auth-destination";
import { ProfileEditor } from "./profile";
import type { Skill } from "@/lib/workspace-types";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/workspace-types";
import type { HistoryItem } from "@/lib/analytics-types";
import type { ScheduledInterview } from "@/lib/schedule-types";
import { HistoryTable } from "./history";
import { Card } from "../ui/card";
import { Button, ButtonLink } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, refresh } = useAuth();
  if (loading) return <WorkspaceState loading error="" retry={refresh} />;
  if (!user || !["admin", "owner"].includes(user.role) || user.password_change_required) return <Card className="workspace-panel"><h1>Administrator access required.</h1><p>This workspace is available only to application administrators.</p><ButtonLink href="/dashboard" variant="secondary">Return to your dashboard</ButtonLink></Card>;
  return children;
}
type Counts = { total_users: number; active_users: number; total_interviews: number; completed_interviews: number; resume_count: number; scheduled_interviews: number };
export function AdminOverview() {
  const { user } = useAuth();
  return <><div className="workspace-heading"><div><p className="eyebrow">APPLICATION OPERATIONS</p><h1>Admin overview.</h1><p>Your delegated access is checked on every request.</p></div>{can(user, "users.view") && <ButtonLink href="/admin/users">Manage users</ButtonLink>}</div>{can(user, "analytics.view") ? <AdminCounts /> : <Card className="workspace-panel"><h2>Scoped access</h2><p className="panel-copy">Application analytics have not been assigned to this account.</p></Card>}<Card className="workspace-panel report-section"><h2>Your permissions</h2><div className="skill-chips">{user?.permissions?.length ? user.permissions.map(item => <span key={item}>{item}</span>) : <span>No permissions assigned</span>}</div></Card></>;
}
function AdminCounts() {
  const resource = useResource<Counts>("/admin");
  if (!resource.data || resource.loading || resource.error) return <WorkspaceState loading={resource.loading} error={resource.error} retry={resource.reload} />;
  return <><div className="report-metrics">{Object.entries(resource.data).map(([label, value]) => <Card className="workspace-stat" key={label}><span>{label.replaceAll("_", " ")}</span><strong>{value}</strong></Card>)}</div></>;
}
function PermissionBoundary({children}: {children: React.ReactNode}) {
  const { user } = useAuth();
  return can(user, "users.view") ? children : <Card className="workspace-panel"><h1>User viewing permission required.</h1><p>Ask the owner to review your assigned permissions.</p></Card>;
}
export function AdminUsers() { return <PermissionBoundary><AdminUsersContent /></PermissionBoundary>; }
function AdminUsersContent() {
  const [search, setSearch] = useState(""); const [offset, setOffset] = useState(0);
  const resource = useResource<User[]>(`/admin/users?search=${encodeURIComponent(search)}&offset=${offset}`);
  return <><div className="workspace-heading"><div><p className="eyebrow">SAFE ACCOUNT MANAGEMENT</p><h1>Users.</h1><p>Search accounts and review profile and practice history.</p></div></div><form className="admin-search" onSubmit={event => { event.preventDefault(); setOffset(0); setSearch(String(new FormData(event.currentTarget).get("search"))); }}><div className="field"><label htmlFor="user-search">Search by name or email</label><input id="user-search" name="search" maxLength={100} type="search" /></div><Button type="submit">Search users</Button></form>
    {!resource.data || resource.loading || resource.error ? <WorkspaceState loading={resource.loading} error={resource.error} retry={resource.reload} /> : <Card className="workspace-panel">{resource.data.length ? <div className="data-table"><table><caption className="sr-only">Safe user account details</caption><thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">State</th></tr></thead><tbody>{resource.data.map(user => <tr key={user.id}><td><Link className="text-link" href={`/admin/users/${user.id}`}>{user.display_name}</Link></td><td>{user.email}</td><td>{user.role}</td><td>{user.is_active ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div> : <p className="panel-copy">No matching accounts.</p>}<div className="form-actions"><Button variant="secondary" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous users</Button><Button variant="secondary" disabled={resource.data.length < 50} onClick={() => setOffset(offset + 50)}>More users</Button></div></Card>}
  </>;
}
type UserDetail = { user: User; profile: Profile; interviews: HistoryItem[]; resumes: { id: string; filename: string; file_size: number; created_at: string }[]; scheduled: ScheduledInterview[] };
export function AdminUserDetail({ id }: { id: string }) { return <PermissionBoundary><AdminUserDetailContent id={id} /></PermissionBoundary>; }
function AdminUserDetailContent({ id }: { id: string }) {
  const resource = useResource<UserDetail>(`/admin/users/${id}`);
  const [savedId, setSavedId] = useState<string | null>(null);
  if (!resource.data || resource.loading || resource.error) return <WorkspaceState loading={resource.loading} error={resource.error} retry={resource.reload} />;
  return <>{savedId === id && <p role="status">Account updated.</p>}<UserDetailPanel key={`${resource.data.user.id}-${resource.data.user.display_name}-${resource.data.user.is_active}`} data={resource.data} onUpdate={() => { setSavedId(id); resource.reload(); }} /></>;
}
function UserDetailPanel({ data, onUpdate }: { data: UserDetail; onUpdate: () => void }) {
  const { user } = useAuth();
  const manage = data.user.role === "user" && can(user, "users.manage");
  const support = data.user.role === "user" && (manage || can(user, "support.manage"));
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError("");
    try { await api(`/admin/users/${data.user.id}`, { method: "PUT", body: JSON.stringify({ display_name: form.get("display_name"), ...(manage ? { is_active: form.get("active") === "on" } : {}) }) }); onUpdate(); }
    catch (err) { setError(err instanceof Error ? err.message : "Account update failed."); }
    finally { setBusy(false); }
  }
  return <><div className="workspace-heading"><div><p className="eyebrow">USER DETAIL</p><h1>{data.user.display_name}</h1><p>{data.user.email} · {data.user.role} · {data.user.is_active ? "Active" : "Inactive"}</p></div><ButtonLink variant="secondary" href="/admin/users">All users</ButtonLink></div><div className="workspace-two-columns"><Card className="workspace-panel"><h2>Safe account controls</h2><form onSubmit={save} aria-busy={busy}><div className="field"><label htmlFor="admin-name">Display name</label><input id="admin-name" name="display_name" defaultValue={data.user.display_name} minLength={2} maxLength={80} required disabled={busy || !support} /></div><label className="avatar-choice"><input name="active" type="checkbox" defaultChecked={data.user.is_active} disabled={busy || !manage} />Account active</label><p className="fine-note">Deactivation invalidates existing sessions. Only explicitly permitted candidate fields can be changed. Privileged accounts are protected.</p>{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" disabled={busy || !support}>{busy ? "Saving…" : "Save safe fields"}</Button></form></Card><Card className="workspace-panel"><h2>Candidate profile</h2>{user?.role === "owner" && data.user.role === "user" && data.user.is_active && <ButtonLink variant="secondary" href={`/owner/admins/new?user=${data.user.id}`}>Promote to Admin</ButtonLink>}<p>{data.profile.target_role || "No target role"} · {data.profile.experience_level || "Experience not specified"}</p><p className="panel-copy">{data.profile.summary || "No professional summary."}</p><div className="skill-chips">{data.profile.skills.map(skill => <span key={skill.id}>{skill.name}</span>)}</div></Card></div><Card className="workspace-panel report-section"><h2>Interview history</h2>{!can(user, "interviews.view") && <p className="fine-note">Interview visibility has not been assigned.</p>}{data.interviews.length ? <HistoryTable items={data.interviews} canOpen={false} /> : <p className="panel-copy">No interviews yet.</p>}<p className="fine-note">Scores are available here. Individual answer reports remain private to the candidate.</p></Card><div className="workspace-two-columns"><Card className="workspace-panel"><h2>Resume metadata</h2>{!can(user, "resumes.view") && <p className="fine-note">Resume visibility has not been assigned.</p>}{data.resumes.length ? data.resumes.map(resume => <div className="topic-row" key={resume.id}><span>{resume.filename}</span><span>{Math.ceil(resume.file_size / 1024)} KB</span></div>) : <p className="panel-copy">No uploaded resumes.</p>}<p className="fine-note">Raw resume contents and downloads are not exposed to administrators.</p></Card><Card className="workspace-panel"><h2>Scheduled interviews</h2>{data.scheduled.length ? data.scheduled.map(item => <div className="topic-row" key={item.id}><div>{item.role}<small>{new Date(item.scheduled_at).toLocaleString()}</small></div><span>{item.status}</span></div>) : <p className="panel-copy">No scheduled interviews.</p>}</Card></div>{manage && <ManagedProfile id={data.user.id} initial={data.profile} />}</>;
}

function ManagedProfile({id, initial}: {id: string; initial: Profile}) {
  const [open, setOpen] = useState(false);
  return <div className="report-section"><Button variant="secondary" onClick={() => setOpen(!open)}>{open ? "Close profile editor" : "Edit candidate profile"}</Button>{open && <ManagedProfileForm id={id} initial={initial} />}</div>;
}
function ManagedProfileForm({id, initial}: {id: string; initial: Profile}) {
  const skills = useResource<Skill[]>("/skills");
  if (!skills.data || skills.loading || skills.error) return <WorkspaceState loading={skills.loading} error={skills.error} retry={skills.reload} />;
  return <ProfileEditor initial={initial} skills={skills.data} endpoint={`/admin/users/${id}/profile`} managed />;
}
