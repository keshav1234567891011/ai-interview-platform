"use client";
import { useAuth } from "@/components/auth/auth-provider";
export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div className="workspace-loading">
      <p className="eyebrow">YOUR WORKSPACE</p>
      <h1>Welcome, {user?.display_name}.</h1>
      <p>Your account is ready. Your candidate workspace is the next step.</p>
    </div>
  );
}
