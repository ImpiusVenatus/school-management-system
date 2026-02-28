"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const router = useRouter();
  const { token, loading, setupStatus } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (setupStatus && !setupStatus.configured) {
      router.replace("/setup");
      return;
    }
    if (token) {
      router.replace("/dashboard");
      return;
    }
    router.replace("/login");
  }, [loading, token, setupStatus, router]);

  return (
    <div className="min-h-screen bg-[#F8F8FC] flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  );
}
