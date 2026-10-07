"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useAuth } from "./auth-provider";
import { Brand } from "../layout/brand";
import { ThemeToggle } from "../layout/theme-toggle";
import { Button } from "../ui/button";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const { authenticate } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(
      [...form.entries()].map(([key, value]) => [key, String(value)]),
    );
    if (
      register &&
      (!/[a-zA-Z]/.test(data.password) || !/\d/.test(data.password))
    ) {
      setError("Include a letter and a number in your password.");
      setBusy(false);
      return;
    }
    try {
      await authenticate(mode, data);
      const next =
        new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
      router.replace(
        /^\/(dashboard|profile|resume|jobs|interviews)(\/|$)/.test(next) &&
          !next.includes("\\")
          ? next
          : "/dashboard",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn’t sign you in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" tabIndex={-1} className="auth-page">
      <div className="auth-top">
        <Brand />
        <ThemeToggle />
      </div>
      <div className="auth-grid">
        <aside className="auth-story">
          <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
          <h1>
            Preparation with
            <br />
            <span>you at the center.</span>
          </h1>
          <p>
            A dedicated space to sharpen your skills, build confidence, and take
            the next step in your career.
          </p>
          <ul>
            {[
              "Practice shaped around your goals",
              "A clearer picture of your strengths",
              "One focused step at a time",
            ].map((item) => (
              <li key={item}>
                <Check size={16} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <div className="auth-privacy">
            <ShieldCheck size={21} aria-hidden="true" />
            <span>
              Your account, protected.
              <br />
              <small>Secure sessions. Your preparation stays yours.</small>
            </span>
          </div>
        </aside>
        <section className="auth-card" aria-labelledby="auth-title">
          <p className="eyebrow">
            {register ? "MAKE ROOM FOR PROGRESS" : "GOOD TO HAVE YOU BACK"}
          </p>
          <h2 id="auth-title">
            {register ? "Create your account" : "Welcome back."}
          </h2>
          <p>
            {register
              ? "Start building a more confident you."
              : "Your next step is waiting for you."}
          </p>
          <form onSubmit={submit} aria-busy={busy}>
            {register && (
              <div className="field">
                <label htmlFor="display_name">Display name</label>
                <input
                  id="display_name"
                  name="display_name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  required
                  placeholder="How should we call you?"
                  disabled={busy}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                placeholder="you@example.com"
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  minLength={register ? 10 : 1}
                  maxLength={128}
                  required
                  aria-describedby={register ? "password-help" : undefined}
                  placeholder={
                    register
                      ? "Create a strong password"
                      : "Enter your password"
                  }
                  disabled={busy}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setVisible(!visible)}
                  aria-label={visible ? "Hide password" : "Show password"}
                >
                  {visible ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
              {register && (
                <small id="password-help">
                  At least 10 characters, with a letter and a number.
                </small>
              )}
            </div>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <Button type="submit" className="form-submit" disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle size={17} className="spin" aria-hidden="true" />
                  {register ? "Creating your account…" : "Signing you in…"}
                </>
              ) : (
                <>
                  {register ? "Create account" : "Sign in"}
                  <ArrowRight size={17} aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
          <p className="auth-alternative">
            {register ? "Already have an account?" : "New to InterviewAI?"}{" "}
            <Link href={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className="auth-fineprint">
            A focused place to prepare. No noise, just your next step.
          </p>
        </section>
      </div>
    </main>
  );
}
