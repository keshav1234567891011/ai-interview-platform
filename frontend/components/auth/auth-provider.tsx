"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, ApiError } from "@/lib/api";

export type User = {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
};
type AuthState = {
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  authenticate: (
    kind: "login" | "register",
    data: Record<string, string>,
  ) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUser(await api<User>("/auth/me"));
      setError("");
    } catch (err) {
      setUser(null);
      setError(
        err instanceof ApiError && err.status === 401
          ? ""
          : err instanceof Error
            ? err.message
            : "Could not load your account.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api<User>("/auth/me", { signal: controller.signal })
      .then((current) => {
        if (!controller.signal.aborted) {
          setUser(current);
          setError("");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setUser(null);
          setError(
            err instanceof ApiError && err.status === 401
              ? ""
              : "Could not load your account. Please try again.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  async function authenticate(
    kind: "login" | "register",
    data: Record<string, string>,
  ) {
    const current = await api<User>(`/auth/${kind}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    setUser(current);
    setError("");
    setLoading(false);
  }
  async function logout() {
    try {
      await api<void>("/auth/logout", { method: "POST" });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) throw err;
    }
    setUser(null);
    setError("");
  }
  return (
    <AuthContext.Provider
      value={{ user, loading, error, refresh, authenticate, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider is missing");
  return auth;
}
