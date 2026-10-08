"use client";
import { useAuth } from "../auth/auth-provider";
import { Card } from "../ui/card";
import { ButtonLink } from "../ui/button";
import { WorkspaceState } from "../ui/workspace-state";
import { accountDestination } from "@/lib/auth-destination";
export function OwnerGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, refresh } = useAuth();
  if (loading) return <WorkspaceState loading error="" retry={refresh} />;
  if (user?.role !== "owner" || user.password_change_required) return <Card className="workspace-panel"><h1>Owner access required.</h1><p>This control center is reserved for the application owner.</p><ButtonLink variant="secondary" href={user ? accountDestination(user) : "/login"}>Return to your workspace</ButtonLink></Card>;
  return children;
}
