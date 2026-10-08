"use client";
import { useState } from "react";
import { Check, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { Profile as ProfileData, Skill } from "@/lib/workspace-types";
import { useAuth } from "../auth/auth-provider";
import { Card } from "../ui/card";
import { Button, ButtonLink } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";

export function Profile() {
  const profile = useResource<ProfileData>("/profile");
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
  return <ProfileEditor initial={profile.data} skills={skills.data} />;
}

export function ProfileEditor({
  initial,
  skills,
  endpoint = "/profile",
  managed = false,
}: {
  initial: ProfileData;
  skills: Skill[];
  endpoint?: string;
  managed?: boolean;
}) {
  const [selected, setSelected] = useState(
    initial.skills.map((skill) => skill.id),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const { refresh } = useAuth();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setError("");
    const fields = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    try {
      await api<ProfileData>(endpoint, {
        method: "PUT",
        body: JSON.stringify({ ...fields, skill_ids: selected }),
      });
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save your profile.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">PREPARATION, PERSONALIZED</p>
          <h1>{managed ? "Candidate profile." : "Your profile. Your direction."}</h1>
          <p>A little context makes your practice more meaningful.</p>
        </div>
      </div>
      <form onSubmit={submit} aria-busy={busy} className="profile-form">
        <Card className="workspace-panel">
          <div className="panel-header">
            <h2>The essentials</h2>
            <span className="small-muted">Your professional context</span>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="display_name">Display name</label>
              <input
                name="display_name"
                id="display_name"
                defaultValue={initial.display_name}
                minLength={2}
                maxLength={80}
                required
                autoComplete="name"
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor="target_role">Target role</label>
              <input
                id="target_role"
                name="target_role"
                defaultValue={initial.target_role}
                maxLength={80}
                placeholder="e.g. Backend Developer"
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor="experience_level">Experience level</label>
              <select
                id="experience_level"
                name="experience_level"
                defaultValue={initial.experience_level}
                disabled={busy}
              >
                <option value="">Choose your experience</option>
                <option value="beginner">Exploring the field</option>
                <option value="entry">Student / entry level</option>
                <option value="mid">Mid level</option>
                <option value="senior">Senior</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="summary">
              Professional summary{" "}
              <span className="label-optional">Optional</span>
            </label>
            <textarea
              id="summary"
              name="summary"
              defaultValue={initial.summary}
              maxLength={1200}
              placeholder="A short introduction to your experience and interests."
              disabled={busy}
            />
            <small>
              Keep it professional. Avoid contact details or sensitive personal
              information.
            </small>
          </div>
        </Card>
        <Card className="workspace-panel">
          <div className="panel-header">
            <h2>Your technical toolkit</h2>
            <span className="small-muted">{selected.length} selected</span>
          </div>
          <p className="panel-copy">
            Choose the skills you want your preparation to build on.
          </p>
          <fieldset className="skill-picker" disabled={busy}>
            <legend className="sr-only">Technical skills</legend>
            {skills.map((skill) => (
              <label
                key={skill.id}
                className={selected.includes(skill.id) ? "selected" : ""}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(skill.id)}
                  onChange={(event) => {
                    setSaved(false);
                    setSelected(
                      event.target.checked
                        ? [...selected, skill.id]
                        : selected.filter((id) => id !== skill.id),
                    );
                  }}
                />
                <span>{skill.name}</span>
                {selected.includes(skill.id) && (
                  <Check size={14} aria-hidden="true" />
                )}
              </label>
            ))}
          </fieldset>
        </Card>
        {!managed && <Card
          id="account-settings"
          className="workspace-panel account-settings"
        >
          <ShieldCheck size={21} aria-hidden="true" />
          <div>
            <h2>Account settings</h2>
            <p>{initial.email}</p>
            <small>
              Your email is your sign-in identifier. Email changes and password
              recovery will come in a later milestone.
            </small>
            <div style={{ marginTop: 12 }}><ButtonLink variant="secondary" href="/change-password">Change password</ButtonLink></div>
          </div>
        </Card>}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions">
          <span role="status">
            {saved
              ? "Your profile is saved."
              : "Your preparation belongs to you."}
          </span>
          <Button type="submit" disabled={busy}>
            {busy ? (
              <LoaderCircle size={16} className="spin" aria-hidden="true" />
            ) : (
              <Save size={16} aria-hidden="true" />
            )}
            {busy ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </>
  );
}
