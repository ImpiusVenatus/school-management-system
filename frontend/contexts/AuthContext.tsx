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
  roles?: string[];
  permission_codes?: string[];
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (t: string | null) => void;
  setupStatus: { configured: boolean; school_name?: string | null } | null;
  checkSetup: () => Promise<void>;
  hasPermission: (code: string) => boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);
const TOKEN_KEY = "school_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupStatus, setSetupStatus] = useState<{
    configured: boolean;
    school_name?: string | null;
  } | null>(null);

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (typeof window !== "undefined") {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  const hasPermission = useCallback(
    (code: string) => {
      if (!user) return false;
      if (user.is_superuser) return true;
      const codes = user.permission_codes || [];
      if (codes.includes("*")) return true;
      return codes.includes(code);
    },
    [user]
  );

  const checkSetup = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/setup/status"));
      const data = await res.json();
      setSetupStatus({
        configured: data.configured,
        school_name: data.school_name ?? null,
      });
    } catch {
      setSetupStatus({ configured: true });
    }
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        setUser(await res.json());
        return true;
      }
    } catch {
      /* ignore */
    }
    const t = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (t) {
      try {
        const u = await api<User>("/api/auth/me", { token: t });
        setUser(u);
        setTokenState(t);
        return true;
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setTokenState(null);
      }
    }
    return false;
  }, []);

  useEffect(() => {
    loadUser()
      .then((ok) => {
        if (!ok) return checkSetup();
      })
      .finally(() => setLoading(false));
  }, [loadUser, checkSetup]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Login failed");
    }
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
      setTokenState(null);
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    const form = new FormData();
    form.append("username", email);
    form.append("password", password);
    const legacy = await fetch(getApiUrl("/api/auth/login"), { method: "POST", body: form });
    if (!legacy.ok) throw new Error("Login failed");
    const legacyData = await legacy.json();
    setToken(legacyData.access_token);
    const u = await api<User>("/api/auth/me", { token: legacyData.access_token });
    setUser(u);
  }, [setToken]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
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
        hasPermission,
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
