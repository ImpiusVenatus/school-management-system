"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { api } from "@/lib/api";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/ui";

type Interval = {
  row_id: string;
  grade_code: string;
  threshold: number;
  max_percent?: number | null;
  grade_description?: string | null;
  gpa_points?: number | null;
  color?: string | null;
};

function newRowId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function withRowIds(intervals: Interval[]): Interval[] {
  return intervals.map((inv) => ({
    ...inv,
    row_id: inv.row_id || newRowId(),
  }));
}

function normalizeScale(scale: Scale): Scale {
  return { ...scale, intervals: withRowIds(scale.intervals) };
}

function mergeRowIds(previous: Interval[], fromApi: Interval[]): Interval[] {
  return withRowIds(
    fromApi.map((inv, i) => ({
      ...inv,
      row_id: previous[i]?.row_id ?? inv.row_id ?? newRowId(),
    }))
  );
}

function intervalsForApi(intervals: Interval[]) {
  return sortDesc(intervals).map(({ row_id: _id, max_percent: _max, ...rest }) => rest);
}

type CalculationRules = {
  round_half_up: boolean;
  apply_per_subject: boolean;
  pass_each_subject: boolean;
  show_gpa_report: boolean;
  show_rank_section: boolean;
  show_rank_class: boolean;
};

type AssignedClass = {
  id: string;
  name: string;
  academic_year_id: string;
  uses_default: boolean;
};

type Scale = {
  id: string;
  grading_scale_name: string;
  description?: string | null;
  is_default: boolean;
  intervals: Interval[];
  calculation_rules: CalculationRules;
  range_count: number;
  gpa_min: number | null;
  gpa_max: number | null;
  class_count: number;
  used_by_label: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
  assigned_classes: AssignedClass[];
  intervals_valid: boolean;
  intervals_validation_message: string | null;
};

type AvailableClass = {
  id: string;
  name: string;
  academic_year_id: string;
  grading_scale_id: string | null;
};

const DEFAULT_RULES: CalculationRules = {
  round_half_up: true,
  apply_per_subject: true,
  pass_each_subject: false,
  show_gpa_report: true,
  show_rank_section: true,
  show_rank_class: false,
};

const DEFAULT_INTERVALS: Interval[] = withRowIds([
  { row_id: "", grade_code: "A+", threshold: 91, grade_description: "Outstanding", gpa_points: 4, color: "#15803d" },
  { row_id: "", grade_code: "A", threshold: 81, grade_description: "Excellent", gpa_points: 3.7, color: "#16a34a" },
  { row_id: "", grade_code: "B+", threshold: 71, grade_description: "Very good", gpa_points: 3.3, color: "#65a30d" },
  { row_id: "", grade_code: "B", threshold: 61, grade_description: "Good", gpa_points: 3, color: "#ca8a04" },
  { row_id: "", grade_code: "C", threshold: 51, grade_description: "Average", gpa_points: 2.5, color: "#ea580c" },
  { row_id: "", grade_code: "D", threshold: 41, grade_description: "Below average", gpa_points: 2, color: "#dc2626" },
  { row_id: "", grade_code: "F", threshold: 0, grade_description: "Fail", gpa_points: 0, color: "#991b1b" },
]);

function formatEdited(scale: Scale): string {
  if (!scale.updated_at) return "";
  const d = new Date(scale.updated_at);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const by = scale.updated_by_name ? ` · ${scale.updated_by_name}` : "";
  return `edited ${date}${by}`;
}

function snapshotScale(s: Scale): string {
  return JSON.stringify({
    intervals: s.intervals.map(
      ({ row_id, grade_code, threshold, grade_description, gpa_points, color }) => ({
        row_id,
        grade_code,
        threshold,
        grade_description,
        gpa_points,
        color,
      })
    ),
    calculation_rules: s.calculation_rules,
  });
}

function baselinesFromScales(rows: Scale[]): Record<string, string> {
  return Object.fromEntries(rows.map((s) => [s.id, snapshotScale(s)]));
}

/** Sort only when persisting to the API (not while editing). */
function sortDesc(intervals: Interval[]): Interval[] {
  return [...intervals].sort((a, b) => b.threshold - a.threshold);
}

