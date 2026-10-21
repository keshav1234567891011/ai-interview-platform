export type AISettings = {
  enabled: boolean;
  configured: boolean;
  database_key_present: boolean;
  credential_source: "database" | "environment" | "none";
  encryption_status: "ready" | "missing" | "invalid" | "unreadable";
  text_model: string;
  transcription_model: string;
  text_models: string[];
  transcription_models: string[];
  fallback_active: boolean;
  fallback_available: boolean;
  updated_at: string | null;
  updated_by: string | null;
};
