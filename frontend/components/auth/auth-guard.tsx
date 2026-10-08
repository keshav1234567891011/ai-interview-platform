"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { Button } from "../ui/button";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, error, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!loading && !user && !error)
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    if (!loading && user?.password_change_required && pathname !== "/change-password")
      router.replace("/change-password");
  }, [loading, user, error, router, pathname]);
  if (loading)
    return (
      <div
        className="workspace-loading"
        role="status"
        aria-label="Loading your workspace"
      >
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-panel" />
        <span>Loading your workspace…</span>
      </div>
    );
  if (error)
    return (
      <div className="workspace-loading">
        <h1>Let’s reconnect.</h1>
        <p className="form-error" role="alert">
          {error}
        </p>
        <Button onClick={() => void refresh()}>Try again</Button>
      </div>
    );
  return user && (!user.password_change_required || pathname === "/change-password") ? (
    children
  ) : (
    <div className="workspace-loading" role="status">
      Opening sign in…
    </div>
  );
}
