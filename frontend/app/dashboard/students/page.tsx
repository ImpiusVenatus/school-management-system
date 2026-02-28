"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type Student = { id: string; student_name: string | null; student_email_id: string; first_name: string; last_name: string };

export default function StudentsPage() {
  const { token } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (search) params.set("search", search);
    if (gradeLevel) params.set("grade_level", gradeLevel);
    if (sectionName) params.set("section_name", sectionName);
    api<Student[]>("/api/students?" + params.toString(), { token })
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [token, search, gradeLevel, sectionName]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <Link href="/dashboard/students/new" className="py-2 px-4 rounded-lg bg-[#7A4CFF] text-white font-medium hover:bg-[#6a3ee8]">Add Student</Link>
      </div>
      <Card>
        <div className="flex flex-wrap gap-4 mb-4">
          <input type="text" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="px-3 py-2 border rounded-lg w-64" />
          <input type="text" placeholder="Grade" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="px-3 py-2 border rounded-lg w-24" />
          <input type="text" placeholder="Section" value={sectionName} onChange={(e) => setSectionName(e.target.value)} className="px-3 py-2 border rounded-lg w-24" />
        </div>
        {loading ? <p className="text-gray-500">Loading...</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2">Name</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">ID</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? <tr><td colSpan={4} className="py-4 text-gray-400">No students.</td></tr> : students.map((s) => (
                <tr key={s.id} className="border-b border-gray-100">
                  <td className="py-3 font-medium">{s.student_name ?? s.first_name + " " + s.last_name}</td>
                  <td className="py-3">{s.student_email_id}</td>
                  <td className="py-3">{s.id}</td>
                  <td className="py-3"><Link href={"/dashboard/students/" + s.id} className="text-[#7A4CFF] hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
