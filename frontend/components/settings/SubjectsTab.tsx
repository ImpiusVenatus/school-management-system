"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { api } from "@/lib/api";
import { cachedGet, invalidateSettingsCache } from "@/lib/settings-cache";
import { PageLoader } from "@/components/ui/PulsingDotsLoader";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/ui";

type K12Subject = {
  id: string;
  name: string;
  code: string;
  is_optional: boolean;
  department_id?: string | null;
  department_name?: string | null;
  grades_label?: string | null;
};

type ProgramCourse = {
  id: string;
  course_name: string;
  department?: string | null;
};

type Department = {
  id: string;
  name: string;
  is_active: boolean;
};

const BADGE_PALETTE = [
  "bg-sky-50 text-sky-800 border-sky-200",
  "bg-slate-100 text-slate-700 border-slate-200",
  "bg-amber-50 text-amber-800 border-amber-200",
  "bg-rose-50 text-rose-800 border-rose-200",
  "bg-emerald-50 text-emerald-800 border-emerald-200",
  "bg-violet-50 text-violet-800 border-violet-200",
];

function deptBadgeClass(departmentId: string): string {
  let h = 0;
  for (let i = 0; i < departmentId.length; i++) {
    h = (h + departmentId.charCodeAt(i)) % BADGE_PALETTE.length;
  }
  return BADGE_PALETTE[h];
}

