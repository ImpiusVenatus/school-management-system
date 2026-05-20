"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function K12SectionsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/settings?tab=classes");
  }, [router]);
  return <p className="text-[var(--muted)] text-sm">Redirecting to Settings…</p>;
}
