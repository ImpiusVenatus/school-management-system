"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RolesSettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/settings?tab=roles");
  }, [router]);
  return <p className="text-[var(--muted)]">Redirecting to Settings…</p>;
}
