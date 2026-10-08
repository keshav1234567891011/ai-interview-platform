"use client";
import dynamic from "next/dynamic";
import { useResource } from "@/lib/use-resource";
import type { AnalyticsData } from "@/lib/analytics-types";
import { readable } from "@/lib/interview-types";
import { Card } from "../ui/card";
import { ButtonLink } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";
const Charts = dynamic(() => import("./analytics-charts"), { ssr: false, loading: () => <p role="status">Preparing your chart…</p> });
export function Analytics() {
  const resource = useResource<AnalyticsData>("/analytics");
  if (!resource.data || resource.loading || resource.error) return <WorkspaceState loading={resource.loading} error={resource.error} retry={resource.reload} />;
  const data = resource.data;
  return <><div className="workspace-heading"><div><p className="eyebrow">PROGRESS YOU CAN SEE</p><h1>Your performance, in perspective.</h1><p>Insights drawn from your own completed practice sessions.</p></div><ButtonLink href="/interviews/new">Keep practicing</ButtonLink></div>
    <div className="report-metrics">{[["Completed interviews", data.completed_interviews], ["Average overall score", data.averages.score ?? "—"], ["Latest score", data.latest_score ?? "—"], ["Best score", data.best_score ?? "—"]].map(([label, value]) => <Card className="workspace-stat" key={label}><span>{label}</span><strong>{value}</strong></Card>)}</div>
    {!data.evaluated_interviews ? <Card className="workspace-panel"><div className="empty-state"><h2>Your first data point starts with practice.</h2><p>Complete an interview to unlock technical and communication insights. Older sessions gain baseline feedback when you open their results.</p><ButtonLink href="/interviews/new">Start a session</ButtonLink></div></Card> : <>
      <div className="workspace-summary-grid">{[["Technical average", data.averages.technical_score], ["Reasoning average", data.averages.reasoning_score], ["Communication average", data.averages.communication_score]].map(([label, value]) => <Card className="workspace-stat" key={label}><span>{label}</span><strong>{value}<small>/100</small></strong></Card>)}</div>
      <p className="fine-note">Averages weight {data.evaluated_interviews} evaluated interviews equally. Baseline estimates support practice; they are not hiring judgments.</p>
      <Card className="workspace-panel"><h2>Score trend</h2>{data.trend.length === 1 && <p className="panel-copy">One session is a starting point. More sessions are needed to describe a trend.</p>}<Charts trend={data.trend} /><details><summary>View score table</summary><div className="data-table"><table><caption className="sr-only">Recent evaluated interview scores</caption><thead><tr><th scope="col">Completed</th><th scope="col">Overall</th><th scope="col">Technical</th><th scope="col">Communication</th></tr></thead><tbody>{data.trend.map(item => <tr key={item.id}><td>{new Date(item.date).toLocaleDateString()}</td><td>{item.score}</td><td>{item.technical_score}</td><td>{item.communication_score}</td></tr>)}</tbody></table></div></details></Card>
      <div className="workspace-two-columns"><Card className="workspace-panel"><h2>Topic performance</h2>{data.topics.map((topic, index) => <div className="topic-row" key={topic.topic}><div>{readable(topic.topic)}<small>{topic.observations} evaluated answers{index === 0 ? " · lowest recorded topic" : index === data.topics.length - 1 ? " · highest recorded topic" : ""}</small></div><strong>{topic.score}/100</strong></div>)}</Card><Card className="workspace-panel"><h2>Progress insights</h2>{data.insights.length ? <ul className="insights-list">{data.insights.map(insight => <li key={insight}>{insight}</li>)}</ul> : <p className="panel-copy">At least three evaluated sessions or repeated topic answers are needed for reliable comparisons. Keep practicing to build that context.</p>}</Card></div>
    </>}
  </>;
}
