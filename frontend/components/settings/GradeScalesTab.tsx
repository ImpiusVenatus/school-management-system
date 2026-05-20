"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { api } from "@/lib/api";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass } from "@/lib/ui";

type Interval = {
  grade_code: string;
  threshold: number;
  grade_description?: string | null;
  gpa_points?: number | null;
};

type Scale = {
  id: string;
  grading_scale_name: string;
  description?: string | null;
  is_default: boolean;
  intervals: Interval[];
};

const GRADE_COLORS = ["#991b1b", "#dc2626", "#ea580c", "#ca8a04", "#65a30d", "#16a34a", "#15803d"];

const DEFAULT_INTERVALS: Interval[] = [
  { grade_code: "A+", threshold: 91, grade_description: "Outstanding", gpa_points: 4 },
  { grade_code: "A", threshold: 81, grade_description: "Excellent", gpa_points: 3.7 },
  { grade_code: "B+", threshold: 71, grade_description: "Very good", gpa_points: 3.3 },
  { grade_code: "B", threshold: 61, grade_description: "Good", gpa_points: 3 },
  { grade_code: "C", threshold: 51, grade_description: "Average", gpa_points: 2.5 },
  { grade_code: "D", threshold: 41, grade_description: "Below average", gpa_points: 2 },
  { grade_code: "F", threshold: 0, grade_description: "Fail", gpa_points: 0 },
];

export function GradeScalesTab({ token }: { token?: string | null }) {
  const snackbar = useSnackbar();
  const [scales, setScales] = useState<Scale[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [intervals, setIntervals] = useState<Interval[]>(DEFAULT_INTERVALS);
  const [isDefault, setIsDefault] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api<Scale[]>("/api/assessment/grading-scales", { token: token ?? undefined });
      setScales(rows);
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

  const sortedIntervals = useMemo(() => {
    if (!selected) return [];
    return [...selected.intervals].sort((a, b) => b.threshold - a.threshold);
  }, [selected]);

  async function createScale(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await api<Scale>("/api/assessment/grading-scales", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          grading_scale_name: name.trim(),
          intervals,
          is_default: isDefault,
        }),
      });
      setScales((prev) => [...prev, created]);
      setSelectedId(created.id);
      setModal(false);
      snackbar.success("Grade scale created.");
      if (isDefault) load();
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveSelected() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api<Scale>(`/api/assessment/grading-scales/${selected.id}`, {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({ intervals: sortedIntervals }),
      });
      setScales((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      snackbar.success("Grade scale saved.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function updateInterval(idx: number, field: keyof Interval, value: string) {
    if (!selected) return;
    const next = [...sortedIntervals];
    const row = { ...next[idx] };
    if (field === "threshold" || field === "gpa_points") {
      row[field] = value === "" ? 0 : parseFloat(value);
    } else {
      row[field] = value;
    }
    next[idx] = row;
    setScales((prev) =>
      prev.map((s) => (s.id === selected.id ? { ...s, intervals: next } : s))
    );
  }

  const meta = TAB_META["grade-scales"];

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle="Maps mark % to letter grades and GPA. Each class can use a scale (default applies when none set)."
        actions={
          <button type="button" onClick={() => { setName(""); setIntervals(DEFAULT_INTERVALS); setModal(true); }} className={btnPrimary}>
            + New scale
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : scales.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)] mb-4">No grade scales yet.</p>
          <button type="button" onClick={() => setModal(true)} className={btnPrimary}>
            Create default scale
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-6">
          <Card className="p-0 overflow-hidden">
            <p className="px-4 py-3 text-xs font-semibold text-[var(--muted)] border-b">Scales ({scales.length})</p>
            <ul className="divide-y divide-[var(--border)]">
              {scales.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full text-left px-4 py-3 ${selectedId === s.id ? "bg-[var(--primary-light)]" : "hover:bg-neutral-50"}`}
                  >
                    <p className="font-medium text-sm">{s.grading_scale_name}</p>
                    {s.is_default && (
                      <span className="text-[10px] font-semibold text-emerald-700">default</span>
                    )}
                    <p className="text-[11px] text-[var(--muted)]">{s.intervals.length} ranges</p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {selected && (
            <div className="space-y-4">
              <Card>
                <div className="flex flex-wrap justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{selected.grading_scale_name}</h3>
                    <p className="text-sm text-[var(--muted)]">
                      {sortedIntervals.length} ranges · GPA {Math.min(...sortedIntervals.map((i) => i.gpa_points ?? 0))}–
                      {Math.max(...sortedIntervals.map((i) => i.gpa_points ?? 0))}
                    </p>
                  </div>
                  <button type="button" onClick={saveSelected} disabled={saving} className={btnPrimary}>
                    {saving ? "Saving…" : "Save ranges"}
                  </button>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden mb-4 gap-0.5">
                  {sortedIntervals.map((inv, i) => (
                    <div
                      key={inv.grade_code}
                      className="flex-1 min-w-[8px]"
                      style={{ backgroundColor: GRADE_COLORS[i % GRADE_COLORS.length] }}
                      title={inv.grade_code}
                    />
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase text-[var(--muted)] border-b">
                        <th className="text-left py-2 pr-2">Grade</th>
                        <th className="text-left py-2 pr-2">GPA</th>
                        <th className="text-left py-2 pr-2">Min %</th>
                        <th className="text-left py-2">Label</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedIntervals.map((inv, idx) => {
                        const prev = sortedIntervals[idx - 1];
                        const minPct = prev ? prev.threshold + 1 : 0;
                        return (
                          <tr key={inv.grade_code} className="border-b border-[var(--border)]">
                            <td className="py-2 pr-2 font-semibold">{inv.grade_code}</td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                step="0.1"
                                value={inv.gpa_points ?? ""}
                                onChange={(e) => updateInterval(idx, "gpa_points", e.target.value)}
                                className={`${inputClass} w-20 py-1`}
                              />
                            </td>
                            <td className="py-2 pr-2 text-[var(--muted)]">{minPct}</td>
                            <td className="py-2">
                              <div className="flex gap-2 items-center">
                                <input
                                  type="number"
                                  value={inv.threshold}
                                  onChange={(e) => updateInterval(idx, "threshold", e.target.value)}
                                  className={`${inputClass} w-16 py-1`}
                                />
                                <input
                                  type="text"
                                  value={inv.grade_description ?? ""}
                                  onChange={(e) => updateInterval(idx, "grade_description", e.target.value)}
                                  className={`${inputClass} flex-1 py-1`}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card className="border-dashed">
                <p className="text-sm text-[var(--muted)]">Class assignment and calculation rules — coming in the next pass.</p>
              </Card>
            </div>
          )}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="New grade scale" size="md">
        <form onSubmit={createScale} className="space-y-4">
          <input
            type="text"
            required
            placeholder="Scale name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Set as school default
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setModal(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>{saving ? "Creating…" : "Create"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