/** Keep row order stable while editing; assumes rows are highest grade first. */
function withMaxInOrder(intervals: Interval[]): Interval[] {
  return intervals.map((row, i) => {
    let max_percent = 100;
    if (i > 0) {
      max_percent = intervals[i - 1].threshold - 1;
      if (max_percent < row.threshold) max_percent = row.threshold;
    }
    return { ...row, max_percent };
  });
}

function rangeSpanPercent(inv: Interval): number {
  const min = Math.max(0, Math.min(100, inv.threshold));
  const max = Math.max(min, Math.min(100, inv.max_percent ?? min));
  const span = max - min + 1;
  return (span / 101) * 100;
}

export function GradeScalesTab({ token }: { token?: string | null }) {
  const snackbar = useSnackbar();
  const [scales, setScales] = useState<Scale[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newModal, setNewModal] = useState(false);
  const [renameModal, setRenameModal] = useState(false);
  const [reassignModal, setReassignModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [availableClasses, setAvailableClasses] = useState<AvailableClass[]>([]);
  const [pickedClassIds, setPickedClassIds] = useState<Set<string>>(new Set());
  const [baselines, setBaselines] = useState<Record<string, string>>({});
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api<Scale[]>("/api/assessment/grading-scales", { token: token ?? undefined });
      const normalized = rows.map(normalizeScale);
      setScales(normalized);
      setBaselines(baselinesFromScales(normalized));
      setSelectedId((prev) => (prev && rows.some((s) => s.id === prev) ? prev : rows[0]?.id ?? null));
    } catch {
      snackbar.error("Could not load grade scales");
    } finally {
      setLoading(false);
    }
  }, [token, snackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = scales.find((s) => s.id === selectedId) ?? null;
  const displayIntervals = useMemo(
    () => (selected ? withMaxInOrder(selected.intervals) : []),
    [selected]
  );

  const barSegments = useMemo(() => {
    if (!displayIntervals.length) return [];
    return displayIntervals.map((inv) => ({
      row_id: inv.row_id,
      widthPercent: rangeSpanPercent(inv),
      color: inv.color || "#94a3b8",
      title: inv.grade_code || "—",
    }));
  }, [displayIntervals]);

  const isDirty = useMemo(() => {
    if (!selected) return false;
    const baseline = baselines[selected.id];
    if (!baseline) return false;
    return baseline !== snapshotScale(selected);
  }, [selected, baselines]);

  const patchScale = useCallback(
    async (scaleId: string, body: Record<string, unknown>) => {
      setSaving(true);
      try {
        const updated = await api<Scale>(`/api/assessment/grading-scales/${scaleId}`, {
          token: token ?? undefined,
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setScales((prev) => {
          const prior = prev.find((s) => s.id === scaleId);
          if (!prior) return prev;
          const merged = normalizeScale({
            ...updated,
            intervals: mergeRowIds(prior.intervals, withRowIds(updated.intervals as Interval[])),
          });
          setBaselines((b) => ({ ...b, [merged.id]: snapshotScale(merged) }));
          return prev.map((s) => (s.id === merged.id ? merged : s));
        });
        snackbar.success("Grade scale saved.");
        return updated;
      } catch (err) {
        snackbar.error(err instanceof Error ? err.message : "Failed to save");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [token, snackbar]
  );

  function selectScale(id: string) {
    if (selected && isDirty && id !== selected.id) {
      const discard = window.confirm("Discard unsaved changes to this scale?");
      if (!discard) return;
      const baseline = baselines[selected.id];
      if (baseline) {
        const parsed = JSON.parse(baseline) as { intervals: Interval[]; calculation_rules: CalculationRules };
        setScales((prev) =>
          prev.map((s) =>
            s.id === selected.id
              ? {
                  ...s,
                  intervals: withRowIds(parsed.intervals),
                  calculation_rules: parsed.calculation_rules,
                }
              : s
          )
        );
      }
    }
    setSelectedId(id);
  }

  function updateLocalIntervals(updater: (prev: Interval[]) => Interval[]) {
    if (!selected) return;
    const next = updater(selected.intervals);
    setScales((prev) => prev.map((s) => (s.id === selected.id ? { ...s, intervals: next } : s)));
  }

  function discardChanges() {
    if (!selected) return;
    const baseline = baselines[selected.id];
    if (!baseline) return;
    const parsed = JSON.parse(baseline) as { intervals: Interval[]; calculation_rules: CalculationRules };
    setScales((prev) =>
      prev.map((s) =>
        s.id === selected.id
          ? { ...s, intervals: withRowIds(parsed.intervals), calculation_rules: parsed.calculation_rules }
          : s
      )
    );
  }

  async function saveChanges() {
    if (!selected || !isDirty) return;
    await patchScale(selected.id, {
      intervals: intervalsForApi(selected.intervals),
      calculation_rules: selected.calculation_rules,
    });
  }

  function updateInterval(idx: number, field: keyof Interval, value: string) {
    const next = displayIntervals.map((r, i) => {
      if (i !== idx) return { ...r };
      const copy = { ...r };
      if (field === "threshold") {
        copy.threshold = value === "" ? 0 : parseFloat(value);
      } else if (field === "gpa_points") {
        copy.gpa_points = value === "" ? 0 : parseFloat(value);
      } else if (field === "grade_code" || field === "grade_description") {
        copy[field] = value;
      } else if (field === "color") {
        copy.color = value;
      }
      return copy;
    });
    updateLocalIntervals(() => next);
  }

  function updateMaxPercent(idx: number, value: string) {
    if (idx === 0) return;
    const maxVal = value === "" ? 0 : parseFloat(value);
    const next = displayIntervals.map((r, i) =>
      i === idx - 1 ? { ...r, threshold: maxVal + 1 } : { ...r }
    );
    updateLocalIntervals(() => next);
  }

  function addRange() {
    updateLocalIntervals((prev) => [
      ...prev,
      {
        row_id: newRowId(),
        grade_code: "",
        threshold: 0,
        grade_description: "",
        gpa_points: 0,
        color: "#94a3b8",
      },
    ]);
  }

  function requestRemoveRange(idx: number) {
    if (displayIntervals.length <= 1) {
      snackbar.error("At least one range is required.");
      return;
    }
    setPendingDeleteIdx(idx);
  }

  function confirmRemoveRange() {
    if (pendingDeleteIdx === null) return;
    updateLocalIntervals(() => displayIntervals.filter((_, i) => i !== pendingDeleteIdx));
    setPendingDeleteIdx(null);
  }

  const pendingDeleteGrade =
    pendingDeleteIdx !== null ? displayIntervals[pendingDeleteIdx]?.grade_code?.trim() : "";

  async function createScale(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await api<Scale>("/api/assessment/grading-scales", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          grading_scale_name: newName.trim(),
          intervals: DEFAULT_INTERVALS,
          is_default: scales.length === 0,
          calculation_rules: DEFAULT_RULES,
        }),
      });
      const normalized = normalizeScale(created);
      setScales((prev) => [...prev, normalized]);
      setBaselines((prev) => ({ ...prev, [normalized.id]: snapshotScale(normalized) }));
      setSelectedId(normalized.id);
      setNewModal(false);
      snackbar.success("Grade scale created.");
      if (normalized.is_default) load();
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateScale() {
    if (!selected) return;
    setSaving(true);
    try {
      const dup = await api<Scale>(`/api/assessment/grading-scales/${selected.id}/duplicate`, {
        token: token ?? undefined,
        method: "POST",
      });
      const normalized = normalizeScale(dup);
      setScales((prev) => [...prev, normalized]);
      setBaselines((prev) => ({ ...prev, [normalized.id]: snapshotScale(normalized) }));
      setSelectedId(normalized.id);
      snackbar.success("Scale duplicated.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitRename(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const ok = await patchScale(selected.id, { grading_scale_name: renameName.trim() });
    if (ok) setRenameModal(false);
  }

  function toggleRule(key: keyof CalculationRules) {
    if (!selected) return;
    const next = { ...selected.calculation_rules, [key]: !selected.calculation_rules[key] };
    setScales((prev) =>
      prev.map((s) => (s.id === selected.id ? { ...s, calculation_rules: next } : s))
    );
  }

  async function openReassign() {
    if (!selected) return;
    try {
      const rows = await api<AvailableClass[]>("/api/assessment/grading-scales/classes/available", {
        token: token ?? undefined,
      });
      setAvailableClasses(rows);
      const assigned = new Set(selected.assigned_classes.map((c) => c.id));
      setPickedClassIds(assigned);
      setReassignModal(true);
    } catch {
      snackbar.error("Could not load classes");
    }
  }

  async function submitReassign() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api<Scale>(`/api/assessment/grading-scales/${selected.id}/classes`, {
        token: token ?? undefined,
        method: "PUT",
        body: JSON.stringify({ class_ids: Array.from(pickedClassIds) }),
      });
      const normalized = normalizeScale(updated);
      setScales((prev) => prev.map((s) => (s.id === normalized.id ? normalized : s)));
      setBaselines((prev) => ({ ...prev, [normalized.id]: snapshotScale(normalized) }));
      setReassignModal(false);
      snackbar.success("Class assignments updated.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to assign classes");
    } finally {
      setSaving(false);
    }
  }

  function exportScale() {
    if (!selected) return;
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.grading_scale_name.replace(/\s+/g, "-")}-grade-scale.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const meta = TAB_META["grade-scales"];

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle="A grade scale maps marks % to a letter grade and GPA. Each class uses one scale, falling back to the default."
        actions={
          <>
            <button type="button" onClick={exportScale} disabled={!selected} className={btnSecondary}>
              Export
            </button>
            <button
              type="button"
              onClick={() => {
                setNewName("");
                setNewModal(true);
              }}
              className={btnPrimary}
            >
              + New scale
            </button>
          </>
        }
      />

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : scales.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)] mb-4">No grade scales yet. Create your first scale to map percentages to letter grades.</p>
          <button type="button" onClick={() => setNewModal(true)} className={btnPrimary}>
            + New scale
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
          <Card className="p-0 overflow-hidden h-fit border border-[var(--border)] shadow-sm">
            <div className="px-4 pt-2 pb-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                Scales{" "}
                <span className="font-normal text-[var(--muted-light)] tabular-nums">{scales.length}</span>
              </span>
            </div>
            <div className="border-b border-[var(--border)]" role="presentation" />
            <ul className="pt-1">
              {scales.map((s) => {
                const active = s.id === selectedId;
                return (
                  <li key={s.id} className="border-b border-[var(--border)] last:border-0">
                    <button
                      type="button"
                      onClick={() => selectScale(s.id)}
                      className={`cursor-pointer w-full text-left py-3.5 pr-4 pl-3 transition-colors border-l-4 ${
                        active
                          ? "bg-[#f7f4ef] border-l-neutral-900"
                          : "border-l-transparent hover:bg-neutral-50/90"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-[var(--foreground)] leading-snug">
                          {s.grading_scale_name}
                        </p>
                        {s.is_default && (
                          <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full border border-[var(--border)] bg-white text-[var(--muted)]">
                            default
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-[var(--muted)] mt-2">
                        Used by: {s.used_by_label || "—"}
                      </p>
                      {formatEdited(s) && (
                        <p className="text-[11px] font-mono text-[var(--muted-light)] mt-0.5">{formatEdited(s)}</p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {selected && (
            <div className="space-y-4 min-w-0">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{selected.grading_scale_name}</h3>
                    <p className="text-sm text-[var(--muted)]">
                      {selected.range_count} ranges · GPA range {selected.gpa_min ?? 0}–{selected.gpa_max ?? 0} · used by{" "}
                      {selected.class_count} {selected.class_count === 1 ? "class" : "classes"}
                      {isDirty && !saving && (
                        <span className="ml-2 text-amber-700 font-medium">Unsaved changes</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isDirty && (
                      <>
                        <button type="button" onClick={discardChanges} disabled={saving} className={btnSecondary}>
                          Discard
                        </button>
                        <button type="button" onClick={saveChanges} disabled={saving} className={btnPrimary}>
                          {saving ? "Saving…" : "Save changes"}
                        </button>
                      </>
                    )}
                    <button type="button" onClick={duplicateScale} disabled={saving || isDirty} className={btnSecondary}>
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenameName(selected.grading_scale_name);
                        setRenameModal(true);
                      }}
                      disabled={isDirty}
                      className={btnSecondary}
                    >
                      Rename
                    </button>
                  </div>
                </div>

                <div className="flex h-4 w-full rounded-full overflow-hidden mb-5 gap-px bg-neutral-100">
                  {barSegments.map((seg) => (
                    <div
                      key={seg.row_id}
                      className="h-full shrink-0 min-w-[2px] transition-[width] duration-150"
                      style={{
                        width: `${seg.widthPercent}%`,
                        backgroundColor: seg.color,
                      }}
                      title={seg.title}
                    />
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
                        <th className="text-left py-2 pr-2 font-semibold">Grade</th>
                        <th className="text-left py-2 pr-2 font-semibold">GPA</th>
                        <th className="text-left py-2 pr-2 font-semibold">Min %</th>
                        <th className="text-left py-2 pr-2 font-semibold">Max %</th>
                        <th className="text-left py-2 pr-2 font-semibold">Label</th>
                        <th className="text-left py-2 pr-2 font-semibold">Color</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {displayIntervals.map((inv, idx) => (
                        <tr key={inv.row_id} className="border-b border-[var(--border)] last:border-0">
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={inv.grade_code}
                              onChange={(e) => updateInterval(idx, "grade_code", e.target.value)}
                              className={`${inputClass} w-16 py-1 font-semibold text-center`}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              step="0.01"
                              value={inv.gpa_points ?? ""}
                              onChange={(e) => updateInterval(idx, "gpa_points", e.target.value)}
                              className={`${inputClass} w-20 py-1`}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              value={inv.threshold}
                              onChange={(e) => updateInterval(idx, "threshold", e.target.value)}
                              className={`${inputClass} w-16 py-1`}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              value={inv.max_percent ?? 100}
                              disabled={idx === 0}
                              onChange={(e) => updateMaxPercent(idx, e.target.value)}
                              className={`${inputClass} w-16 py-1 disabled:opacity-60`}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={inv.grade_description ?? ""}
                              onChange={(e) => updateInterval(idx, "grade_description", e.target.value)}
                              className={`${inputClass} min-w-[120px] py-1`}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="color"
                              value={inv.color || "#94a3b8"}
                              onChange={(e) => updateInterval(idx, "color", e.target.value)}
                              className="w-10 h-9 rounded-lg border border-[var(--border)] cursor-pointer p-0.5"
                            />
                          </td>
                          <td className="py-2">
                            <button
                              type="button"
                              onClick={() => requestRemoveRange(idx)}
                              disabled={displayIntervals.length <= 1}
                              className="cursor-pointer p-1.5 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              aria-label={`Remove grade ${inv.grade_code || "range"}`}
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth={1.75}
                                aria-hidden
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-[var(--border)]">
                  <button type="button" onClick={addRange} className={`${btnSecondary} text-xs`}>
                    + Add range
                  </button>
                  <p
                    className={`text-xs ${selected.intervals_valid ? "text-[var(--muted)]" : "text-amber-700"}`}
                  >
                    {selected.intervals_valid
                      ? "Ranges must cover 0–100% with no gaps."
                      : selected.intervals_validation_message || "Fix range gaps before saving."}
                  </p>
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h4 className="text-sm font-semibold">
                      Assigned classes <span className="text-[var(--muted)] font-normal">{selected.class_count}</span>
                    </h4>
                    <button type="button" onClick={openReassign} className={`${btnSecondary} text-xs py-1.5 px-3`}>
                      Reassign…
                    </button>
                  </div>
                  {selected.assigned_classes.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No classes assigned yet.</p>
                  ) : (
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                      {selected.assigned_classes.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-neutral-50"
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-[10px] text-[var(--muted)]">
                            {selected.is_default && c.uses_default
                              ? "default"
                              : "overrides default"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card>
                  <h4 className="text-sm font-semibold mb-0.5">Calculation rules</h4>
                  <p className="text-xs text-[var(--muted)] mb-4">How the % rolls up</p>
                  <ul className="space-y-3">
                    {(
                      [
                        {
                          key: "round_half_up" as const,
                          label: "Round half up",
                          hint: "74.5 rounds to 75",
                        },
                        {
                          key: "apply_per_subject" as const,
                          label: "Apply per subject",
                          hint: "Each subject gets its own grade. Otherwise only on the overall %.",
                        },
                        {
                          key: "pass_each_subject" as const,
                          label: "Pass each subject",
                          hint: "A failing subject fails the term, even if overall passing.",
                        },
                        {
                          key: "show_gpa_report" as const,
                          label: "Show GPA in report cards",
                          hint: "",
                        },
                        {
                          key: "show_rank_section" as const,
                          label: "Show rank in section",
                          hint: "",
                        },
                        {
                          key: "show_rank_class" as const,
                          label: "Show rank in class (across sections)",
                          hint: "",
                        },
                      ] as const
                    ).map((rule) => (
                      <li key={rule.key} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{rule.label}</p>
                          {rule.hint && <p className="text-xs text-[var(--muted)]">{rule.hint}</p>}
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={selected.calculation_rules[rule.key]}
                          onClick={() => toggleRule(rule.key)}
                          className={`cursor-pointer shrink-0 w-10 h-5 rounded-full relative transition-colors ${
                            selected.calculation_rules[rule.key] ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                              selected.calculation_rules[rule.key] ? "left-5" : "left-0.5"
                            }`}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={newModal} onClose={() => !saving && setNewModal(false)} title="New grade scale" size="md">
        <form onSubmit={createScale} className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Default GPA - 10-point"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputClass}
            />
          </div>
          <p className="text-xs text-[var(--muted)]">Starts with a standard A+–F scale. You can edit ranges after creating.</p>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setNewModal(false)} className={btnSecondary} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={renameModal} onClose={() => setRenameModal(false)} title="Rename grade scale" size="md">
        <form onSubmit={submitRename} className="space-y-4">
          <input
            type="text"
            required
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            className={inputClass}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setRenameModal(false)} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={reassignModal} onClose={() => setReassignModal(false)} title="Assign classes" size="md">
        <p className="text-sm text-[var(--muted)] mb-4">
          {selected?.is_default
            ? "Selected classes use this default scale (no override)."
            : "Selected classes use this scale instead of the school default."}
        </p>
        <ul className="max-h-64 overflow-y-auto space-y-2 mb-4 border border-[var(--border)] rounded-xl p-3">
          {availableClasses.map((c) => (
            <li key={c.id}>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={pickedClassIds.has(c.id)}
                  onChange={(e) => {
                    setPickedClassIds((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(c.id);
                      else next.delete(c.id);
                      return next;
                    });
                  }}
                />
                {c.name}
              </label>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setReassignModal(false)} className={btnSecondary}>
            Cancel
          </button>
          <button type="button" onClick={submitReassign} disabled={saving} className={btnPrimary}>
            {saving ? "Saving…" : "Apply"}
          </button>
        </div>
      </Modal>

      <ConfirmModal
        open={pendingDeleteIdx !== null}
        onClose={() => setPendingDeleteIdx(null)}
        onConfirm={confirmRemoveRange}
        title="Remove grade range?"
        confirmLabel="Remove grade"
        cancelLabel="Keep grade"
        variant="warning"
      >
        <p>
          {pendingDeleteGrade ? (
            <>
              You are about to remove grade <strong>{pendingDeleteGrade}</strong> from{" "}
              <strong>{selected?.grading_scale_name}</strong>.
            </>
          ) : (
            <>You are about to remove this grade range from <strong>{selected?.grading_scale_name}</strong>.</>
          )}
        </p>
        <p className="mt-3">
          Changing grade boundaries can affect how percentages map to letter grades and GPA on report cards. Existing
          assessment results that used this scale may no longer match the updated ranges until you save and review
          marks.
        </p>
      </ConfirmModal>
    </>
  );
}
