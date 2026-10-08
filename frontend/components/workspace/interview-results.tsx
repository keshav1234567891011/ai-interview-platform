"use client";
import { useResource } from "@/lib/use-resource";
import type { Results } from "@/lib/evaluation-types";
import { readable } from "@/lib/interview-types";
import { Card } from "../ui/card";
import { ButtonLink } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";

export function InterviewResults({ id }: { id: string }) {
  const { data, loading, error, reload } = useResource<Results>(`/interviews/${id}/results`);
  if (!data || loading || error) return <WorkspaceState loading={loading} error={error} retry={reload} />;
  const summary = data.summary;
  return <>
    <div className="workspace-heading"><div><p className="eyebrow">REFLECT. REFINE. REPEAT.</p><h1>Your interview report.</h1><p>{data.interview.role} · {data.interview.difficulty} · {data.interview.answered_count} answers</p></div><ButtonLink href="/interviews/new">Practice again</ButtonLink></div>
    <div className="report-metrics">{[["Overall Score", summary.score], ["Technical Knowledge", summary.technical_score], ["Problem Solving", summary.reasoning_score], ["Communication", summary.communication_score]].map(([label, score]) => <Card className="workspace-stat" key={label}><span>{label}</span><strong>{score}<small>/100</small></strong></Card>)}</div>
    <p className="fine-note">Scores support practice, not hiring judgments. Baseline evaluation estimates concept coverage and structure; it cannot verify nuanced correctness. Pace is an estimate; pauses are omitted when timing is unavailable.</p>
    <div className="workspace-two-columns"><Card className="workspace-panel"><h2>Topic performance</h2>{summary.topics.map((topic) => <div className="topic-row" key={topic.topic}><span>{readable(topic.topic)}</span><strong>{topic.score}/100</strong></div>)}</Card><Card className="workspace-panel"><h2>Recommended improvement areas</h2><div className="skill-chips">{summary.recommended_topics.map((topic) => <span key={topic}>{readable(topic)}</span>)}</div><p className="panel-copy">Revisit concepts from the lowest scoring topics and try explaining each with an example.</p></Card></div>
    <section className="report-section" aria-labelledby="communication-report"><h2 id="communication-report">Communication Analysis</h2><p className="panel-copy">Delivery signals describe answers, not personality or confidence.</p><div className="report-metrics">{data.questions.map(({ id, sequence, evaluation: { communication: c } }) => <Card className="workspace-panel" key={id}><h3>Answer {sequence}</h3><p>{c.word_count} words · {c.sentence_count} sentence segments</p><p>{c.filler_count} likely fillers · {c.fillers_per_100_words} per 100 words</p>{c.words_per_minute !== null && <p>{c.words_per_minute} estimated words/min · {c.pace}</p>}{c.duration_seconds !== null && <p>{Math.round(c.duration_seconds)} seconds recorded</p>}<ul>{c.recommendations.map((item) => <li key={item}>{item}</li>)}</ul></Card>)}</div></section>
    <section className="report-section" aria-labelledby="answer-feedback"><h2 id="answer-feedback">Question-by-question feedback</h2>{data.questions.map((q) => <Card className="workspace-panel answer-report" key={q.id}><p className="eyebrow">QUESTION {q.sequence} · {readable(q.category)} · {q.evaluation.source === "ai" ? "AI-assisted feedback" : "Baseline estimate"}</p><h3>{q.question}</h3><details><summary>Your {q.input_mode === "voice" ? "transcript" : "answer"}</summary><p className="answer-text">{q.answer}</p></details><p className="report-scores">Technical {q.evaluation.technical_score}/100 · Reasoning {q.evaluation.reasoning_score}/100 · Communication {q.evaluation.communication_score}/100</p><h4>Strengths</h4><ul>{q.evaluation.strengths.map((item) => <li key={item}>{item}</li>)}</ul><h4>Areas to develop</h4><ul>{q.evaluation.weaknesses.map((item) => <li key={item}>{item}</li>)}</ul>{!!q.evaluation.concepts_missed.length && <p>Concepts to revisit: {q.evaluation.concepts_missed.join(", ")}</p>}<p>{q.evaluation.feedback}</p><div className="feedback-next"><h4>Your next step</h4><p>{q.evaluation.improvement_suggestion}</p></div></Card>)}</section>
  </>;
}
