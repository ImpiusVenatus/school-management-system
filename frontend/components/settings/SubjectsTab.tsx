"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { api } from "@/lib/api";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/ui";

type K12Subject = {
  id: string;
  name: string;
  code: string;
  is_optional: boolean;
  department?: string | null;
  grades_label?: string | null;
  periods_per_week?: number | null;
};

type ProgramCourse = {
  id: string;
  course_name: string;
  department?: string | null;
};

const DEPT_FILTERS = ["All", "Languages", "STEM", "Humanities", "Activity"] as const;

const DEPT_COLORS: Record<string, string> = {
  Languages: "bg-sky-50 text-sky-800 border-sky-200",
  STEM: "bg-slate-100 text-slate-700 border-slate-200",
  Humanities: "bg-amber-50 text-amber-800 border-amber-200",
  Activity: "bg-rose-50 text-rose-800 border-rose-200",
};

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("All");
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [department, setDepartment] = useState("");
  const [gradesLabel, setGradesLabel] = useState("");
  const [periods, setPeriods] = useState("");
  const [isOptional, setIsOptional] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (schoolType === "k12") {
        const rows = await api<K12Subject[]>("/api/k12/subjects", { token: token ?? undefined });
        setK12Subjects(rows);
        setCourses([]);
      } else {
        const rows = await api<ProgramCourse[]>("/api/courses?limit=200", { token: token ?? undefined }).catch(
          () => [] as ProgramCourse[]
        );
        setCourses(rows);
        setK12Subjects([]);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (schoolType === "k12") {
      return k12Subjects.filter((s) => {
        if (deptFilter !== "All" && (s.department || "") !== deptFilter) return false;
        if (!q) return true;
        return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
      });
    }
    return courses.filter((c) => {
      if (!q) return true;
        return c.course_name.toLowerCase().includes(q) || (c.department || "").toLowerCase().includes(q);
    });
  }, [k12Subjects, courses, search, deptFilter, schoolType]);

  const stats = useMemo(() => {
    if (schoolType !== "k12") return { total: courses.length, optional: 0 };
    return {
      total: k12Subjects.length,
      optional: k12Subjects.filter((s) => s.is_optional).length,
    };
  }, [k12Subjects, courses, schoolType]);

  async function createSubject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (schoolType === "k12") {
        const created = await api<K12Subject>("/api/k12/subjects", {
          token: token ?? undefined,
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            code: code.trim().toUpperCase(),
            is_optional: isOptional,
            department: department || undefined,
            grades_label: gradesLabel || undefined,
            periods_per_week: periods ? parseInt(periods, 10) : undefined,
          }),
        });
        setK12Subjects((prev) => [...prev, created]);
      } else {
        await api("/api/courses", {
          token: token ?? undefined,
          method: "POST",
          body: JSON.stringify({
            course_name: name.trim(),
            department: department || undefined,
            description: code.trim() ? `Code: ${code.trim()}` : undefined,
          }),
        });
        await load();
      }
      snackbar.success("Subject added.");
      setModal(false);
      setName("");
      setCode("");
      setDepartment("");
      setGradesLabel("");
      setPeriods("");
      setIsOptional(false);
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  const meta = TAB_META.subjects;

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        actions={
          <button type="button" onClick={() => setModal(true)} className={btnPrimary}>
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
        {schoolType === "k12" &&
          DEPT_FILTERS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDeptFilter(d)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                deptFilter === d
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]"
              }`}
            >
              {d}
            </button>
          ))}
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
          <p className="p-6 text-sm text-[var(--muted)]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-[var(--muted)]">No subjects yet. Add your first subject.</p>
        ) : schoolType === "k12" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-light)] border-b border-[var(--border)] bg-neutral-50/80">
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Grades</th>
                  <th className="px-4 py-3">Periods/wk</th>
                  <th className="px-4 py-3">Type</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--border)] last:border-0 hover:bg-neutral-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-[var(--primary-light)] flex items-center justify-center text-[10px] font-bold">
                          {s.code.slice(0, 3)}
                        </span>
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-[10px] text-[var(--muted)]">{s.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                    <td className="px-4 py-3">
                      {s.department ? (
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            DEPT_COLORS[s.department] || "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {s.department}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{s.grades_label || "—"}</td>
                    <td className="px-4 py-3">{s.periods_per_week ?? "—"}</td>
                    <td className="px-4 py-3">
                      {s.is_optional ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          Optional
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--muted)]">Core</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                {filtered.map((c) => (
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

      <Modal open={modal} onClose={() => !saving && setModal(false)} title="New subject" size="md">
        <form onSubmit={createSubject} className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Code</label>
            <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} placeholder="ENG" />
          </div>
          {schoolType === "k12" && (
            <>
              <SelectField
                label="Department"
                options={DEPT_FILTERS.filter((d) => d !== "All").map((d) => ({ value: d, label: d }))}
                value={department}
                onChange={setDepartment}
                placeholder="Optional"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Grades</label>
                  <input
                    type="text"
                    value={gradesLabel}
                    onChange={(e) => setGradesLabel(e.target.value)}
                    className={inputClass}
                    placeholder="KG–10"
                  />
                </div>
                <div>
                  <label className={labelClass}>Periods / week</label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={periods}
                    onChange={(e) => setPeriods(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isOptional} onChange={(e) => setIsOptional(e.target.checked)} />
                Optional subject
              </label>
            </>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setModal(false)} className={btnSecondary} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
