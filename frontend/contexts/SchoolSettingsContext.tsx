"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";
import { DEFAULT_CURRENCY_CODE, formatMoney, getCurrency, normalizeCurrencyCode } from "@/lib/currency";

type SchoolSettingsContextValue = {
  schoolName: string;
  currencyCode: string;
  currencySymbol: string;
  formatMoney: (amount: number, options?: { maximumFractionDigits?: number }) => string;
  refresh: () => void;
  loading: boolean;
};

const SchoolSettingsContext = createContext<SchoolSettingsContextValue | null>(null);

export function SchoolSettingsProvider({ children }: { children: ReactNode }) {
  const { token, user, loading: authLoading } = useAuth();
  const [schoolName, setSchoolName] = useState("School");
  const [currencyCode, setCurrencyCode] = useState(DEFAULT_CURRENCY_CODE);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (authLoading) return;
    if (!user && !token) {
      setLoading(false);
      return;
    }
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(token ? getApiUrl("/api/settings") : "/api/proxy/settings", {
      headers,
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { school_name?: string; currency_code?: string } | null) => {
        if (d?.school_name) setSchoolName(d.school_name);
        if (d?.currency_code) setCurrencyCode(normalizeCurrencyCode(d.currency_code));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, user, authLoading]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onUpdate = () => load();
    window.addEventListener("school-settings-updated", onUpdate);
    return () => window.removeEventListener("school-settings-updated", onUpdate);
  }, [load]);

  const value = useMemo(
    () => ({
      schoolName,
      currencyCode,
      currencySymbol: getCurrency(currencyCode).symbol,
      formatMoney: (amount: number, options?: { maximumFractionDigits?: number }) =>
        formatMoney(amount, currencyCode, options),
      refresh: load,
      loading,
    }),
    [schoolName, currencyCode, load, loading]
  );

  return <SchoolSettingsContext.Provider value={value}>{children}</SchoolSettingsContext.Provider>;
}

export function useSchoolSettings() {
  const ctx = useContext(SchoolSettingsContext);
  if (!ctx) {
    return {
      schoolName: "School",
      currencyCode: DEFAULT_CURRENCY_CODE,
      currencySymbol: getCurrency(DEFAULT_CURRENCY_CODE).symbol,
      formatMoney: (amount: number, options?: { maximumFractionDigits?: number }) =>
        formatMoney(amount, DEFAULT_CURRENCY_CODE, options),
      refresh: () => {},
      loading: false,
    };
  }
  return ctx;
}
