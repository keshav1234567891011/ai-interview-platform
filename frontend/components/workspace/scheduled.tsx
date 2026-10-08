"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { ScheduledInterview } from "@/lib/schedule-types";
import { Card } from "../ui/card";
import { Button, ButtonLink } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";

export function ScheduledInterviews() {
  const resource = useResource<ScheduledInterview[]>("/scheduled");
  if (!resource.data || resource.loading || resource.error) return <WorkspaceState loading={resource.loading} error={resource.error} retry={resource.reload} />;
  const sections = [
    { title: "Upcoming interviews", items: resource.data.filter(item => item.status === "scheduled" && new Date(item.scheduled_at) >= new Date()) },
    { title: "Past scheduled interviews", items: resource.data.filter(item => item.status === "started" || (item.status === "scheduled" && new Date(item.scheduled_at) < new Date())) },
    { title: "Cancelled interviews", items: resource.data.filter(item => item.status === "cancelled") },
  ];
  return <><div className="workspace-heading"><div><p className="eyebrow">MAKE TIME FOR PROGRESS</p><h1>Your practice calendar.</h1><p>Scheduled sessions in your local browser timezone. Refresh when a session becomes due.</p></div><div className="form-actions"><Button variant="secondary" onClick={resource.reload}>Refresh schedule</Button><ButtonLink href="/interviews/new">Schedule a session</ButtonLink></div></div>
    {sections.map(section => <section className="report-section" key={section.title}><h2>{section.title}</h2>{section.items.length ? section.items.map(item => <ScheduledCard key={item.id} item={item} onUpdate={resource.reload} />) : <Card className="workspace-panel"><div className="empty-state compact-empty"><CalendarClock size={24} aria-hidden="true" /><p>No {section.title.toLowerCase()} yet.</p></div></Card>}</section>)}
    <p className="fine-note">Showing up to 200 recent schedules. Sessions that become due remain available until started or cancelled.</p>
  </>;
}

export function ScheduledCard({ item, onUpdate }: { item: ScheduledInterview; onUpdate: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [editing, setEditing] = useState(false);
  async function action(kind: "start" | "cancel" | "reschedule", scheduled_at?: string) {
    setBusy(true); setError("");
    try {
      const result = await api<{ id: string }>(`/scheduled/${item.id}${kind === "reschedule" ? "" : `/${kind}`}`, { method: kind === "reschedule" ? "PUT" : "POST", ...(scheduled_at ? { body: JSON.stringify({ scheduled_at: new Date(scheduled_at).toISOString() }) } : {}) });
      if (kind === "start") router.push(`/interviews/${result.id}`); else { setEditing(false); onUpdate(); }
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update this schedule."); }
    finally { setBusy(false); }
  }
  const due = new Date(item.scheduled_at) <= new Date();
  return <Card className="workspace-panel schedule-card"><div><p className="eyebrow">{item.status === "scheduled" && due ? "READY TO START" : item.status}</p><h3>{item.role}</h3><p><time dateTime={item.scheduled_at}>{new Date(item.scheduled_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time> · {item.difficulty} · {item.question_count} questions</p></div>
    {item.status === "scheduled" && <div className="form-actions"><Button disabled={busy || !due} onClick={() => action("start")}>{busy ? "Updating…" : due ? "Start Interview" : "Available at scheduled time"}</Button><Button variant="secondary" disabled={busy} onClick={() => setEditing(!editing)}>Reschedule</Button><Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm("Cancel this scheduled interview?")) void action("cancel"); }}>Cancel</Button></div>}
    {item.interview_id && <ButtonLink variant="secondary" href={`/interviews/${item.interview_id}`}>Open session</ButtonLink>}
    {editing && <form className="reschedule-form" onSubmit={event => { event.preventDefault(); void action("reschedule", String(new FormData(event.currentTarget).get("time"))); }}><div className="field"><label htmlFor={`time-${item.id}`}>New local date and time</label><input id={`time-${item.id}`} name="time" type="datetime-local" required disabled={busy} /></div><Button type="submit" disabled={busy}>Save schedule</Button></form>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </Card>;
}
