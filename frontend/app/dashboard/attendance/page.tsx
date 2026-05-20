"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type AttendanceRecord = {
  id: string;
  student_id: string;
  student_name: string | null;
  date: string;
  status: string;
  student_group_id: string | null;
};

type StudentGroup = { id: string; student_group_name: string };
type GroupStudent = { student: string; student_name: string | null };

export default function AttendancePage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"view" | "mark">("view");
  const [roster, setRoster] = useState<GroupStudent[]>([]);
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [markSaving, setMarkSaving] = useState(false);
  const [markMessage, setMarkMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    api<StudentGroup[]>("/api/student-groups?limit=200", { token })
      .then(setGroups)
      .catch(() => setGroups([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "500");
    if (groupFilter) params.set("student_group_id", groupFilter);
    if (dateFilter) params.set("date", dateFilter);
    api<AttendanceRecord[]>(`/api/attendance?${params.toString()}`, { token })
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [token, groupFilter, dateFilter]);

  useEffect(() => {
    if (!token || !groupFilter || mode !== "mark") {
      setRoster([]);
      return;
    }
    api<GroupStudent[]>(`/api/student-groups/${groupFilter}/students`, { token })
      .then((students) => {
        setRoster(students);
        const present = new Set<string>();
        records.forEach((r) => {
          if (r.status === "Present" && students.some((s) => s.student === r.student_id)) {
            present.add(r.student_id);
          }
        });
        if (present.size === 0 && students.length > 0) {
          students.forEach((s) => present.add(s.student));
        }
        setPresentIds(present);
      })
      .catch(() => setRoster([]));
  }, [token, groupFilter, mode, records]);

  function togglePresent(studentId: string) {
    setPresentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function saveAttendance() {
    if (!token || !groupFilter || !dateFilter) return;
    setMarkSaving(true);
    setMarkMessage("");
    try {
      const present = roster.filter((s) => presentIds.has(s.student));
      const absent = roster.filter((s) => !presentIds.has(s.student));
      await api("/api/attendance/mark", {
        token,
        method: "POST",
        body: JSON.stringify({
          student_group_id: groupFilter,
          date: dateFilter,
          students_present: present.map((s) => ({ student: s.student, student_name: s.student_name })),
          students_absent: absent.map((s) => ({ student: s.student, student_name: s.student_name })),
        }),
      });
      setMarkMessage("Attendance saved.");
      setMode("view");
      const params = new URLSearchParams();
      params.set("limit", "500");
      params.set("student_group_id", groupFilter);
      params.set("date", dateFilter);
      const list = await api<AttendanceRecord[]>(`/api/attendance?${params.toString()}`, { token });
      setRecords(list);
    } catch (err) {
      setMarkMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setMarkSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("view")}
            className={`py-2 px-4 rounded-lg text-sm font-medium ${mode === "view" ? "bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90" : "border border-gray-200"}`}
          >
            View
          </button>
          <button
            type="button"
            onClick={() => setMode("mark")}
            className={`py-2 px-4 rounded-lg text-sm font-medium ${mode === "mark" ? "bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90" : "border border-gray-200"}`}
          >
            Mark attendance
          </button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <SelectField
              label="Section"
              options={groups.map((g) => ({ value: g.id, label: g.student_group_name }))}
              value={groupFilter}
              onChange={setGroupFilter}
              placeholder="Select section"
              triggerClassName="min-w-[10rem]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-neutral-900/10"
            />
          </div>
        </div>

        {mode === "mark" ? (
          !groupFilter ? (
            <p className="text-gray-500">Select a section to mark attendance.</p>
          ) : roster.length === 0 ? (
            <p className="text-gray-500">No students in this section.</p>
          ) : (
            <div>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2">Present</th>
                      <th className="pb-2">Student</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((s) => (
                      <tr key={s.student} className="border-b border-gray-100">
                        <td className="py-2">
                          <input
                            type="checkbox"
                            checked={presentIds.has(s.student)}
                            onChange={() => togglePresent(s.student)}
                            className="rounded border-gray-300 text-[var(--foreground)] focus:ring-neutral-900/10"
                          />
                        </td>
                        <td className="py-2 font-medium">{s.student_name ?? s.student}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {markMessage && <p className={`text-sm mb-3 ${markMessage.includes("saved") ? "text-green-600" : "text-red-600"}`}>{markMessage}</p>}
              <button
                type="button"
                onClick={saveAttendance}
                disabled={markSaving}
                className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {markSaving ? "Saving..." : "Save attendance"}
              </button>
            </div>
          )
        ) : loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : records.length === 0 ? (
          <p className="text-gray-500">No attendance records for this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2">Student</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Section</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-2 font-medium">{r.student_name ?? r.student_id}</td>
                    <td className="py-2">{r.date}</td>
                    <td className="py-2">
                      <span className={r.status === "Present" ? "text-green-600" : r.status === "Absent" ? "text-red-600" : "text-gray-600"}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2">{groups.find((g) => g.id === r.student_group_id)?.student_group_name ?? r.student_group_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
