"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Search,
  TriangleAlert,
  LoaderCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import type { JobAnalysis as JobResult } from "@/lib/resume-types";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

export function JobAnalysis({ embedded = false }: { embedded?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<JobResult | null>(null);
  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const description = String(
      new FormData(event.currentTarget).get("description"),
    );
    try {
      setResult(
        await api<JobResult>("/jobs/analyze", {
          method: "POST",
          body: JSON.stringify({ description }),
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not analyze this description.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!embedded && (
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">PREPARE FOR THE ROLE AHEAD</p>
            <h1>Find your next focus.</h1>
            <p>Turn a job description into a practical skill checklist.</p>
          </div>
        </div>
      )}
      <Card className="workspace-panel job-analysis-panel">
        <div className="panel-header">
          <h2>Understand the opportunity</h2>
          <Search size={19} aria-hidden="true" />
        </div>
        <form onSubmit={analyze} aria-busy={busy}>
          <div className="field">
            <label htmlFor="job-description">Target job description</label>
            <textarea
              id="job-description"
              name="description"
              minLength={30}
              maxLength={20000}
              required
              placeholder="Paste the role description, requirements, and preferred skills here…"
              disabled={busy}
              aria-describedby="job-help"
            />
            <small id="job-help">
              Matches your latest resume skills, or your profile if you haven’t
              uploaded a resume.
            </small>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <span>Deterministic analysis. No AI calls.</span>
            <Button type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={16} aria-hidden="true" />
              ) : (
                <ArrowRight size={16} aria-hidden="true" />
              )}
              {busy ? "Analyzing skills…" : "Analyze description"}
            </Button>
          </div>
        </form>
      </Card>
      {result && (
        <Card className="workspace-panel match-panel" aria-live="polite">
          <div className="match-overview">
            <div>
              <p className="eyebrow">BASELINE SKILL MATCH</p>
              <strong>
                {result.match_percentage === null
                  ? "—"
                  : `${result.match_percentage}%`}
              </strong>
              <p>
                {result.match_percentage === null
                  ? "No required skills recognized in this description."
                  : `Based on recognized required skills and your ${result.candidate_source}.`}
              </p>
            </div>
            <p>{result.disclaimer}</p>
          </div>
          <div className="match-columns">
            <div>
              <h3>
                <Check size={17} aria-hidden="true" />
                Matched skills
              </h3>
              <div className="skill-chips matched">
                {result.matched_skills.length ? (
                  result.matched_skills.map((skill) => (
                    <span key={skill.id}>{skill.name}</span>
                  ))
                ) : (
                  <p>No recognized overlap yet.</p>
                )}
              </div>
            </div>
            <div>
              <h3>
                <TriangleAlert size={16} aria-hidden="true" />
                Areas to explore
              </h3>
              <div className="skill-chips missing">
                {result.missing_skills.length ? (
                  result.missing_skills.map((skill) => (
                    <span key={skill.id}>{skill.name}</span>
                  ))
                ) : (
                  <p>No gaps found in the recognized vocabulary.</p>
                )}
              </div>
            </div>
          </div>
          {result.preferred_skills.length > 0 && (
            <div className="preferred-skills">
              <h3>Preferred skills</h3>
              <div className="skill-chips">
                {result.preferred_skills.map((skill) => (
                  <span key={skill.id}>{skill.name}</span>
                ))}
              </div>
            </div>
          )}
          <p className="panel-copy">
            Keyword matching can miss context and proficiency. Use this
            checklist to guide practice, never as a hiring decision.
          </p>
        </Card>
      )}
    </>
  );
}
