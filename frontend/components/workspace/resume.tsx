"use client";
import { useState } from "react";
import {
  Check,
  FileText,
  FileUp,
  LoaderCircle,
  Save,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { Resume as ResumeData } from "@/lib/resume-types";
import type { Skill } from "@/lib/workspace-types";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";
import { JobAnalysis } from "./job-analysis";

export function ResumeWorkspace() {
  const resumes = useResource<ResumeData[]>("/resumes");
  const vocabulary = useResource<Skill[]>("/skills");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    if (!file) return;
    setError("");
    if (
      !/\.(pdf|docx)$/i.test(file.name) ||
      file.size > 5 * 1024 * 1024 ||
      !file.size
    ) {
      setError("Choose a non-empty PDF or DOCX no larger than 5 MB.");
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const resume = await api<ResumeData>("/resumes", {
        method: "POST",
        body: form,
      });
      resumes.setData([resume, ...(resumes.data ?? [])]);
      setFile(null);
      element.reset();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Your document couldn’t be uploaded.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (
    resumes.loading ||
    vocabulary.loading ||
    resumes.error ||
    vocabulary.error
  )
    return (
      <WorkspaceState
        loading={resumes.loading || vocabulary.loading}
        error={resumes.error || vocabulary.error}
        retry={() => {
          resumes.reload();
          vocabulary.reload();
        }}
      />
    );
  const latest = resumes.data?.[0];
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">YOUR EXPERIENCE, IN CONTEXT</p>
          <h1>Give your preparation a starting point.</h1>
          <p>
            Your resume helps turn broad preparation into a focused next step.
          </p>
        </div>
      </div>
      <div className="workspace-two-columns resume-columns">
        <Card className="workspace-panel">
          <div className="panel-header">
            <h2>Your resume</h2>
            <FileUp size={20} aria-hidden="true" />
          </div>
          <form onSubmit={upload} aria-busy={busy}>
            <label className="upload-zone" htmlFor="resume-file">
              <FileUp size={28} aria-hidden="true" />
              <strong>{file ? file.name : "Choose your resume"}</strong>
              <span>PDF or DOCX · Up to 5 MB</span>
              <input
                id="resume-file"
                className="sr-only"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={busy}
                onChange={(event) => {
                  setError("");
                  setFile(event.target.files?.[0] ?? null);
                }}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="form-submit"
              disabled={!file || busy}
            >
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={16} aria-hidden="true" />
                  Uploading and extracting text…
                </>
              ) : (
                <>
                  <FileUp size={16} aria-hidden="true" />
                  Upload resume
                </>
              )}
            </Button>
          </form>
          <div className="privacy-note">
            <ShieldCheck size={16} aria-hidden="true" />
            <p>
              Your document is private to your account. Files stay in protected
              server storage. Parsing uses selectable text; OCR isn’t supported.
            </p>
          </div>
        </Card>
        <Card className="workspace-panel">
          <div className="panel-header">
            <h2>Current resume</h2>
            <FileText size={19} aria-hidden="true" />
          </div>
          {latest ? (
            <>
              <div className="current-resume">
                <span className="empty-icon">
                  <FileText size={24} aria-hidden="true" />
                </span>
                <div>
                  <h3>{latest.original_filename}</h3>
                  <p>
                    {Math.ceil(latest.file_size / 1024)} KB · Uploaded{" "}
                    {new Date(latest.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <ResumeSkills
                key={latest.id}
                resume={latest}
                vocabulary={vocabulary.data ?? []}
                onSaved={(updated) =>
                  resumes.setData(
                    (resumes.data ?? []).map((item) =>
                      item.id === updated.id ? updated : item,
                    ),
                  )
                }
              />
            </>
          ) : (
            <div className="empty-state compact-empty">
              <h3>Your story starts here.</h3>
              <p>
                Upload your resume to see likely technical skills. You can
                review and correct the extracted list before using it.
              </p>
            </div>
          )}
        </Card>
      </div>
      <JobAnalysis embedded />
    </>
  );
}

function ResumeSkills({
  resume,
  vocabulary,
  onSaved,
}: {
  resume: ResumeData;
  vocabulary: Skill[];
  onSaved: (resume: ResumeData) => void;
}) {
  const [selected, setSelected] = useState(
    resume.skills.map((skill) => skill.id),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      onSaved(
        await api<ResumeData>(`/resumes/${resume.id}/skills`, {
          method: "PUT",
          body: JSON.stringify({ skill_ids: selected }),
        }),
      );
      setMessage("Resume skills updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update skills.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="resume-skills">
      <h3>Review extracted skills</h3>
      <p className="panel-copy">
        These are vocabulary matches, not a proficiency assessment. Correct the
        list to reflect your experience.
      </p>
      <fieldset className="skill-picker" disabled={busy}>
        <legend className="sr-only">Resume technical skills</legend>
        {vocabulary.map((skill) => (
          <label
            className={selected.includes(skill.id) ? "selected" : ""}
            key={skill.id}
          >
            <input
              type="checkbox"
              checked={selected.includes(skill.id)}
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? [...selected, skill.id]
                    : selected.filter((id) => id !== skill.id),
                )
              }
            />
            <span>{skill.name}</span>
            {selected.includes(skill.id) && (
              <Check size={13} aria-hidden="true" />
            )}
          </label>
        ))}
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="resume-skill-actions">
        <Button variant="secondary" onClick={() => void save()} disabled={busy}>
          <Save size={14} aria-hidden="true" />
          {busy ? "Saving…" : "Save skills"}
        </Button>
        <span role="status">{message}</span>
      </div>
    </div>
  );
}
