"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { api } from "@/lib/api";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass } from "@/lib/ui";

export type AcademicYearRow = {
  id: string;
  academic_year_name: string;
  year_start_date: string;
  year_end_date: string;
  status: string;
  is_active: boolean;
  class_count: number;
  section_count: number;
  student_count: number;
};

type YearDetail = AcademicYearRow & {
  days_total: number;
  days_elapsed: number;
  days_remaining: number;
  progress_percent: number;
  term_count: number;
};

function StatusPill({ status, isActive }: { status: string; isActive: boolean }) {
  if (isActive || status === "active") {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
        Active
      </span>
    );
  }
  if (status === "archived") {
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">Archived</span>;
  }
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
      Closed
    </span>
  );
}

function fmtShort(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

export function AcademicYearsTab({
  token,
  startMonth,
  onActiveYearChange,
}: {
  token?: string | null;
  startMonth: number;
  onActiveYearChange: () => void;
}) {
  const snackbar = useSnackbar();
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<YearDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [setActive, setSetActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api<AcademicYearRow[]>("/api/academic/years", { token: token ?? undefined });
      setYears(rows);
      if (rows.length === 0) {
        setShowModal(true);
        setSelectedId(null);
      } else {
        setSelectedId((prev) => {
          if (prev && rows.some((y) => y.id === prev)) return prev;
          return rows.find((y) => y.is_active)?.id ?? rows[0].id;
        });
      }
    } catch {
      snackbar.error("Could not load academic years");
    } finally {
      setLoading(false);
    }
  }, [token, snackbar]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    api<YearDetail>(`/api/academic/years/${selectedId}/detail`, { token: token ?? undefined })
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId, token, years]);

  async function activate(id: string) {
    try {
      await api(`/api/academic/years/${id}/activate`, { token: token ?? undefined, method: "POST" });
      snackbar.success("Active academic year updated.");
      onActiveYearChange();
      load();
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to activate");
    }
  }

  async function createYear(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await api<{ id: string }>("/api/academic/years", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          academic_year_name: name.trim() || undefined,
          year_start_date: start || undefined,
          year_end_date: end || undefined,
          set_active: setActive,
        }),
      });
      snackbar.success("Academic year created.");
      setShowModal(false);
      setName("");
      setStart("");
      setEnd("");
      onActiveYearChange();
      await load();
      if (created?.id) setSelectedId(created.id);
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  function suggestName() {
    const now = new Date();
    const y = now.getFullYear();
    const sm = startMonth;
    if (sm === 1) setName(`AY ${y}`);
    else if (now.getMonth() + 1 >= sm) setName(`AY ${y}–${String(y + 1).slice(-2)}`);
    else setName(`AY ${y - 1}–${String(y).slice(-2)}`);
  }

  const meta = TAB_META.years;

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        actions={
          <button type="button" onClick={() => { suggestName(); setShowModal(true); }} className={btnPrimary}>
            + New academic year
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : years.length === 0 ? (
        <Card>
          <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
            <p className="text-[var(--muted)] mb-4">No academic years yet. Create one to start using the system.</p>
            <button type="button" onClick={() => { suggestName(); setShowModal(true); }} className={btnPrimary}>
              Create first academic year
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(240px,280px)_1fr] gap-6">
          <Card className="p-0 overflow-hidden">
            <p className="px-4 py-3 text-xs font-semibold text-[var(--muted)] border-b border-[var(--border)]">
              All years ({years.length})
            </p>
            <ul className="divide-y divide-[var(--border)] max-h-[480px] overflow-y-auto">
              {years.map((y) => {
                const selected = y.id === selectedId;
                return (
                  <li key={y.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(y.id)}
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        selected ? "bg-[var(--primary-light)]" : "hover:bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{y.academic_year_name}</span>
                        <StatusPill status={y.status} isActive={y.is_active} />
                      </div>
                      <p className="text-[11px] text-[var(--muted)] mt-1">
                        {fmtShort(y.year_start_date)} – {fmtShort(y.year_end_date)}
                      </p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {y.class_count} classes · {y.student_count} students
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="space-y-4 min-w-0">
            {detailLoading || !detail ? (
              <Card>
                <p className="text-sm text-[var(--muted)]">{detailLoading ? "Loading year…" : "Select a year"}</p>
              </Card>
            ) : (
              <>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        {detail.academic_year_name}
                        {detail.is_active && (
                          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            active
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-[var(--muted)] mt-1">
                        {new Date(detail.year_start_date).toLocaleDateString()} –{" "}
                        {new Date(detail.year_end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!detail.is_active && (
                        <button type="button" onClick={() => activate(detail.id)} className={btnPrimary}>
                          Set active
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-[var(--border)] p-3">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Start</p>
                      <p className="text-sm font-semibold mt-1">{fmtShort(detail.year_start_date)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] p-3">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">End</p>
                      <p className="text-sm font-semibold mt-1">{fmtShort(detail.year_end_date)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] p-3">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Classes</p>
                      <p className="text-sm font-semibold mt-1">{detail.class_count}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] p-3">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Students</p>
                      <p className="text-sm font-semibold mt-1">{detail.student_count}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
                      <span>Year progress</span>
                      <span>{detail.progress_percent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--primary)] rounded-full transition-all"
                        style={{ width: `${detail.progress_percent}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[var(--muted)] mt-1">
                      {detail.days_elapsed} of {detail.days_total} days · {detail.days_remaining} days left
                    </p>
                  </div>
                </Card>

                <Card className="border-dashed">
                  <h4 className="text-sm font-semibold mb-1">Terms</h4>
                  <p className="text-sm text-[var(--muted)]">
                    {detail.term_count > 0
                      ? `${detail.term_count} term(s) configured. Full term editor coming soon.`
                      : "No terms yet. Term scheduling will be available in a future update."}
                  </p>
                </Card>

                <Card className="border-dashed">
                  <h4 className="text-sm font-semibold mb-1">Holidays & non-working days</h4>
                  <p className="text-sm text-[var(--muted)]">Holiday calendar and .ics import — coming soon.</p>
                </Card>

                <Card className="border-dashed">
                  <h4 className="text-sm font-semibold mb-1">Promotion plan</h4>
                  <p className="text-sm text-[var(--muted)]">
                    Auto-promote, fee carry-forward, and year close — coming soon.
                  </p>
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New academic year" size="md">
        <form onSubmit={createYear} className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Dates default from your school cycle (month {startMonth}). Override if needed.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <div className="flex gap-2">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="AY 2026–27" />
              <button type="button" onClick={suggestName} className={btnSecondary}>
                Suggest
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Start (optional)</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End (optional)</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={setActive} onChange={(e) => setSetActive(e.target.checked)} />
            Set as active academic year
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>
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
