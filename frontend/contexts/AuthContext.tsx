"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { api, getApiUrl } from "@/lib/api";

type User = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role: string;
  is_superuser?: boolean;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (t: string | null) => void;
  setupStatus: { configured: boolean } | null;
  checkSetup: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "school_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupStatus, setSetupStatus] = useState<{ configured: boolean } | null>(null);

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (typeof window !== "undefined") {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  const checkSetup = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/setup/status"));
      const data = await res.json();
      setSetupStatus({ configured: data.configured });
    } catch {
      setSetupStatus({ configured: true });
    }
  }, []);

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (t) {
      setTokenState(t);
      api<User>("/api/auth/me", { token: t })
        .then(setUser)
        .catch(() => {
          setTokenState(null);
          localStorage.removeItem(TOKEN_KEY);
        })
        .finally(() => setLoading(false));
    } else {
      checkSetup().finally(() => setLoading(false));
    }
  }, [checkSetup]);

  const login = useCallback(
    async (email: string, password: string) => {
      const form = new FormData();
      form.append("username", email);
      form.append("password", password);
      const res = await fetch(getApiUrl("/api/auth/login"), {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Login failed");
      }
      const data = await res.json();
      const t = data.access_token;
      setToken(t);
      const u = await api<User>("/api/auth/me", { token: t });
      setUser(u);
    },
    [setToken]
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    if (typeof window !== "undefined") window.location.href = "/login";
  }, [setToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        setToken,
        setupStatus,
        checkSetup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
