import type { Interview } from "./interview-types";
export type EvaluationSummary = {
  score: number; technical_score: number; reasoning_score: number; communication_score: number;
  evaluated_answers: number; recommended_topics: string[];
  topics: { topic: string; score: number; observations: number }[];
};
export type Evaluation = {
  score: number; technical_score: number; reasoning_score: number; communication_score: number;
  source: "deterministic" | "ai"; strengths: string[]; weaknesses: string[];
  concepts_missed: string[]; feedback: string; improvement_suggestion: string;
  communication: { word_count: number; sentence_count: number; filler_count: number;
    fillers_per_100_words: number; frequent_fillers: Record<string, number>;
    duration_seconds: number | null; words_per_minute: number | null; pace: string | null; recommendations: string[] };
};
export type Results = {
  interview: Interview; summary: EvaluationSummary;
  questions: { id: string; sequence: number; question: string; category: string;
    answer: string; input_mode: string; evaluation: Evaluation }[];
};
