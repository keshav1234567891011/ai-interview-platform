# Interview sessions

Interviews belong to one authenticated user. Ordered questions and their answers use separate tables; an answer's owner follows its question and interview. Row locks serialize PostgreSQL state changes. The API validates role, difficulty, question count (1–10), canonical focus skills, and a 12,000-character answer limit. Future prompts are withheld until their turn.

The 54-prompt bank covers 18 technical topics at three difficulty levels. Role, requested focus, profile skills, latest reviewed resume skills, and latest job-analysis skills determine stable selection. Exact prompts are unique within each session. If a role has fewer than ten prompts at one level, remaining prompts come from other levels; the actual level is shown per question.

Sessions transition from `created` to `in_progress`, then `completed` or `abandoned`. Only the current question accepts a draft or final submission; submitted answers cannot be overwritten. Completion follows the last submission. Start is idempotent; closed sessions cannot restart. Dashboard and history return actual records and counts, without scores.

The editor offers explicit draft saving and Ctrl/Cmd+S. Saved drafts recover from backend state across reloads and devices. Browser unload and workspace-link prompts protect unsaved edits. Save before leaving; unsaved text is intentionally not placed in browser storage. Completion duration uses stored start and completion timestamps, not an invented timer or deadline.

Tests exercise authorization, creation, selection, draft recovery, ordered submission, terminal states, real history, migration round trips, frontend requests, responsive layouts, and both themes. Detailed evaluation remains future work.
