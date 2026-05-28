"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { AddTeacherForm, type DepartmentOption, type DesignationOption } from "@/components/forms/AddTeacherForm";
import { PageLoader } from "@/components/ui/PulsingDotsLoader";
import { api } from "@/lib/api";
import { loadInstructorFormOptions } from "@/lib/instructor-options";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass } from "@/lib/ui";

const PAGE_SIZE = 50;

type Instructor = {
  id: string;
  instructor_name: string;
  employee_id: string | null;
  department: string | null;
  designation: string | null;
  status: string;
};

export default function TeachersPage() {
  const { token, loading: authLoading, hasPermission } = useAuth();
  const snackbar = useSnackbar();
  const canManage = hasPermission("instructors.manage");

  const [teachers, setTeachers] = useState<Instructor[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [designations, setDesignations] = useState<DesignationOption[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, department, designation, statusFilter]);

  const loadTeachers = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("skip", String(page * PAGE_SIZE));
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (department) params.set("department_id", department);
    if (designation) params.set("designation_id", designation);
    if (statusFilter) params.set("status", statusFilter);
    try {
      const rows = await api<Instructor[]>("/api/instructors?" + params.toString(), {
        token: token ?? undefined,
      });
      setTeachers(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setTeachers([]);
      snackbar.error(err instanceof Error ? err.message : "Failed to load teachers");
    } finally {
      setLoading(false);
    }
  }, [authLoading, token, page, debouncedSearch, department, designation, statusFilter, snackbar]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    if (authLoading) return;
    loadInstructorFormOptions(token).then(({ departments: depts, designations: desigs }) => {
      setDepartments(depts);
      setDesignations(desigs);
    });
  }, [authLoading, token]);

  const hasMore = teachers.length >= PAGE_SIZE;
  const stats = useMemo(() => {
    const active = teachers.filter((t) => t.status === "Active").length;
    const left = teachers.filter((t) => t.status === "Left").length;
    return { active, left };
  }, [teachers]);

  const statusOptions = [
    { value: "", label: "All statuses" },
    { value: "Active", label: "Active" },
    { value: "Left", label: "Left" },
  ];

  const deptSelectOptions = [
    { value: "", label: "All departments" },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  const designationSelectOptions = [
    { value: "", label: "All designations" },
    ...designations.map((d) => ({ value: d.id, label: d.name })),
  ];

  if (authLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
        <Card>
          <PageLoader minHeight="min-h-[12rem]" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            <Link href="/dashboard/settings?tab=designations" className="text-[var(--primary)] hover:underline">
              Manage designations
            </Link>
            {" · "}
            Showing {teachers.length} on this page
            {teachers.length > 0 && (
              <>
                {" "}
                · <span className="text-emerald-700">{stats.active} active</span>
                {stats.left > 0 && <span className="text-[var(--muted)]"> · {stats.left} left</span>}
              </>
            )}
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={() => setAddModalOpen(true)} className={btnPrimary}>
            Add Teacher
          </button>
        )}
      </div>

      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Teacher" size="sm">
        <AddTeacherForm
          departments={departments}
          designations={designations}
          onSuccess={() => {
            setAddModalOpen(false);
            setPage(0);
            loadTeachers();
          }}
          onCancel={() => setAddModalOpen(false)}
        />
      </Modal>

      <Card>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="search"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} max-w-xs`}
          />
          <SelectField
            options={deptSelectOptions}
            value={department}
            onChange={setDepartment}
            className="max-w-[200px]"
          />
          <SelectField
            options={designationSelectOptions}
            value={designation}
            onChange={setDesignation}
            className="max-w-[200px]"
          />
          <SelectField
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            className="max-w-[160px]"
          />
        </div>

        {loading ? (
          <PageLoader minHeight="min-h-[12rem]" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-light)]">
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Employee ID</th>
                    <th className="pb-3">Department</th>
                    <th className="pb-3">Designation</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[var(--muted)]">
                        No teachers found.
                      </td>
                    </tr>
                  ) : (
                    teachers.map((t) => (
                      <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-3 font-medium">{t.instructor_name}</td>
                        <td className="py-3 text-[var(--muted)]">{t.employee_id ?? "—"}</td>
                        <td className="py-3 text-[var(--muted)]">{t.department ?? "—"}</td>
                        <td className="py-3 text-[var(--muted)]">{t.designation ?? "—"}</td>
                        <td className="py-3">
                          {t.status === "Active" ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                              {t.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            href={"/dashboard/teachers/" + t.id}
                            className="text-[var(--foreground)] font-medium hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-[var(--border)]">
              <button
                type="button"
                className={btnSecondary}
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <span className="text-xs text-[var(--muted)]">Page {page + 1}</span>
              <button
                type="button"
                className={btnSecondary}
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
