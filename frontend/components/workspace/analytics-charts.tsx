"use client";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsData } from "@/lib/analytics-types";
export default function AnalyticsCharts({ trend }: { trend: AnalyticsData["trend"] }) {
  const data = trend.map((item, index) => ({ ...item, session: index + 1 }));
  return <figure aria-label="Scores across recent evaluated interviews"><div className="chart-frame"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} accessibilityLayer margin={{ top: 10, right: 15, bottom: 15, left: -15 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="session" stroke="var(--muted-foreground)" /><YAxis domain={[0, 100]} stroke="var(--muted-foreground)" /><Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} /><Legend /><Line dataKey="score" name="Overall" stroke="var(--primary)" strokeWidth={2} isAnimationActive={false} /><Line dataKey="technical_score" name="Technical" stroke="var(--highlight)" isAnimationActive={false} /><Line dataKey="communication_score" name="Communication" stroke="var(--success)" isAnimationActive={false} /></LineChart></ResponsiveContainer></div><figcaption>Up to 50 recent evaluated sessions, ordered by completion. Use the table below for exact values.</figcaption></figure>;
}
