"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function NewStudentPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/api/students", {
        token,
        method: "POST",
        body: JSON.stringify({
          first_name: firstName,
          middle_name: middleName || undefined,
          last_name: lastName,
          student_email_id: email,
          student_mobile_number: mobile || undefined,
          guardians: [],
        }),
      });
      router.push("/dashboard/students");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create student");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/students" className="text-gray-500 hover:text-gray-700">← Students</Link>
        <h1 className="text-2xl font-bold text-gray-900">Add Student</h1>
      </div>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
            <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7A4CFF]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Middle name</label>
            <input type="text" value={middleName} onChange={(e) => setMiddleName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7A4CFF]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
            <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7A4CFF]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7A4CFF]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
            <input type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7A4CFF]" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="py-2 px-4 rounded-lg bg-[#7A4CFF] text-white font-medium hover:bg-[#6a3ee8] disabled:opacity-50">{saving ? "Saving..." : "Create"}</button>
            <Link href="/dashboard/students" className="py-2 px-4 rounded-lg border border-gray-200 text-gray-700">Cancel</Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