export function SubjectsTab({
  token,
  schoolType,
}: {
  token?: string | null;
  schoolType: string;
}) {
  const snackbar = useSnackbar();
  const [k12Subjects, setK12Subjects] = useState<K12Subject[]>([]);
  const [courses, setCourses] = useState<ProgramCourse[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<K12Subject | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programDept, setProgramDept] = useState("");
  const [gradesLabel, setGradesLabel] = useState("");
  const [isOptional, setIsOptional] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (schoolType === "k12") {
        const data = await cachedGet<{ subjects: K12Subject[]; departments: Department[] }>(
          "/api/k12/subjects-page",
          { token: token ?? undefined }
        );
        setK12Subjects(data.subjects);
        setDepartments(data.departments);
        setCourses([]);
      } else {
        const rows = await cachedGet<ProgramCourse[]>("/api/courses?limit=200", {
          token: token ?? undefined,
        }).catch(() => [] as ProgramCourse[]);
        setCourses(rows);
        setK12Subjects([]);
        setDepartments([]);
      }
    } catch {
      snackbar.error("Could not load subjects");
    } finally {
      setLoading(false);
    }
  }, [schoolType, token, snackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const activeDepartments = useMemo(
    () => departments.filter((d) => d.is_active),
    [departments]
  );

  const deptFilterChips = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of departments) {
      seen.set(d.id, d.name);
    }
    for (const s of k12Subjects) {
      if (s.department_id && s.department_name && !seen.has(s.department_id)) {
        seen.set(s.department_id, s.department_name);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [departments, k12Subjects]);

  const deptSelectOptions = useMemo(
    () => [
      { value: "", label: "No department" },
      ...activeDepartments.map((d) => ({ value: d.id, label: d.name })),
    ],
    [activeDepartments]
  );

  const filteredK12Subjects = useMemo(() => {
    if (schoolType !== "k12") return [] as K12Subject[];
    const q = search.trim().toLowerCase();
    return k12Subjects.filter((s) => {
      if (deptFilter !== "all") {
        if (deptFilter === "none") return !s.department_id;
        if (s.department_id !== deptFilter) return false;
      }
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.department_name || "").toLowerCase().includes(q)
      );
    });
  }, [k12Subjects, search, deptFilter, schoolType]);

  const filteredCourses = useMemo(() => {
    if (schoolType === "k12") return [] as ProgramCourse[];
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (!q) return true;
      return c.course_name.toLowerCase().includes(q) || (c.department || "").toLowerCase().includes(q);
    });
  }, [courses, search, schoolType]);

  const stats = useMemo(() => {
    if (schoolType !== "k12") return { total: courses.length, optional: 0 };
    return {
      total: k12Subjects.length,
      optional: k12Subjects.filter((s) => s.is_optional).length,
    };
  }, [k12Subjects, courses, schoolType]);

  function openCreate() {
    setEditing(null);
    setName("");
    setCode("");
    setDepartmentId("");
    setProgramDept("");
    setGradesLabel("");
    setIsOptional(false);
    setModal(true);
  }

  function openEdit(s: K12Subject) {
    setEditing(s);
    setName(s.name);
    setCode(s.code);
    setDepartmentId(s.department_id ?? "");
    setGradesLabel(s.grades_label ?? "");
    setIsOptional(s.is_optional);
    setModal(true);
  }

  function resetForm() {
    setModal(false);
    setEditing(null);
    setName("");
    setCode("");
    setDepartmentId("");
    setProgramDept("");
    setGradesLabel("");
    setIsOptional(false);
  }

  async function saveSubject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (schoolType === "k12") {
        const payload = {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          is_optional: isOptional,
          department_id: departmentId || null,
          grades_label: gradesLabel || undefined,
        };
        if (editing) {
          const updated = await api<K12Subject>(`/api/k12/subjects/${editing.id}`, {
            token: token ?? undefined,
            method: "PATCH",
            body: JSON.stringify(payload),
          });
          setK12Subjects((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          invalidateSettingsCache("/api/k12/subjects-page");
          invalidateSettingsCache("/api/academic/departments");
          snackbar.success("Subject updated.");
        } else {
          const created = await api<K12Subject>("/api/k12/subjects", {
            token: token ?? undefined,
            method: "POST",
            body: JSON.stringify(payload),
          });
          setK12Subjects((prev) => [...prev, created]);
          invalidateSettingsCache("/api/k12/subjects-page");
          invalidateSettingsCache("/api/academic/departments");
          snackbar.success("Subject added.");
        }
      } else {
        await api("/api/courses", {
          token: token ?? undefined,
          method: "POST",
          body: JSON.stringify({
            course_name: name.trim(),
            department: programDept || undefined,
            description: code.trim() ? `Code: ${code.trim()}` : undefined,
          }),
        });
        await load();
        snackbar.success("Subject added.");
      }
      resetForm();
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubject(s: K12Subject) {
    if (!confirm(`Delete subject "${s.name}"?`)) return;
    try {
      await api(`/api/k12/subjects/${s.id}`, { token: token ?? undefined, method: "DELETE" });
      setK12Subjects((prev) => prev.filter((x) => x.id !== s.id));
      invalidateSettingsCache("/api/k12/subjects-page");
      invalidateSettingsCache("/api/academic/departments");
      snackbar.success("Subject deleted.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Cannot delete subject");
    }
  }

  const meta = TAB_META.subjects;

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        actions={
          <button type="button" onClick={openCreate} className={btnPrimary}>
            + New subject
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="py-3 px-4">
          <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Total</p>
          <p className="text-xl font-bold mt-1">{stats.total}</p>
        </Card>
        {schoolType === "k12" && (
          <Card className="py-3 px-4">
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Optional</p>
            <p className="text-xl font-bold mt-1">{stats.optional}</p>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        {schoolType === "k12" && (
          <>
            <button
              type="button"
              onClick={() => setDeptFilter("all")}
              className={`cursor-pointer text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                deptFilter === "all"
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]"
              }`}
            >
              All
            </button>
            {deptFilterChips.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDeptFilter(id)}
                className={`cursor-pointer text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  deptFilter === id
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDeptFilter("none")}
              className={`cursor-pointer text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                deptFilter === "none"
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]"
              }`}
            >
              Unassigned
            </button>
          </>
        )}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subjects or codes…"
          className={`${inputClass} max-w-xs ml-auto`}
        />
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <PageLoader minHeight="min-h-[12rem]" />
        ) : schoolType === "k12" ? (
          filteredK12Subjects.length === 0 ? (
            <p className="p-6 text-sm text-[var(--muted)]">No subjects yet. Add your first subject.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-light)] border-b border-[var(--border)] bg-neutral-50/80">
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Grades</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredK12Subjects.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--border)] last:border-0 hover:bg-neutral-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-[var(--primary-light)] flex items-center justify-center text-[10px] font-bold">
                            {s.code.slice(0, 3)}
                          </span>
                          <p className="font-medium">{s.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                      <td className="px-4 py-3">
                        {s.department_name && s.department_id ? (
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${deptBadgeClass(s.department_id)}`}
                          >
                            {s.department_name}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">{s.grades_label || "—"}</td>
                      <td className="px-4 py-3">
                        {s.is_optional ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            Optional
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--muted)]">Core</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button type="button" onClick={() => openEdit(s)} className={btnSecondary}>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSubject(s)}
                          className="cursor-pointer ml-2 text-xs text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filteredCourses.length === 0 ? (
          <p className="p-6 text-sm text-[var(--muted)]">No subjects yet. Add your first subject.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-light)] border-b border-[var(--border)]">
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Department</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border)]">
                    <td className="px-4 py-3 font-medium">{c.course_name}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{c.department || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modal}
        onClose={() => !saving && resetForm()}
        title={editing ? "Edit subject" : "New subject"}
        size="md"
      >
        <form onSubmit={saveSubject} className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Code</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={inputClass}
              placeholder="ENG"
            />
          </div>
          {schoolType === "k12" && (
            <>
              {activeDepartments.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  No departments yet.{" "}
                  <Link href="/dashboard/settings?tab=departments" className="text-[var(--primary)] underline">
                    Create departments
                  </Link>{" "}
                  first, or leave unassigned.
                </p>
              ) : (
                <SelectField
                  label="Department"
                  options={deptSelectOptions}
                  value={departmentId}
                  onChange={setDepartmentId}
                />
              )}
              <div>
                <label className={labelClass}>Grades (optional)</label>
                <input
                  type="text"
                  value={gradesLabel}
                  onChange={(e) => setGradesLabel(e.target.value)}
                  className={inputClass}
                  placeholder="KG–10"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isOptional} onChange={(e) => setIsOptional(e.target.checked)} />
                Optional subject
              </label>
            </>
          )}
          {schoolType !== "k12" && (
            <div>
              <label className={labelClass}>Department (free text)</label>
              <input
                type="text"
                value={programDept}
                onChange={(e) => setProgramDept(e.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => resetForm()} className={btnSecondary} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : editing ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
