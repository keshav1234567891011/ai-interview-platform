export type Skill = { id: string; name: string; category: string };
export type Profile = {
  display_name: string;
  email: string;
  target_role: string;
  experience_level: string;
  summary: string;
  skills: Skill[];
  completion: number;
};
export type InterviewSummary = {
  id: string;
  role: string;
  difficulty: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  question_count: number;
  answered_count: number;
};
export type Dashboard = {
  profile: Profile;
  recent_interviews: InterviewSummary[];
  interview_count: number;
  latest_evaluation?: import("./evaluation-types").EvaluationSummary & { interview_id: string } | null;
  next_scheduled?: import("./schedule-types").ScheduledInterview | null;
};
