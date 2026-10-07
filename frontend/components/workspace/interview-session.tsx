"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, LoaderCircle, Save } from "lucide-react";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { readable, type Interview, type Question } from "@/lib/interview-types";
import { Card } from "../ui/card";
import { Button, ButtonLink } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";

export function InterviewSession({ id }: { id: string }) {
  const resource = useResource<Interview>(`/interviews/${id}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  async function transition(action: string) {
    setBusy(true);
    setError("");
    try {
      resource.setData(
        await api<Interview>(`/interviews/${id}/${action}`, { method: "POST" }),
      );
      setConfirmAbandon(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update this session.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!resource.data || resource.loading || resource.error)
    return (
      <WorkspaceState
        loading={resource.loading}
        error={resource.error}
        retry={resource.reload}
      />
    );
  const session = resource.data;
  const current = session.questions.find(
    (q) => q.sequence === session.current_sequence,
  );
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">YOUR INTERVIEW WORKSPACE</p>
          <h1>{session.role}</h1>
          <p>
            {session.difficulty} session · {session.question_count} questions
          </p>
        </div>
        <ButtonLink href="/interviews" variant="secondary">
          All sessions
        </ButtonLink>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {session.status === "completed" || session.status === "abandoned" ? (
        <Card className="workspace-panel session-finished">
          <span className="empty-icon">
            <Check size={24} aria-hidden="true" />
          </span>
          <p className="eyebrow">{readable(session.status)}</p>
          <h2>
            {session.status === "completed"
              ? "Interview complete."
              : "Session closed."}
          </h2>
          <p>
            {session.answered_count} of {session.question_count} questions
            answered
            {session.duration_seconds !== null
              ? ` · ${Math.floor(session.duration_seconds / 60)}m ${session.duration_seconds % 60}s`
              : ""}
            .
          </p>
          <p className="panel-copy">
            Detailed evaluation will be added in a later milestone. Your answers
            are saved.
          </p>
          <ButtonLink href="/interviews/new">
            Start another session <ArrowRight size={16} aria-hidden="true" />
          </ButtonLink>
          <details className="answer-review">
            <summary>Review your saved answers</summary>
            {session.questions
              .filter((q) => q.answered_at)
              .map((q) => (
                <article key={q.id}>
                  <h3>
                    {q.sequence}. {q.question_text}
                  </h3>
                  <p>{q.answer_text}</p>
                </article>
              ))}
          </details>
        </Card>
      ) : (
        <div className="interview-session-grid">
          <div>
            <Card className="workspace-panel session-progress">
              <div>
                <span>Session progress</span>
                <strong>
                  {session.answered_count} / {session.question_count}
                </strong>
              </div>
              <div
                className="metric-track"
                role="progressbar"
                aria-label="Questions answered"
                aria-valuenow={session.answered_count}
                aria-valuemin={0}
                aria-valuemax={session.question_count}
              >
                <span
                  style={{
                    width: `${(session.answered_count / session.question_count) * 100}%`,
                  }}
                />
              </div>
            </Card>
            {session.status === "created" ? (
              <Card className="workspace-panel session-start">
                <h2>A clear mind. A focused session.</h2>
                <p className="panel-copy">
                  Begin when you are ready. Your session can be resumed from any
                  device after saving.
                </p>
                <Button onClick={() => transition("start")} disabled={busy}>
                  {busy ? "Starting…" : "Begin interview"}
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </Card>
            ) : (
              current && (
                <AnswerEditor
                  key={current.id}
                  interview={session}
                  question={current}
                  onUpdate={resource.setData}
                />
              )
            )}
          </div>
          <Card className="workspace-panel session-guidance">
            <p className="eyebrow">THINK OUT LOUD, IN WRITING</p>
            <h2>Your reasoning matters.</h2>
            <p>
              State your approach. Explain why it works. Consider edge cases and
              trade-offs.
            </p>
            <p className="fine-note">
              Save your draft before leaving. Submitted answers are final. This
              session does not produce a score yet.
            </p>
            {confirmAbandon ? (
              <div
                className="abandon-confirm"
                role="group"
                aria-label="Confirm ending this session"
              >
                <p>
                  End this session? It will be kept in your history and cannot
                  be resumed.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmAbandon(false)}
                  disabled={busy}
                >
                  Keep practicing
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => transition("abandon")}
                  disabled={busy}
                >
                  Confirm end session
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setConfirmAbandon(true)}
                disabled={busy}
              >
                End session
              </Button>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function AnswerEditor({
  interview,
  question,
  onUpdate,
}: {
  interview: Interview;
  question: Question;
  onUpdate: (value: Interview) => void;
}) {
  const [draft, setDraft] = useState(question.answer_text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const dirty = draft !== question.answer_text;
  useEffect(() => {
    function protect(event: BeforeUnloadEvent) {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  async function save(submit: boolean) {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      onUpdate(
        await api<Interview>(
          `/interviews/${interview.id}/questions/${question.id}/answer`,
          {
            method: "PUT",
            body: JSON.stringify({ answer_text: draft, submit }),
          },
        ),
      );
      if (!submit) setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Your answer could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="workspace-panel question-panel">
      <div className="question-label">
        <span>QUESTION {question.sequence.toString().padStart(2, "0")}</span>
        <span>
          {readable(question.category)} · {question.difficulty}
        </span>
      </div>
      <h2 tabIndex={-1} ref={heading}>
        {question.question_text}
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(true);
        }}
        aria-busy={busy}
      >
        <div className="field">
          <label htmlFor="answer">Your answer</label>
          <textarea
            id="answer"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setSaved(false);
            }}
            disabled={busy}
            maxLength={12000}
            placeholder="Start with your approach, then explain your reasoning…"
            aria-describedby="answer-hint"
            required
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "s") {
                event.preventDefault();
                if (!busy) void save(false);
              }
            }}
          />
          <small id="answer-hint">
            {draft.length.toLocaleString()} / 12,000 characters · Ctrl/Cmd + S
            saves a draft
          </small>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => save(false)}
            disabled={busy}
          >
            <Save size={15} aria-hidden="true" />
            Save draft
          </Button>
          <Button type="submit" disabled={busy || !draft.trim()}>
            {busy ? (
              <LoaderCircle className="spin" size={16} aria-hidden="true" />
            ) : (
              <ArrowRight size={16} aria-hidden="true" />
            )}
            {busy
              ? "Saving your answer…"
              : question.sequence === interview.question_count
                ? "Finish interview"
                : "Save & next"}
          </Button>
        </div>
        <p className="draft-state" role="status">
          {saved
            ? "Draft saved. You can return to this session later."
            : dirty
              ? "Unsaved changes — save your draft before leaving."
              : "Your saved draft will be available when you return."}
        </p>
      </form>
    </Card>
  );
}
