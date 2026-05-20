"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useRouter, usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, token, loading, logout, setupStatus } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [schoolName, setSchoolName] = useState("School");

  useEffect(() => {
    if (loading) return;
    if (setupStatus && !setupStatus.configured) {
      if (!pathname?.startsWith("/setup")) router.replace("/setup");
      return;
    }
    if (!user && !token && setupStatus?.configured) {
      router.replace("/login");
      return;
    }
  }, [loading, user, token, setupStatus, pathname, router]);

  useEffect(() => {
    const headers: HeadersInit = token ? { Authorization: "Bearer " + token } : {};
    fetch(token ? getApiUrl("/api/settings") : "/api/proxy/settings", { headers, credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { school_name?: string } | null) => d?.school_name && setSchoolName(d.school_name))
      .catch(() => {});
  }, [token, user]);

  if (loading) {
    return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  }
  if (setupStatus && !setupStatus.configured) return null;
  if (!user && !token) return null;

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Suspense fallback={<div className="w-64 shrink-0 bg-[var(--sidebar)] border-r border-[var(--border)]" />}>
        <Sidebar schoolName={schoolName} user={user ?? undefined} onLogout={logout} />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
