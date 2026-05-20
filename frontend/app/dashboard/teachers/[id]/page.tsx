"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SelectField, GENDER_OPTIONS } from "@/components/ui/SelectField";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type Instructor = {
  id: string;
  instructor_name: string;
  employee_id: string | null;
  department: string | null;
  gender: string | null;
  status: string;
  termination_date: string | null;
  termination_reason: string | null;
};

type Assignment = {
  id: string;
  student_group_id: string | null;
  student_group_name: string | null;
  academic_year_id: string;
  role: string;
  assigned_at: string | null;
  removed_at: string | null;
};

export default function TeacherDetailPage() {
  const params = useParams();
  const { token } = useAuth();
  const id = params.id as string;
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [gender, setGender] = useState("");
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [termReason, setTermReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !id) return;
    api<Instructor>("/api/instructors/" + id, { token })
      .then((i) => {
        setInstructor(i);
        setName(i.instructor_name);
        setEmployeeId(i.employee_id ?? "");
        setDepartment(i.department ?? "");
        setGender(i.gender ?? "");
      })
      .catch(() => setInstructor(null));
    api<Assignment[]>("/api/instructors/" + id + "/assignments", { token })
      .then(setAssignments)
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  }, [token, id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !instructor) return;
    setSaving(true);
    setMessage("");
    try {
      const updated = await api<Instructor>("/api/instructors/" + id, {
        token,
        method: "PATCH",
        body: JSON.stringify({
          instructor_name: name,
          employee_id: employeeId || undefined,
          department: department || undefined,
          gender: gender || undefined,
        }),
      });
      setInstructor(updated);
      setEditing(false);
      setMessage("Saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTerminate() {
    if (!token || !instructor) return;
    setSaving(true);
    try {
      await api("/api/instructors/" + id, {
        token,
        method: "PATCH",
        body: JSON.stringify({
          status: "Left",
          termination_date: new Date().toISOString().slice(0, 10),
          termination_reason: termReason || undefined,
        }),
      });
      setInstructor((p) => p ? { ...p, status: "Left", termination_date: new Date().toISOString().slice(0, 10), termination_reason: termReason } : null);
      setTerminateOpen(false);
      setTermReason("");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !instructor) return <div className="text-gray-500">Loading...</div>;
  if (!instructor) return <div className="text-gray-500">Teacher not found. <Link href="/dashboard/teachers" className="text-[var(--foreground)] font-medium">Back</Link></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/dashboard/teachers" className="text-gray-500 hover:text-gray-700">Back to Teachers</Link>
        <h1 className="text-2xl font-bold text-gray-900">{instructor.instructor_name}</h1>
        {instructor.status === "Active" && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="ml-auto py-2 px-4 rounded-lg border border-gray-200 text-sm">Edit</button>
        )}
      </div>

      {message && <p className={`text-sm ${message === "Saved." ? "text-green-600" : "text-red-600"}`}>{message}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
          {editing ? (
            <form onSubmit={handleSave} className="space-y-3 text-sm">
              <div>
                <label className="text-gray-500 block mb-1">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Employee ID</label>
                <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Department</label>
                <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Gender</label>
                <SelectField
                  options={GENDER_OPTIONS.filter((o) => o.value !== "Other")}
                  value={gender}
                  onChange={setGender}
                  placeholder="—"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                <button type="button" onClick={() => setEditing(false)} className="py-2 px-4 rounded-lg border">Cancel</button>
              </div>
            </form>
          ) : (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-500">ID</dt><dd className="font-medium">{instructor.id}</dd></div>
              <div><dt className="text-gray-500">Employee ID</dt><dd>{instructor.employee_id ?? "—"}</dd></div>
              <div><dt className="text-gray-500">Department</dt><dd>{instructor.department ?? "—"}</dd></div>
              <div><dt className="text-gray-500">Status</dt><dd><span className={instructor.status === "Active" ? "text-green-600" : "text-gray-500"}>{instructor.status}</span></dd></div>
              {instructor.termination_date && <div><dt className="text-gray-500">Termination date</dt><dd>{instructor.termination_date}</dd></div>}
            </dl>
          )}
          {instructor.status === "Active" && !editing && (
            <button type="button" onClick={() => setTerminateOpen(true)} className="mt-4 py-2 px-4 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Terminate</button>
          )}
        </Card>
      </div>

      {terminateOpen && (
        <Card>
          <h3 className="font-semibold text-gray-900 mb-2">Terminate instructor</h3>
          <textarea value={termReason} onChange={(e) => setTermReason(e.target.value)} placeholder="Reason (optional)" className="w-full px-3 py-2 border rounded-lg mb-3" rows={2} />
          <div className="flex gap-2">
            <button type="button" onClick={handleTerminate} disabled={saving} className="py-2 px-4 rounded-lg bg-red-600 text-white disabled:opacity-50">Confirm</button>
            <button type="button" onClick={() => { setTerminateOpen(false); setTermReason(""); }} className="py-2 px-4 rounded-lg border">Cancel</button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Assignments</h2>
        {assignments.length === 0 ? <p className="text-gray-500">No assignments.</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2">Group</th>
                <th className="pb-2">Year</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b border-gray-100">
                  <td className="py-2">{a.student_group_name ?? a.student_group_id ?? "—"}</td>
                  <td className="py-2">{a.academic_year_id}</td>
                  <td className="py-2">{a.role}</td>
                  <td className="py-2">{a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
