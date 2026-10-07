"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LoaderCircle, Target } from "lucide-react";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { Profile, Skill } from "@/lib/workspace-types";
import { roles, difficulties, type Interview } from "@/lib/interview-types";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";

export function InterviewSetup() {
  const profile = useResource<Profile>("/profile");
  const skills = useResource<Skill[]>("/skills");
  if (
    !profile.data ||
    !skills.data ||
    profile.loading ||
    skills.loading ||
    profile.error ||
    skills.error
  )
    return (
      <WorkspaceState
        loading={profile.loading || skills.loading}
        error={profile.error || skills.error}
        retry={() => {
          profile.reload();
          skills.reload();
        }}
      />
    );
  return <SetupForm profile={profile.data} skills={skills.data} />;
}

function SetupForm({ profile, skills }: { profile: Profile; skills: Skill[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const session = await api<Interview>("/interviews", {
        method: "POST",
        body: JSON.stringify({
          role: fields.get("role"),
          difficulty: fields.get("difficulty"),
          question_count: Number(fields.get("question_count")),
          focus_areas: selected,
        }),
      });
      router.push(`/interviews/${session.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create this interview.",
      );
      setBusy(false);
    }
  }
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">PRACTICE WITH INTENTION</p>
          <h1>Build your next interview.</h1>
          <p>A focused session, shaped around the role you want.</p>
        </div>
      </div>
      <div className="interview-setup-grid">
        <form onSubmit={submit} aria-busy={busy}>
          <Card className="workspace-panel">
            <div className="panel-header">
              <h2>Your session</h2>
              <Target size={19} aria-hidden="true" />
            </div>
            <div className="field">
              <label htmlFor="interview-role">Target role</label>
              <select
                id="interview-role"
                name="role"
                defaultValue={
                  roles.includes(profile.target_role)
                    ? profile.target_role
                    : "Backend Developer"
                }
                disabled={busy}
              >
                {roles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="difficulty">Difficulty</label>
                <select
                  name="difficulty"
                  id="difficulty"
                  defaultValue="Intermediate"
                  disabled={busy}
                >
                  {difficulties.map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="question-count">Questions</label>
                <select
                  id="question-count"
                  name="question_count"
                  defaultValue="5"
                  disabled={busy}
                >
                  {[1, 3, 5, 8, 10].map((count) => (
                    <option value={count} key={count}>
                      {count} question{count === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <fieldset className="skill-picker" disabled={busy}>
              <legend className="field-label">
                Focus areas <span className="label-optional">optional</span>
              </legend>
              {skills.map((skill) => (
                <label
                  key={skill.id}
                  className={selected.includes(skill.id) ? "selected" : ""}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(skill.id)}
                    onChange={(event) =>
                      setSelected((previous) =>
                        event.target.checked
                          ? [...previous, skill.id]
                          : previous.filter((id) => id !== skill.id),
                      )
                    }
                  />
                  {skill.name}
                </label>
              ))}
            </fieldset>
            <p className="panel-copy">
              Your profile, reviewed resume skills, and latest job analysis also
              help shape question selection.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle size={16} className="spin" aria-hidden="true" />
              ) : (
                <ArrowRight size={16} aria-hidden="true" />
              )}
              {busy ? "Creating your session…" : "Create interview"}
            </Button>
          </Card>
        </form>
        <Card className="workspace-panel session-guidance">
          <p className="eyebrow">A LITTLE SPACE TO THINK</p>
          <h2>Good practice is deliberate.</h2>
          <p>
            Explain your reasoning, include examples, and make your trade-offs
            clear.
          </p>
          <ul>
            <li>
              <Check size={16} aria-hidden="true" /> One question at a time
            </li>
            <li>
              <Check size={16} aria-hidden="true" /> Save drafts and return
              later
            </li>
            <li>
              <Check size={16} aria-hidden="true" /> No timer pressure
            </li>
          </ul>
          <p className="fine-note">
            Detailed scoring and feedback will arrive in a later milestone. This
            session focuses on your answers.
          </p>
        </Card>
      </div>
    </>
  );
}
