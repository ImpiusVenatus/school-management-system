"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
    if (!token && setupStatus?.configured) {
      router.replace("/login");
      return;
    }
  }, [loading, token, setupStatus, pathname, router]);

  useEffect(() => {
    if (token) {
      fetch(getApiUrl("/api/settings"), { headers: { Authorization: "Bearer " + token } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { school_name?: string } | null) => d?.school_name && setSchoolName(d.school_name))
        .catch(() => {});
    }
  }, [token]);

  if (loading) {
    return <div className="min-h-screen bg-[#F8F8FC] flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>;
  }
  if (setupStatus && !setupStatus.configured) return null;
  if (!token) return null;

  return (
    <div className="flex min-h-screen bg-[#F8F8FC]">
      <Sidebar schoolName={schoolName} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header user={user ?? undefined} onLogout={logout} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
