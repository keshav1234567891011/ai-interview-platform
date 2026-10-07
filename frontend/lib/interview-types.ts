import type { InterviewSummary } from "./workspace-types";
export const roles = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Java Developer",
  "Python Developer",
  "Data Analyst",
  "General SDE",
];
export const difficulties = ["Beginner", "Intermediate", "Advanced"];
export type Question = {
  id: string;
  sequence: number;
  question_text: string;
  category: string;
  difficulty: string;
  source: string;
  answer_text: string;
  answered_at: string | null;
};
export type Interview = InterviewSummary & {
  focus_areas: string[];
  started_at: string | null;
  duration_seconds: number | null;
  current_sequence: number | null;
  questions: Question[];
};
export const readable = (value: string) =>
  value.replaceAll("_", " ").replaceAll("-", " ");
