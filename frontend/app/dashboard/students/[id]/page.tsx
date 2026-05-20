"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SelectField, GENDER_OPTIONS } from "@/components/ui/SelectField";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";

type Student = {
  id: string;
  student_name: string | null;
  student_email_id: string;
  first_name: string;
  last_name: string;
  student_mobile_number?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  nationality?: string;
  address_line_1?: string;
  city?: string;
  enabled?: boolean;
  guardians?: { guardian_name: string; relation?: string }[];
};

type Enrollment = {
  id: string;
  grade_level?: string;
  section_name?: string;
  student_advisor_name?: string;
};

export default function StudentDetailPage() {
  const params = useParams();
  const { token, user } = useAuth();
  const snackbar = useSnackbar();
  const id = params.id as string;
  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [mobile, setMobile] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [nationality, setNationality] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if ((!user && !token) || !id) return;
    api<Student>(`/api/students/${id}`, { token: token ?? undefined })
      .then((s) => {
        setStudent(s);
        setMobile(s.student_mobile_number ?? "");
        setGender(s.gender ?? "");
        setBloodGroup(s.blood_group ?? "");
        setNationality(s.nationality ?? "");
        setAddress(s.address_line_1 ?? "");
        setCity(s.city ?? "");
      })
      .catch(() => setStudent(null));
    api<Enrollment[]>(`/api/enrollments?student_id=${id}&limit=10`, { token: token ?? undefined })
      .then(setEnrollments)
      .catch(() => setEnrollments([]))
      .finally(() => setLoading(false));
  }, [token, id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if ((!user && !token) || !student) return;
    setSaving(true);
    setMessage("");
    try {
      const updated = await api<Student>(`/api/students/${id}`, {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({
          student_mobile_number: mobile || undefined,
          gender: gender || undefined,
          blood_group: bloodGroup || undefined,
          nationality: nationality || undefined,
          address_line_1: address || undefined,
          city: city || undefined,
        }),
      });
      setStudent(updated);
      setEditing(false);
      snackbar.success("Student saved.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !student) return <div className="text-gray-500">Loading...</div>;
  if (!student) {
    return (
      <div className="text-gray-500">
        Student not found. <Link href="/dashboard/students" className="text-[var(--foreground)] font-medium">Back to list</Link>
      </div>
    );
  }

  const currentEnrollment = enrollments[0];
  const displayName = student.student_name ?? `${student.first_name} ${student.last_name}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/dashboard/students" className="text-gray-500 hover:text-gray-700">Back to Students</Link>
        <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="ml-auto py-2 px-4 rounded-lg border border-gray-200 text-sm">Edit</button>
        )}
      </div>

      {message && <p className={`text-sm ${message === "Saved." ? "text-green-600" : "text-red-600"}`}>{message}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
          {editing ? (
            <form onSubmit={handleSave} className="space-y-3 text-sm">
              <div><label className="text-gray-500 block mb-1">Email</label><p>{student.student_email_id}</p></div>
              <div>
                <label className="text-gray-500 block mb-1">Mobile</label>
                <input type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Gender</label>
                <SelectField
                  options={GENDER_OPTIONS}
                  value={gender}
                  onChange={setGender}
                  placeholder="—"
                />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Blood group</label>
                <input type="text" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Nationality</label>
                <input type="text" value={nationality} onChange={(e) => setNationality(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Address</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">City</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                <button type="button" onClick={() => setEditing(false)} className="py-2 px-4 rounded-lg border">Cancel</button>
              </div>
            </form>
          ) : (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-500">ID</dt><dd className="font-medium">{student.id}</dd></div>
              <div><dt className="text-gray-500">Email</dt><dd>{student.student_email_id}</dd></div>
              <div><dt className="text-gray-500">Mobile</dt><dd>{student.student_mobile_number ?? "—"}</dd></div>
              <div><dt className="text-gray-500">Date of birth</dt><dd>{student.date_of_birth ?? "—"}</dd></div>
              <div><dt className="text-gray-500">Gender</dt><dd>{student.gender ?? "—"}</dd></div>
              <div><dt className="text-gray-500">Blood group</dt><dd>{student.blood_group ?? "—"}</dd></div>
              <div><dt className="text-gray-500">Nationality</dt><dd>{student.nationality ?? "—"}</dd></div>
              <div><dt className="text-gray-500">Address</dt><dd>{[student.address_line_1, student.city].filter(Boolean).join(", ") || "—"}</dd></div>
            </dl>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current enrollment</h2>
          {currentEnrollment ? (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-500">Grade</dt><dd>{currentEnrollment.grade_level ?? "—"}</dd></div>
              <div><dt className="text-gray-500">Section</dt><dd>{currentEnrollment.section_name ?? "—"}</dd></div>
              <div><dt className="text-gray-500">Advisor</dt><dd>{currentEnrollment.student_advisor_name ?? "—"}</dd></div>
            </dl>
          ) : (
            <p className="text-gray-500">No enrollment record.</p>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Guardians</h2>
        {student.guardians && student.guardians.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {student.guardians.map((g, i) => (
              <li key={i}>{g.guardian_name} {g.relation ? `(${g.relation})` : ""}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No guardians linked.</p>
        )}
      </Card>
    </div>
  );
}
