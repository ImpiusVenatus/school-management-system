"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type Instructor = {
  id: string;
  instructor_name: string;
  employee_id: string | null;
  department: string | null;
  status: string;
};

export default function TeachersPage() {
  const { token } = useAuth();
  const [teachers, setTeachers] = useState<Instructor[]>([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (search) params.set("search", search);
    if (department) params.set("department", department);
    api<Instructor[]>("/api/instructors?" + params.toString(), { token })
      .then(setTeachers)
      .catch(() => setTeachers([]))
      .finally(() => setLoading(false));
  }, [token, search, department]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
        <Link href="/dashboard/teachers/new" className="py-2 px-4 rounded-lg bg-[#7A4CFF] text-white font-medium hover:bg-[#6a3ee8]">Add Teacher</Link>
      </div>
      <Card>
        <div className="flex flex-wrap gap-4 mb-4">
          <input type="text" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="px-3 py-2 border rounded-lg w-64" />
          <input type="text" placeholder="Department" value={department} onChange={(e) => setDepartment(e.target.value)} className="px-3 py-2 border rounded-lg w-40" />
        </div>
        {loading ? <p className="text-gray-500">Loading...</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2">Name</th>
                <th className="pb-2">Employee ID</th>
                <th className="pb-2">Department</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.length === 0 ? <tr><td colSpan={5} className="py-4 text-gray-400">No teachers found.</td></tr> : teachers.map((t) => (
                <tr key={t.id} className="border-b border-gray-100">
                  <td className="py-3 font-medium">{t.instructor_name}</td>
                  <td className="py-3">{t.employee_id ?? "—"}</td>
                  <td className="py-3">{t.department ?? "—"}</td>
                  <td className="py-3"><span className={t.status === "Active" ? "text-green-600" : "text-gray-500"}>{t.status}</span></td>
                  <td className="py-3"><Link href={"/dashboard/teachers/" + t.id} className="text-[#7A4CFF] hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
