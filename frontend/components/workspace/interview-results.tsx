"use client";
import { aiReasonLabels } from "@/lib/ai-diagnostics";
import { useResource } from "@/lib/use-resource";
import type { Evaluation, Results } from "@/lib/evaluation-types";
import { readable } from "@/lib/interview-types";
import { Card } from "../ui/card";
import { ButtonLink } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";

const topicNames: Record<string, string> = {
  aws: "AWS", dbms: "DBMS", dsa: "Data Structures and Algorithms", sql: "SQL", oop: "OOP",
  fastapi: "FastAPI", nodejs: "Node.js", javascript: "JavaScript", typescript: "TypeScript",
  postgresql: "PostgreSQL", "computer-networks": "Computer Networks",
};
const topicName = (value: string) => topicNames[value] || readable(value).replace(/\b\w/g, c => c.toUpperCase());

function ScoreBreakdown({ evaluation }: { evaluation: Evaluation }) {
  const scores = [
    ["Overall", evaluation.score], ["Technical", evaluation.technical_score],
    ["Coverage", evaluation.coverage_score], ["Reasoning", evaluation.reasoning_score],
    ["Practical", evaluation.practical_score], ["Communication", evaluation.communication_score],
  ] as const;
  return <dl className="report-score-grid" aria-label="Scoring breakdown">
    {scores.map(([label, score]) => <div key={label}><dt>{label} </dt><dd>{score ?? "Unavailable"}{score != null && "/100"}</dd></div>)}
  </dl>;
}

export function InterviewResults({ id }: { id: string }) {
  const { data, loading, error, reload } = useResource<Results>(`/interviews/${id}/results`);
  if (!data || loading || error) return <WorkspaceState loading={loading} error={error} retry={reload} />;
  const summary = data.summary;
  const aiCount = data.questions.filter(q => q.evaluation.source === "ai").length;
  const baselineCount = data.questions.length - aiCount;
  const assessmentNote = baselineCount === 0
    ? `${aiCount === 1 ? "The answer" : `All ${aiCount} answers`} received Gemini AI evaluation. AI feedback may contain errors; verify technical claims.`
    : aiCount === 0
      ? `${baselineCount === 1 ? "The answer uses a baseline estimate" : `All ${baselineCount} answers use baseline estimates`} of concept coverage and answer structure. These estimates do not verify technical correctness.`
      : `${aiCount} ${aiCount === 1 ? "answer" : "answers"} received Gemini AI evaluation; ${baselineCount} ${baselineCount === 1 ? "answer uses a baseline estimate" : "answers use baseline estimates"}. Each answer identifies its evaluation source. Baseline estimates cannot verify technical correctness.`;
  return <>
    <div className="workspace-heading"><div><p className="eyebrow">REFLECT. REFINE. REPEAT.</p><h1>Your interview report.</h1><p>{data.interview.role} / {data.interview.difficulty} / {data.interview.answered_count} answers</p></div><ButtonLink href="/interviews/new">Practice again</ButtonLink></div>
    <div className="report-metrics">{[["Overall Score", summary.score], ["Technical Knowledge", summary.technical_score], ["Problem Solving", summary.reasoning_score], ["Communication", summary.communication_score]].map(([label, score]) => <Card className="workspace-stat" key={label}><span>{label}</span><strong>{score}<small> /100</small></strong></Card>)}</div>
    <p id="evaluation-disclaimer" className="panel-copy">{assessmentNote}</p>
    <p className="fine-note">Scores support interview practice and should not determine hiring decisions.</p>
    <div className="workspace-two-columns">
      <Card className="workspace-panel"><h2>Topic performance</h2><ul className="report-topic-list" aria-label="Topic performance">{summary.topics.map(topic => <li className="topic-row" key={topic.topic}><span>{topicName(topic.topic)} </span><strong>{topic.score}/100</strong></li>)}</ul></Card>
      <Card className="workspace-panel"><h2>Recommended improvement areas</h2><ul className="report-recommendations" aria-label="Recommended improvement areas">{summary.recommended_topics.map(topic => <li key={topic}>{topicName(topic)} </li>)}</ul><p className="panel-copy">Revisit concepts from the lowest scoring topics and try explaining each with an example.</p></Card>
    </div>
    <section className="report-section" aria-labelledby="communication-report"><h2 id="communication-report">Communication Analysis</h2><p className="panel-copy">Delivery signals describe answers, not personality or confidence. Pace is an estimate; pauses are omitted when timing is unavailable.</p><div className="report-metrics">{data.questions.map(({ id, sequence, evaluation: { communication: c } }) => <Card className="workspace-panel" key={id}><h3>Answer {sequence}</h3><p>{c.word_count} words / {c.sentence_count} sentence segments</p><p>{c.filler_count} likely fillers / {c.fillers_per_100_words} per 100 words</p>{c.words_per_minute !== null && <p>{c.words_per_minute} estimated words/min / {c.pace}</p>}{c.duration_seconds !== null && <p>{Math.round(c.duration_seconds)} seconds recorded</p>}<ul>{c.recommendations.map(item => <li key={item}>{item}</li>)}</ul></Card>)}</div></section>
    <section className="report-section" aria-labelledby="answer-feedback"><h2 id="answer-feedback">Question-by-question feedback</h2>{data.questions.map(q => <Card className="workspace-panel answer-report" key={q.id}>
      <p className="eyebrow">QUESTION {q.sequence} / {topicName(q.category)} / {q.evaluation.source === "ai" ? "Gemini AI feedback" : "Fallback mode / Baseline estimate"}</p>
      <h3>{q.question}</h3>
      <div className="report-source-labels"><p className="fine-note">Question source: {q.question_source === "ai" ? "Gemini AI question" : q.question_source === "question_bank" ? "Deterministic fallback question" : "Recorded question"}</p><p className="fine-note">Evaluation source: {q.evaluation.source === "ai" ? "Gemini AI evaluation" : "Baseline fallback evaluation"}</p></div>
      {q.evaluation.source === "ai" && q.evaluation.provider_model && <p className="fine-note">Evaluation model: {q.evaluation.provider_model}</p>}
      {q.evaluation.source !== "ai" && <p className="fine-note">{q.evaluation.fallback_reason ? aiReasonLabels[q.evaluation.fallback_reason] || "Provider unavailable" : "Fallback reason was not recorded for this older assessment."}</p>}
      <details><summary>Your {q.input_mode === "voice" ? "transcript" : "answer"}</summary><p className="answer-text">{q.answer}</p></details>
      <ScoreBreakdown evaluation={q.evaluation} />
      <h4>Strengths</h4><ul>{q.evaluation.strengths.map(item => <li key={item}>{item}</li>)}</ul>
      <h4>Areas to develop</h4><ul>{q.evaluation.weaknesses.map(item => <li key={item}>{item}</li>)}</ul>
      {!!q.evaluation.concepts_covered?.length && <p>Covered concepts: {q.evaluation.concepts_covered.join(", ")}</p>}
      {!!q.evaluation.concepts_missed.length && <p>Concepts to revisit: {q.evaluation.concepts_missed.join(", ")}</p>}
      <p className="answer-text">{q.evaluation.feedback}</p>
      <div className="feedback-next"><h4>Your next step</h4><p>{q.evaluation.improvement_suggestion}</p></div>
      {q.evaluation.sample_answer && <div className="feedback-next"><h4>Improved sample answer</h4><p className="answer-text">{q.evaluation.sample_answer}</p></div>}
    </Card>)}</section>
  </>;
}
