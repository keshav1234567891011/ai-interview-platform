import { Button } from "./button";

export function WorkspaceState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  if (loading)
    return (
      <div className="workspace-state" role="status">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-panel" />
        <p>Loading your preparation workspace…</p>
      </div>
    );
  if (error)
    return (
      <div className="workspace-state">
        <h1>Let’s try that again.</h1>
        <p className="form-error" role="alert">
          {error}
        </p>
        <Button onClick={retry}>Try again</Button>
      </div>
    );
  return null;
}
