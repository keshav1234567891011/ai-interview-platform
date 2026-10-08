export type HistoryItem = import("./workspace-types").InterviewSummary & {
  score: number | null; technical_score: number | null; communication_score: number | null; duration_seconds: number | null;
};
export type AnalyticsData = {
  completed_interviews: number; evaluated_interviews: number;
  averages: { score: number | null; technical_score: number | null; reasoning_score: number | null; communication_score: number | null };
  latest_score: number | null; best_score: number | null;
  trend: { id: string; role: string; date: string; score: number; technical_score: number; reasoning_score: number; communication_score: number }[];
  topics: { topic: string; score: number; observations: number }[];
  insights: string[];
};
