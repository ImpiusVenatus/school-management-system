"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SelectField, GENDER_OPTIONS } from "@/components/ui/SelectField";
import { PageLoader } from "@/components/ui/PulsingDotsLoader";
import { api } from "@/lib/api";
import { loadInstructorFormOptions } from "@/lib/instructor-options";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/ui";
import type { DepartmentOption, DesignationOption } from "@/components/forms/AddTeacherForm";

type Instructor = {
  id: string;
  instructor_name: string;
  employee_id: string | null;
  department_id: string | null;
  department: string | null;
  designation_id: string | null;
  designation: string | null;
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

type YearOpt = { id: string; academic_year_name: string };

export default function TeacherDetailPage() {
  const params = useParams();
  const { token, loading: authLoading, hasPermission } = useAuth();
  const snackbar = useSnackbar();
  const id = params.id as string;
  const canManage = hasPermission("instructors.manage");

  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [years, setYears] = useState<YearOpt[]>([]);
  const [yearFilter, setYearFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [designations, setDesignations] = useState<DesignationOption[]>([]);
  const [gender, setGender] = useState("");
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [termReason, setTermReason] = useState("");
  const [saving, setSaving] = useState(false);

  const loadInstructor = useCallback(async () => {
    if (authLoading || !id) return;
    try {
      const i = await api<Instructor>("/api/instructors/" + id, { token: token ?? undefined });
      setInstructor(i);
      setName(i.instructor_name);
      setEmployeeId(i.employee_id ?? "");
      setDepartmentId(i.department_id ?? "");
      setDesignationId(i.designation_id ?? "");
      setGender(i.gender ?? "");
    } catch {
      setInstructor(null);
    }
  }, [authLoading, token, id]);

  const loadAssignments = useCallback(async () => {
    if (authLoading || !id) return;
    setAssignmentsLoading(true);
    const q = yearFilter ? "?academic_year_id=" + encodeURIComponent(yearFilter) : "";
    try {
      const rows = await api<Assignment[]>("/api/instructors/" + id + "/assignments" + q, {
        token: token ?? undefined,
      });
      setAssignments(Array.isArray(rows) ? rows : []);
    } catch {
      setAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [authLoading, token, id, yearFilter]);

  useEffect(() => {
    if (authLoading) return;
    loadInstructorFormOptions(token).then(({ departments: depts, designations: desigs }) => {
      setDepartments(depts);
      setDesignations(desigs);
    });
  }, [authLoading, token]);

  useEffect(() => {
    if (authLoading) return;
    api<YearOpt[]>("/api/academic/years?include_counts=false", { token: token ?? undefined })
      .then((rows) => {
        const list = (Array.isArray(rows) ? rows : []).map((r: YearOpt & { academic_year_name?: string }) => ({
          id: r.id,
          academic_year_name: r.academic_year_name ?? r.id,
        }));
        setYears(list);
      })
      .catch(() => setYears([]));
  }, [authLoading, token]);

  useEffect(() => {
    if (authLoading || !id) return;
    setLoading(true);
    loadInstructor().finally(() => setLoading(false));
  }, [authLoading, id, loadInstructor]);

  useEffect(() => {
    if (authLoading || !id) return;
    loadAssignments();
  }, [authLoading, id, loadAssignments]);

  const yearNameById = useMemo(() => {
    const m = new Map<string, string>();
    years.forEach((y) => m.set(y.id, y.academic_year_name));
    return m;
  }, [years]);

  const yearOptions = useMemo(
    () => [{ value: "", label: "All years" }, ...years.map((y) => ({ value: y.id, label: y.academic_year_name }))],
    [years]
  );

  const departmentSelectOptions = useMemo(
    () => [{ value: "", label: "—" }, ...departments.map((d) => ({ value: d.id, label: d.name }))],
    [departments]
  );

  const designationSelectOptions = useMemo(
    () => [{ value: "", label: "—" }, ...designations.map((d) => ({ value: d.id, label: d.name }))],
    [designations]
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!instructor || !canManage) return;
    const trimmed = name.trim();
    if (!trimmed) {
      snackbar.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const updated = await api<Instructor>("/api/instructors/" + id, {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({
          instructor_name: trimmed,
          employee_id: employeeId.trim() || undefined,
          department_id: departmentId || null,
          designation_id: designationId || null,
          gender: gender || undefined,
        }),
      });
      setInstructor(updated);
      setEditing(false);
      snackbar.success("Teacher saved.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTerminate() {
    if (!instructor || !canManage) return;
    setSaving(true);
    try {
      const termDate = new Date().toISOString().slice(0, 10);
      const updated = await api<Instructor>("/api/instructors/" + id, {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({
          status: "Left",
          termination_date: termDate,
          termination_reason: termReason.trim() || undefined,
        }),
      });
      setInstructor(updated);
      setTerminateOpen(false);
      setTermReason("");
      snackbar.success("Teacher marked as left.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to terminate");
    } finally {
      setSaving(false);
    }
  }

  async function handleReactivate() {
    if (!instructor || !canManage) return;
    setSaving(true);
    try {
      const updated = await api<Instructor>("/api/instructors/" + id, {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({
          status: "Active",
          termination_date: null,
          termination_reason: null,
        }),
      });
      setInstructor(updated);
      snackbar.success("Teacher reactivated.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to reactivate");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || (loading && !instructor)) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/teachers" className="text-gray-500 hover:text-gray-700">
          Back to Teachers
        </Link>
        <Card>
          <PageLoader minHeight="min-h-[12rem]" />
        </Card>
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="text-[var(--muted)]">
        Teacher not found.{" "}
        <Link href="/dashboard/teachers" className="text-[var(--foreground)] font-medium">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/dashboard/teachers" className="text-gray-500 hover:text-gray-700">
          Back to Teachers
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{instructor.instructor_name}</h1>
        {instructor.status === "Active" ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            Active
          </span>
        ) : (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
            Left
          </span>
        )}
        {canManage && instructor.status === "Active" && !editing && (
          <button type="button" onClick={() => setEditing(true)} className={`${btnSecondary} ml-auto text-sm`}>
            Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
          {editing ? (
            <form onSubmit={handleSave} className="space-y-3 text-sm">
              <div>
                <label className={labelClass}>Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Employee ID</label>
                <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Department</label>
                <SelectField
                  options={departmentSelectOptions}
                  value={departmentId}
                  onChange={setDepartmentId}
                  placeholder="Select department…"
                />
              </div>
              <div>
                <label className={labelClass}>Designation</label>
                <SelectField
                  options={designationSelectOptions}
                  value={designationId}
                  onChange={setDesignationId}
                  placeholder="Select designation…"
                />
              </div>
              <div>
                <label className={labelClass}>Gender</label>
                <SelectField options={GENDER_OPTIONS} value={gender} onChange={setGender} placeholder="—" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className={btnPrimary}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setName(instructor.instructor_name);
                    setEmployeeId(instructor.employee_id ?? "");
                    setDepartmentId(instructor.department_id ?? "");
                    setDesignationId(instructor.designation_id ?? "");
                    setGender(instructor.gender ?? "");
                  }}
                  className={btnSecondary}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Employee ID</dt>
                <dd className="font-medium">{instructor.employee_id ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Department</dt>
                <dd>{instructor.department ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Designation</dt>
                <dd>{instructor.designation ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Gender</dt>
                <dd>{instructor.gender ?? "—"}</dd>
              </div>
              {instructor.status === "Left" && instructor.termination_date && (
                <div>
                  <dt className="text-[var(--muted)]">Termination date</dt>
                  <dd>{instructor.termination_date}</dd>
                </div>
              )}
              {instructor.status === "Left" && instructor.termination_reason && (
                <div>
                  <dt className="text-[var(--muted)]">Termination reason</dt>
                  <dd>{instructor.termination_reason}</dd>
                </div>
              )}
            </dl>
          )}
          {canManage && instructor.status === "Active" && !editing && !terminateOpen && (
            <button
              type="button"
              onClick={() => setTerminateOpen(true)}
              className="mt-4 py-2 px-4 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm"
            >
              Terminate
            </button>
          )}
          {canManage && instructor.status === "Left" && !editing && (
            <button type="button" onClick={handleReactivate} disabled={saving} className={`${btnPrimary} mt-4`}>
              {saving ? "Reactivating…" : "Reactivate"}
            </button>
          )}
        </Card>
      </div>

      {terminateOpen && canManage && (
        <Card>
          <h3 className="font-semibold text-gray-900 mb-2">Terminate teacher</h3>
          <textarea
            value={termReason}
            onChange={(e) => setTermReason(e.target.value)}
            placeholder="Reason (optional)"
            className={`${inputClass} mb-3`}
            rows={2}
          />
          <div className="flex gap-2">
            <button type="button" onClick={handleTerminate} disabled={saving} className="py-2 px-4 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50">
              Confirm terminate
            </button>
            <button
              type="button"
              onClick={() => {
                setTerminateOpen(false);
                setTermReason("");
              }}
              className={btnSecondary}
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Assignments</h2>
          <SelectField
            options={yearOptions}
            value={yearFilter}
            onChange={setYearFilter}
            className="max-w-[220px]"
          />
        </div>
        {assignmentsLoading ? (
          <PageLoader minHeight="min-h-[8rem]" />
        ) : assignments.length === 0 ? (
          <p className="text-[var(--muted)]">No assignments{yearFilter ? " for this year" : ""}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-light)]">
                  <th className="pb-3">Group</th>
                  <th className="pb-3">Year</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Assigned</th>
                  <th className="pb-3">Removed</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const historical = !!a.removed_at;
                  return (
                    <tr
                      key={a.id}
                      className={`border-b border-[var(--border)] last:border-0 ${historical ? "opacity-50" : ""}`}
                    >
                      <td className="py-3">{a.student_group_name ?? a.student_group_id ?? "—"}</td>
                      <td className="py-3">{yearNameById.get(a.academic_year_id) ?? a.academic_year_id}</td>
                      <td className="py-3">{a.role}</td>
                      <td className="py-3 text-[var(--muted)]">
                        {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3 text-[var(--muted)]">
                        {a.removed_at ? new Date(a.removed_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
