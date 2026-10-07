"use client";
import Link from "next/link";
import { ArrowRight, MessagesSquare, Plus } from "lucide-react";
import type { InterviewSummary } from "@/lib/workspace-types";
import { readable } from "@/lib/interview-types";
import { useResource } from "@/lib/use-resource";
import { Card } from "../ui/card";
import { ButtonLink } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";

export function SessionRows({ sessions }: { sessions: InterviewSummary[] }) {
  return (
    <div className="session-list">
      {sessions.map((item) => (
        <Link
          href={`/interviews/${item.id}`}
          key={item.id}
          className="session-row"
        >
          <span className="session-symbol">
            <MessagesSquare size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>{item.role}</strong>
            <p>
              {item.difficulty} · {item.answered_count}/{item.question_count}{" "}
              answered · {new Date(item.created_at).toLocaleDateString()}
            </p>
          </div>
          <span className={`session-status status-${item.status}`}>
            {readable(item.status)}
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

export function InterviewList() {
  const resource = useResource<InterviewSummary[]>("/interviews");
  if (!resource.data || resource.loading || resource.error)
    return (
      <WorkspaceState
        loading={resource.loading}
        error={resource.error}
        retry={resource.reload}
      />
    );
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">ONE SESSION AT A TIME</p>
          <h1>Your practice space.</h1>
          <p>Pick up where you left off, or start with a new challenge.</p>
        </div>
        <ButtonLink href="/interviews/new">
          <Plus size={16} aria-hidden="true" /> New interview
        </ButtonLink>
      </div>
      <Card className="workspace-panel">
        <div className="panel-header">
          <h2>Interview history</h2>
          <span className="small-muted">Latest 50 sessions</span>
        </div>
        {resource.data.length ? (
          <SessionRows sessions={resource.data} />
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <MessagesSquare size={24} aria-hidden="true" />
            </span>
            <h3>No interviews yet.</h3>
            <p>
              Start your first practice session. Your progress is saved as you
              go.
            </p>
            <ButtonLink href="/interviews/new">
              Start practicing <ArrowRight size={16} aria-hidden="true" />
            </ButtonLink>
          </div>
        )}
      </Card>
    </>
  );
}
