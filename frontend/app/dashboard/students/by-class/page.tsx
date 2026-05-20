"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type Program = { id: string; program_name: string; program_abbreviation?: string };
type StudentGroup = { id: string; student_group_name: string; students?: { student: string; student_name: string }[] };
type GroupStudent = { student: string; student_name: string };

export default function StudentsByClassPage() {
  const { token, user, loading: authLoading } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [sectionStudents, setSectionStudents] = useState<GroupStudent[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const apiOpts = { token: token ?? undefined };

  useEffect(() => {
    if (authLoading) return;
    if (!user && !token) {
      setLoadingPrograms(false);
      return;
    }
    setLoadingPrograms(true);
    api<Program[]>("/api/programs?limit=200", apiOpts)
      .then(setPrograms)
      .catch(() => setPrograms([]))
      .finally(() => setLoadingPrograms(false));
  }, [token, user, authLoading]);

  useEffect(() => {
    if (authLoading || (!user && !token)) return;
    if (!selectedProgramId) {
      setGroups([]);
      setSelectedGroupId(null);
      setSectionStudents([]);
      return;
    }
    setLoadingGroups(true);
    api<StudentGroup[]>(
      `/api/student-groups?program_id=${encodeURIComponent(selectedProgramId)}&limit=200`,
      apiOpts
    )
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoadingGroups(false));
    setSelectedGroupId(null);
    setSectionStudents([]);
  }, [token, user, authLoading, selectedProgramId]);

  useEffect(() => {
    if (authLoading || (!user && !token)) return;
    if (!selectedGroupId) {
      setSectionStudents([]);
      return;
    }
    setLoadingStudents(true);
    api<GroupStudent[]>(`/api/student-groups/${selectedGroupId}/students`, apiOpts)
      .then(setSectionStudents)
      .catch(() => setSectionStudents([]))
      .finally(() => setLoadingStudents(false));
  }, [token, user, authLoading, selectedGroupId]);

  const selectedProgram = programs.find((p) => p.id === selectedProgramId);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Students by Class</h1>
        <Link href="/dashboard/students" className="text-sm font-medium text-[var(--foreground)] hover:underline">
          All Students
        </Link>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            {loadingPrograms ? (
              <p className="text-gray-500 text-sm">Loading...</p>
            ) : (
              <SelectField
                label="Class (Program)"
                options={programs.map((p) => ({ value: p.id, label: p.program_name }))}
                value={selectedProgramId ?? ""}
                onChange={(v) => setSelectedProgramId(v || null)}
                placeholder="Select class"
              />
            )}
          </div>

          <div>
            {!selectedProgramId ? (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                <p className="text-gray-500 text-sm py-2">Select a class first</p>
              </>
            ) : loadingGroups ? (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                <p className="text-gray-500 text-sm py-2">Loading...</p>
              </>
            ) : (
              <SelectField
                label="Section"
                options={groups.map((g) => ({ value: g.id, label: g.student_group_name }))}
                value={selectedGroupId ?? ""}
                onChange={(v) => setSelectedGroupId(v || null)}
                placeholder="Select section"
              />
            )}
          </div>

          <div className="flex items-end">
            {selectedProgramId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProgramId(null);
                  setSelectedGroupId(null);
                  setSectionStudents([]);
                }}
                className="py-2 px-4 rounded-xl border border-[var(--border)] text-gray-700 hover:bg-gray-50 text-sm"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </Card>

      {selectedProgram && selectedGroup && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedProgram.program_name} → {selectedGroup.student_group_name}
          </h2>
          {loadingStudents ? (
            <p className="text-gray-500">Loading students...</p>
          ) : sectionStudents.length === 0 ? (
            <p className="text-gray-500">No students in this section.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-4">#</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionStudents.map((s, i) => (
                    <tr key={s.student} className="border-b border-gray-100">
                      <td className="py-2 pr-4">{i + 1}</td>
                      <td className="py-2 font-medium">{s.student_name ?? s.student}</td>
                      <td className="py-2">
                        <Link href={`/dashboard/students/${s.student}`} className="text-[var(--foreground)] hover:underline font-medium">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
