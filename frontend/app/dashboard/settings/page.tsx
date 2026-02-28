"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { api, getApiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type Settings = { school_name?: string | null; school_logo?: string | null };

export default function SettingsPage() {
  const { token, user } = useAuth();
  const [settings, setSettings] = useState<Settings>({});
  const [schoolName, setSchoolName] = useState("");
  const [schoolLogo, setSchoolLogo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const isAdmin = user?.role === "admin" || user?.is_superuser;

  useEffect(() => {
    if (!token) return;
    api<Settings>("/api/settings", { token })
      .then((d) => {
        setSettings(d);
        setSchoolName(d.school_name ?? "");
        setSchoolLogo(d.school_logo ?? "");
      })
      .catch(() => { setMessage("Failed to load settings"); setIsError(true); });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !isAdmin) return;
    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      await api("/api/settings", {
        token,
        method: "PATCH",
        body: JSON.stringify({ school_name: schoolName || undefined, school_logo: schoolLogo || undefined }),
      });
      setMessage("Settings saved.");
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <Card><p className="text-gray-500">Only administrators can update school settings.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">School Settings</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
            <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7A4CFF]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School Logo URL</label>
            <input type="text" value={schoolLogo} onChange={(e) => setSchoolLogo(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7A4CFF]" placeholder="Optional" />
          </div>
          {message && <p className={"text-sm " + (isError ? "text-red-600" : "text-green-600")}>{message}</p>}
          <button type="submit" disabled={saving} className="py-2 px-4 rounded-lg bg-[#7A4CFF] text-white font-medium hover:bg-[#6a3ee8] disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
        </form>
      </Card>
    </div>
  );
}
