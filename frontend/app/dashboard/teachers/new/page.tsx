"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function NewTeacherPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/api/instructors", {
        token,
        method: "POST",
        body: JSON.stringify({
          instructor_name: name,
          employee_id: employeeId || undefined,
          department: department || undefined,
          gender: gender || undefined,
          status: "Active",
        }),
      });
      router.push("/dashboard/teachers");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/teachers" className="text-gray-500 hover:text-gray-700">Back to Teachers</Link>
      <h1 className="text-2xl font-bold text-gray-900">Add Teacher</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
            <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <input type="text" value={gender} onChange={(e) => setGender(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="py-2 px-4 rounded-lg bg-[#7A4CFF] text-white font-medium disabled:opacity-50">{saving ? "Saving..." : "Create"}</button>
        </form>
      </Card>
    </div>
  );
}
