"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, type User } from "./auth-provider";
import { PasswordField } from "./password-field";
import { api } from "@/lib/api";
import { accountDestination } from "@/lib/auth-destination";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

export function ChangePassword() {
  const { user, refresh, logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const element = event.currentTarget; const form = new FormData(element);
    const payload = Object.fromEntries(form.entries());
    if (payload.new_password !== payload.confirm_password) { setError("New password and confirmation must match."); return; }
    setBusy(true); setError("");
    try { const updated = await api<User>("/auth/change-password", { method: "POST", body: JSON.stringify(payload) }); element.reset(); await refresh(); router.replace(accountDestination(updated)); }
    catch (err) { setError(err instanceof Error ? err.message : "Password change failed. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="security-workspace"><div className="workspace-heading"><div><p className="eyebrow">ACCOUNT SECURITY</p><h1>{user?.password_change_required ? "Make this account yours." : "Change your password."}</h1><p>{user?.password_change_required ? "Choose your own password before entering your workspace." : "A private password keeps your account protected."}</p></div></div><Card className="workspace-panel"><form onSubmit={submit} aria-busy={busy}><PasswordField name="current_password" label="Current password" current disabled={busy} /><PasswordField name="new_password" label="New password" disabled={busy} /><PasswordField name="confirm_password" label="Confirm new password" disabled={busy} /><p className="fine-note">At least 10 characters, including a letter and a number. Choose a different password. Other sessions will be signed out.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><Button type="submit" disabled={busy}>{busy ? "Changing password…" : "Change password"}</Button><Button type="button" variant="secondary" disabled={busy} onClick={async () => { try { await logout(); router.replace("/login"); } catch { setError("Could not sign out. Try again."); } }}>Sign out</Button></div></form></Card></div>;
}
