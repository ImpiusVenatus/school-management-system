"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary } from "@/lib/ui";

type Applicant = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  title: string | null;
  program_id: string;
  academic_year_id: string;
  student_email_id: string | null;
  student_mobile_number: string | null;
  application_date: string | null;
  application_status: string;
};

type Program = { id: string; program_name: string };
type AcademicYear = { id: string; academic_year_name: string };

export default function ApplicantsPage() {
  const { token, user, loading: authLoading } = useAuth();
  const snackbar = useSnackbar();
  const [enrollId, setEnrollId] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    program_id: "",
    academic_year_id: "",
    student_email_id: "",
    student_mobile_number: "",
  });

  const loadApplicants = useCallback(() => {
    if (!user && !token) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (statusFilter) params.set("application_status", statusFilter);
    api<Applicant[]>(`/api/applicants?${params.toString()}`, { token: token ?? undefined })
      .then(setApplicants)
      .catch(() => setApplicants([]))
      .finally(() => setLoading(false));
  }, [token, user, statusFilter]);

  useEffect(() => {
    if (authLoading || (!user && !token)) return;
    Promise.all([
      api<Program[]>("/api/programs?limit=200", { token: token ?? undefined }),
      api<AcademicYear[]>("/api/academic/years", { token: token ?? undefined }),
    ]).then(([p, y]) => {
      setPrograms(p);
      setYears(y);
      if (p.length) setForm((f) => ({ ...f, program_id: f.program_id || p[0].id }));
      if (y.length) setForm((f) => ({ ...f, academic_year_id: f.academic_year_id || y[0].id }));
    }).catch(() => {});
    loadApplicants();
  }, [authLoading, user, token, loadApplicants]);

  async function createApplicant(e: React.FormEvent) {
    e.preventDefault();
    if ((!user && !token) || !form.first_name || !form.program_id || !form.academic_year_id) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/applicants", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name || undefined,
          program_id: form.program_id,
          academic_year_id: form.academic_year_id,
          student_email_id: form.student_email_id || undefined,
          student_mobile_number: form.student_mobile_number || undefined,
        }),
      });
      setShowForm(false);
      setForm({ first_name: "", last_name: "", program_id: programs[0]?.id ?? "", academic_year_id: years[0]?.id ?? "", student_email_id: "", student_mobile_number: "" });
      snackbar.success("Application created.");
      loadApplicants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      snackbar.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    if (!user && !token) return;
    try {
      await api(`/api/applicants/${id}`, {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({ application_status: status }),
      });
      snackbar.success(`Status updated to ${status}.`);
      loadApplicants();
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function enrollApplicant(id: string) {
    if (!user && !token) return;
    try {
      const res = await api<{ student_id: string; message: string }>(`/api/applicants/enroll/${id}`, {
        token: token ?? undefined,
        method: "POST",
      });
      snackbar.success(`${res.message} Student ID: ${res.student_id}`);
      setEnrollId(null);
      loadApplicants();
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to enroll");
    }
  }

  function displayName(a: Applicant) {
    return a.title ?? [a.first_name, a.last_name].filter(Boolean).join(" ");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Admissions</h1>
        <button type="button" onClick={() => setShowForm(true)} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90">
          New Application
        </button>
      </div>

      <Card>
        <div className="mb-4">
          <SelectField
            label="Status"
            options={[
              { value: "", label: "All" },
              { value: "Applied", label: "Applied" },
              { value: "Approved", label: "Approved" },
              { value: "Rejected", label: "Rejected" },
              { value: "Admitted", label: "Admitted" },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All"
            triggerClassName="min-w-[10rem]"
          />
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : applicants.length === 0 ? (
          <p className="text-gray-500">No applications found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Program</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="py-2 font-medium">{displayName(a)}</td>
                    <td className="py-2">{programs.find((p) => p.id === a.program_id)?.program_name ?? a.program_id}</td>
                    <td className="py-2">{a.student_email_id ?? "—"}</td>
                    <td className="py-2">{a.application_date ?? "—"}</td>
                    <td className="py-2">
                      <span className={
                        a.application_status === "Approved" ? "text-green-600" :
                        a.application_status === "Rejected" ? "text-red-600" :
                        a.application_status === "Admitted" ? "text-blue-600" : "text-gray-600"
                      }>{a.application_status}</span>
                    </td>
                    <td className="py-2 space-x-2">
                      {a.application_status === "Applied" && (
                        <>
                          <button type="button" onClick={() => updateStatus(a.id, "Approved")} className="text-green-600 hover:underline text-xs">Approve</button>
                          <button type="button" onClick={() => updateStatus(a.id, "Rejected")} className="text-red-600 hover:underline text-xs">Reject</button>
                        </>
                      )}
                      {a.application_status === "Approved" && (
                        <button type="button" onClick={() => setEnrollId(a.id)} className="text-[var(--foreground)] font-medium hover:underline text-xs">Enroll</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Application" size="md">
        <form onSubmit={createApplicant} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
              <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
              <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
          <SelectField
            label="Program"
            required
            options={programs.map((p) => ({ value: p.id, label: p.program_name }))}
            value={form.program_id}
            onChange={(v) => setForm({ ...form, program_id: v })}
            placeholder="Select program"
          />
          <SelectField
            label="Academic year"
            required
            options={years.map((y) => ({ value: y.id, label: y.academic_year_name }))}
            value={form.academic_year_id}
            onChange={(v) => setForm({ ...form, academic_year_id: v })}
            placeholder="Select year"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.student_email_id} onChange={(e) => setForm({ ...form, student_email_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
            <input type="text" value={form.student_mobile_number} onChange={(e) => setForm({ ...form, student_mobile_number: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Saving..." : "Submit"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={enrollId !== null}
        onClose={() => setEnrollId(null)}
        onConfirm={() => enrollId && enrollApplicant(enrollId)}
        title="Enroll applicant?"
        confirmLabel="Enroll as student"
        variant="warning"
      >
        This creates a student record from the application. The applicant status will move to Admitted.
      </ConfirmModal>
    </div>
  );
}
