"use client";
import { useState } from "react";
import Link from "next/link";
import { useResource } from "@/lib/use-resource";
import type { HistoryItem } from "@/lib/analytics-types";
import { readable } from "@/lib/interview-types";
import { Card } from "../ui/card";
import { Button, ButtonLink } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";

export function HistoryTable({ items, canOpen = true }: { items: HistoryItem[]; canOpen?: boolean }) {
  return <div className="data-table" role="region" aria-label="Scrollable interview history" tabIndex={0}><table>
    <caption className="sr-only">Interview history and recorded scores</caption>
    <thead><tr>{["Session", "Date", "Status", "Overall", "Technical", "Communication", "Duration"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
    <tbody>{items.map(item => <tr key={item.id}>
      <td>{canOpen ? <Link className="text-link" href={`/interviews/${item.id}${item.status === "completed" ? "/results" : ""}`}>{item.role}</Link> : item.role}<small>{item.difficulty}</small></td>
      <td><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString()}</time></td>
      <td>{readable(item.status)}</td><td>{item.score ?? "—"}</td><td>{item.technical_score ?? "—"}</td><td>{item.communication_score ?? "—"}</td>
      <td>{item.duration_seconds == null ? "—" : `${Math.floor(item.duration_seconds / 60)}m ${item.duration_seconds % 60}s`}</td>
    </tr>)}</tbody>
  </table></div>;
}
export function InterviewHistory() {
  const [offset, setOffset] = useState(0);
  const resource = useResource<HistoryItem[]>(`/history?offset=${offset}`);
  if (!resource.data || resource.loading || resource.error) return <WorkspaceState loading={resource.loading} error={resource.error} retry={resource.reload} />;
  return <><div className="workspace-heading"><div><p className="eyebrow">YOUR PRACTICE, OVER TIME</p><h1>Interview history.</h1><p>Every session, with feedback you can return to.</p></div><ButtonLink href="/interviews/new">New interview</ButtonLink></div><Card className="workspace-panel">{resource.data.length ? <HistoryTable items={resource.data} /> : <div className="empty-state"><h2>No sessions on this page.</h2><p>Your saved interviews will appear here. Complete a session to see scores.</p></div>}<div className="form-actions"><Button variant="secondary" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>Newer sessions</Button><Button variant="secondary" disabled={resource.data.length < 50} onClick={() => setOffset(offset + 50)}>Older sessions</Button></div></Card></>;
}
