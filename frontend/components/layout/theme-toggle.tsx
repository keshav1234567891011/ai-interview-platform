"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const subscribe = (callback: () => void) => {
  window.addEventListener("interviewai-theme", callback);
  return () => {
    window.removeEventListener("interviewai-theme", callback);
  };
};

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme ?? "dark",
    () => "dark",
  );
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("interviewai-theme", next);
    } catch {
      /* Theme still works without storage. */
    }
    window.dispatchEvent(new Event("interviewai-theme"));
  }
  return (
    <button
      className="icon-button theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </button>
  );
}
