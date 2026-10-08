export type ScheduledInterview = {
  id: string; role: string; difficulty: string; focus_areas: string[]; question_count: number;
  ai_enabled: boolean; scheduled_at: string; status: "scheduled" | "cancelled" | "started";
  interview_id: string | null; created_at: string;
};
