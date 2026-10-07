import type { Skill } from "./workspace-types";
export type Resume = {
  id: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  created_at: string;
  skills: Skill[];
};
export type JobAnalysis = {
  id: string;
  required_skills: Skill[];
  preferred_skills: Skill[];
  matched_skills: Skill[];
  missing_skills: Skill[];
  role_keywords: string[];
  match_percentage: number | null;
  candidate_source: string;
  disclaimer: string;
};
