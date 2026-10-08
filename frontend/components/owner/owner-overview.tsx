"use client";
import { useAuth } from "../auth/auth-provider";
import { Card } from "../ui/card";
import { ButtonLink } from "../ui/button";
import { useResource } from "@/lib/use-resource";
import { WorkspaceState } from "../ui/workspace-state";
type Audit = { id: string; actor_id: string | null; target_id: string | null; action: string; created_at: string };
export function OwnerOverview() {
  const { user } = useAuth();
  const events = useResource<Audit[]>("/owner/audit");
  return <><div className="workspace-heading"><div><p className="eyebrow">OWNER CONTROL CENTER</p><h1>A clear view. Careful control.</h1><p>Welcome, {user?.display_name}. Delegate access while keeping ownership protected.</p></div><ButtonLink href="/owner/admins/new">Create Admin</ButtonLink></div><div className="owner-action-grid">{[
    ["Delegated administrators", "Create separate accounts with exactly the access they need.", "/owner/admins", "Manage admins"],
    ["Candidate accounts", "Review safe profiles, practice history and account state.", "/admin/users", "View users"],
    ["Account & security", "Change your password and review AI configuration status.", "/owner/security", "Open security"],
    ["Application activity", "Review real account and interview totals.", "/admin", "View activity"],
  ].map(([title, copy, href, label]) => <Card className="workspace-panel" key={href}><h2>{title}</h2><p className="panel-copy">{copy}</p><ButtonLink variant="secondary" href={href}>{label}</ButtonLink></Card>)}</div><Card className="workspace-panel report-section"><h2>Recent audit activity</h2><p className="fine-note">Only action names, account identifiers and permission changes are retained here.</p>{!events.data || events.loading || events.error ? <WorkspaceState loading={events.loading} error={events.error} retry={events.reload} /> : events.data.length ? <div className="audit-list">{events.data.map(event => <div className="topic-row" key={event.id}><div><strong>{event.action.replaceAll("_", " ")}</strong><small>Target: {event.target_id || "Removed account"}</small></div><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></div>)}</div> : <p className="panel-copy">No administrative events yet.</p>}</Card></>;
}
export function AIConfigurationStatus() {
  const settings = useResource<{ configured: boolean; model: string; management: string }>("/owner/ai-settings");
  return <Card className="workspace-panel report-section"><h2>AI configuration</h2>{!settings.data || settings.loading || settings.error ? <WorkspaceState loading={settings.loading} error={settings.error} retry={settings.reload} /> : <><p>{settings.data.configured ? "Provider configured" : "Deterministic fallback active"} · {settings.data.model}</p><p className="fine-note">Keys remain in server environment configuration. This owner-only view never reveals a key or allows delegated admins to manage it.</p></>}</Card>;
}
