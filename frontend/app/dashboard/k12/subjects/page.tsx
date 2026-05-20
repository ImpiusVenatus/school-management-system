"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function K12SubjectsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/settings?tab=subjects");
  }, [router]);
  return <p className="text-[var(--muted)]">Redirecting to Settings…</p>;
}
