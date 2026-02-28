"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/api";

export default function SetupPage() {
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [schoolLogo, setSchoolLogo] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/setup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_name: schoolName,
          school_logo: schoolLogo || undefined,
          admin_email: adminEmail,
          admin_password: adminPassword,
          admin_full_name: adminFullName,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Setup failed");
      }
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem("school_token", data.access_token);
        window.location.href = "/dashboard";
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F8FC] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">School Setup</h1>
        <p className="text-gray-500 text-sm mb-6">Configure your school and create the first admin account.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
            <input type="text" required value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7A4CFF]" placeholder="e.g. ia Academy" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School Logo URL (optional)</label>
            <input type="text" value={schoolLogo} onChange={(e) => setSchoolLogo(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7A4CFF]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
            <input type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7A4CFF]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
            <input type="password" required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7A4CFF]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Full Name</label>
            <input type="text" value={adminFullName} onChange={(e) => setAdminFullName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7A4CFF]" placeholder="e.g. Priscilla Lily" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-[#7A4CFF] text-white font-medium hover:bg-[#6a3ee8] disabled:opacity-50">{loading ? "Setting up..." : "Complete Setup"}</button>
        </form>
      </div>
    </div>
  );
}
