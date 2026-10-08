"use client";
import Link from "next/link";
import {
  ArrowRight,
  FileUser,
  MessagesSquare,
  Target,
  Sparkles,
  Check,
} from "lucide-react";
import { useResource } from "@/lib/use-resource";
import type { Dashboard as DashboardData } from "@/lib/workspace-types";
import { Card } from "../ui/card";
import { ButtonLink } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";
import { SessionRows } from "./interview-list";

export function Dashboard() {
  const { data, loading, error, reload } =
    useResource<DashboardData>("/dashboard");
  if (!data || loading || error)
    return <WorkspaceState loading={loading} error={error} retry={reload} />;
  const profile = data.profile;
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">EVERY STEP COUNTS</p>
          <h1>Welcome back, {profile.display_name.split(" ")[0]}.</h1>
          <p>Your preparation, with a little more direction.</p>
        </div>
        <ButtonLink href="/profile" variant="secondary">
          Refine your profile <ArrowRight size={16} aria-hidden="true" />
        </ButtonLink>
      </div>
      <div className="workspace-summary-grid">
        <Card className="workspace-stat">
          <span>Profile completion</span>
          <strong>
            {profile.completion}
            <small>%</small>
          </strong>
          <div className="metric-track">
            <span style={{ width: `${profile.completion}%` }} />
          </div>
          <p>Based on your name, role, experience, and skills.</p>
        </Card>
        <Card className="workspace-stat">
          <span>{data.latest_evaluation ? "Latest overall score" : "Interview readiness"}</span>
          <div className="stat-icon">
            <Target size={23} aria-hidden="true" />
          </div>
          <h2>
            {data.latest_evaluation ? `${data.latest_evaluation.score}/100` : profile.completion === 100
              ? "Your foundation is ready"
              : "Start with your foundation"}
          </h2>
          <p>
            {data.latest_evaluation ? `Technical ${data.latest_evaluation.technical_score}/100 · Communication ${data.latest_evaluation.communication_score}/100` : "Complete a practice interview to see feedback based on your own answers."}
          </p>
          {data.latest_evaluation && <Link className="text-link" href={`/interviews/${data.latest_evaluation.interview_id}/results`}>View your report</Link>}
        </Card>
        <Card className="workspace-stat">
          <span>Practice sessions</span>
          <strong>{data.interview_count.toString().padStart(2, "0")}</strong>
          <p>Sessions created in your account. Keep showing up.</p>
        </Card>
      </div>
      <div className="workspace-two-columns">
        <Card className="workspace-panel">
          <div className="panel-header">
            <h2>Recent interviews</h2>
            <MessagesSquare size={19} aria-hidden="true" />
          </div>
          {data.recent_interviews.length ? (
            <SessionRows sessions={data.recent_interviews} />
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                <MessagesSquare size={25} aria-hidden="true" />
              </span>
              <h3>No interviews yet.</h3>
              <p>
                Start your first practice session. Pick a role and take it one
                question at a time.
              </p>
              <ButtonLink href="/interviews/new" variant="secondary">
                Start your first session{" "}
                <ArrowRight size={15} aria-hidden="true" />
              </ButtonLink>
            </div>
          )}
        </Card>
        <Card className="workspace-panel">
          <div className="panel-header">
            <h2>Your skills, in focus</h2>
            <Sparkles size={18} aria-hidden="true" />
          </div>
          {profile.skills.length ? (
            <>
              <div className="skill-chips">
                {profile.skills.map((skill) => (
                  <span key={skill.id}>{skill.name}</span>
                ))}
              </div>
              <p className="panel-copy">
                A starting point for practice tailored to your experience.
              </p>
            </>
          ) : (
            <div className="empty-state compact-empty">
              <h3>What do you bring to the table?</h3>
              <p>
                Add your technical skills to shape a more personal practice
                experience.
              </p>
              <Link className="text-link" href="/profile">
                Add your skills <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
        </Card>
      </div>
      <Card className="next-action">
        <span className="empty-icon">
          <FileUser size={25} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">YOUR RECOMMENDED NEXT STEP</p>
          <h2>
            {data.latest_evaluation?.recommended_topics.length ? `Practice ${data.latest_evaluation.recommended_topics[0].replaceAll("-", " ")}.` : profile.completion < 100
              ? "Make your profile yours."
              : "Keep your goals up to date."}
          </h2>
          <p>
            {data.latest_evaluation ? "Revisit the lowest scoring topic from your latest session, then explain it with a concrete example." : profile.target_role
              ? `You’re working toward ${profile.target_role}. Keep your skills and experience aligned with that goal.`
              : "Choose a target role and add your skills. A clearer starting point makes better practice possible."}
          </p>
        </div>
        <ButtonLink href={data.latest_evaluation ? "/interviews/new" : "/profile"}>
          {data.latest_evaluation ? "Practice again" : profile.completion < 100 ? "Complete profile" : "Review profile"}
          <ArrowRight size={16} aria-hidden="true" />
        </ButtonLink>
      </Card>
      <div className="quick-actions">
        <span>QUICK ACTIONS</span>
        <Link href="/profile">
          <Check size={15} aria-hidden="true" />
          Update skills
        </Link>
        <Link href="/profile#account-settings">Account settings</Link>
        <Link href="/interviews/new">New interview</Link>
        <Link href="/resume">Review resume</Link>
      </div>
    </>
  );
}
