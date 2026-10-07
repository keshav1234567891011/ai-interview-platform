import { AudioLines } from "lucide-react";

export function Brand() {
  return (
    <a className="brand" href="#top" aria-label="InterviewAI home">
      <span className="brand-icon">
        <AudioLines size={21} aria-hidden="true" />
      </span>
      <span>
        Interview<span className="brand-ai">AI</span>
      </span>
    </a>
  );
}
