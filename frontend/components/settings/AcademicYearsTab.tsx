"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { api } from "@/lib/api";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass } from "@/lib/ui";
import { toDateInputValue, type AcademicYearSuggest } from "@/lib/academicYear";

const CYCLE_OPTIONS = [
  { value: "1", label: "January – December (calendar year)" },
  { value: "4", label: "April – March (e.g. South Asia)" },
  { value: "6", label: "June – May" },
  { value: "9", label: "September – August" },
];

type TermRow = {
  id: string;
  academic_year_id: string;
  term_name: string;
  term_start_date: string;
  term_end_date: string;
};

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
  onStartMonthChange,
  onYearsListChange,
  onActiveYearChange,
}: {
  token?: string | null;
  startMonth: number;
  onStartMonthChange: (month: number) => void;
  onYearsListChange: () => void;
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
  const [cycleSaving, setCycleSaving] = useState(false);
  const [cycleDraft, setCycleDraft] = useState(String(startMonth));
  const [cycleLabel, setCycleLabel] = useState("January – December");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [termsLoading, setTermsLoading] = useState(false);
  const [termModal, setTermModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<TermRow | null>(null);
  const [termName, setTermName] = useState("");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");
  const [termSaving, setTermSaving] = useState(false);
  const [editingDates, setEditingDates] = useState(false);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [datesSaving, setDatesSaving] = useState(false);

  useEffect(() => {
    setCycleDraft(String(startMonth));
  }, [startMonth]);

  useEffect(() => {
    setEditingDates(false);
  }, [selectedId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api<AcademicYearRow[]>("/api/academic/years", { token: token ?? undefined });
      setYears(rows);
      if (rows.length === 0) {
        setSelectedId(null);
        setShowModal(true);
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
    if (showModal && !start && !suggestLoading) {
      loadSuggestion();
    }
    // Only prefill when modal opens without dates yet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

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
  }, [selectedId, token]);

  const loadTerms = useCallback(async () => {
    if (!selectedId) {
      setTerms([]);
      return;
    }
    setTermsLoading(true);
    try {
      const rows = await api<TermRow[]>(`/api/academic/terms?academic_year_id=${selectedId}`, {
        token: token ?? undefined,
      });
      setTerms(rows);
    } catch {
      setTerms([]);
    } finally {
      setTermsLoading(false);
    }
  }, [selectedId, token]);

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  async function loadSuggestion() {
    setSuggestLoading(true);
    try {
      const s = await api<AcademicYearSuggest>("/api/academic/years/suggest", { token: token ?? undefined });
      setName(s.academic_year_name);
      setStart(toDateInputValue(s.year_start_date));
      setEnd(toDateInputValue(s.year_end_date));
      setCycleLabel(s.cycle_label);
    } catch {
      snackbar.error("Could not load suggested dates");
    } finally {
      setSuggestLoading(false);
    }
  }

  async function openCreateModal() {
    setShowModal(true);
    await loadSuggestion();
  }

  function beginEditDates() {
    if (!detail) return;
    setEditStart(toDateInputValue(detail.year_start_date));
    setEditEnd(toDateInputValue(detail.year_end_date));
    setEditingDates(true);
  }

  async function saveYearDates() {
    if (!detail) return;
    if (!editStart || !editEnd) {
      snackbar.error("Start and end dates are required.");
      return;
    }
    if (editStart > editEnd) {
      snackbar.error("End date must be on or after the start date.");
      return;
    }
    setDatesSaving(true);
    try {
      await api(`/api/academic/years/${detail.id}`, {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({
          year_start_date: editStart,
          year_end_date: editEnd,
        }),
      });
      snackbar.success("Academic year dates updated.");
      setEditingDates(false);
      setYears((prev) =>
        prev.map((y) =>
          y.id === detail.id ? { ...y, year_start_date: editStart, year_end_date: editEnd } : y
        )
      );
      const updated = await api<YearDetail>(`/api/academic/years/${detail.id}/detail`, {
        token: token ?? undefined,
      });
      setDetail(updated);
      onYearsListChange();
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to update dates");
    } finally {
      setDatesSaving(false);
    }
  }

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
    if (!start || !end) {
      snackbar.error("Start and end dates are required.");
      return;
    }
    if (start > end) {
      snackbar.error("End date must be on or after the start date.");
      return;
    }
    setSaving(true);
    try {
      const created = await api<{ id: string }>("/api/academic/years", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          academic_year_name: name.trim() || undefined,
          year_start_date: start,
          year_end_date: end,
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

  async function saveCycle() {
    const month = parseInt(cycleDraft, 10) || 1;
    setCycleSaving(true);
    try {
      await api("/api/settings", {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({ academic_year_start_month: month }),
      });
      onStartMonthChange(month);
      snackbar.success("Academic year cycle saved.");
      if (showModal) await loadSuggestion();
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to save cycle");
    } finally {
      setCycleSaving(false);
    }
  }

  const meta = TAB_META.years;

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle="Set your year calendar, manage years, and choose which year is active for enrollments and fees."
        actions={
          <button type="button" onClick={openCreateModal} className={btnPrimary}>
            + New academic year
          </button>
        }
      />

      <Card className="mb-6">
        <h3 className="text-sm font-semibold mb-1">Academic year cycle</h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          Default is January–December. Change this if your school runs on a different calendar (e.g. April–March).
        </p>
        <div className="flex flex-wrap items-end gap-3 max-w-xl">
          <SelectField
            label="Year starts in"
            options={CYCLE_OPTIONS}
            value={cycleDraft}
            onChange={setCycleDraft}
            className="flex-1 min-w-[14rem]"
          />
          <button
            type="button"
            onClick={saveCycle}
            disabled={cycleSaving || cycleDraft === String(startMonth)}
            className={btnSecondary}
          >
            {cycleSaving ? "Saving…" : "Save cycle"}
          </button>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : years.length === 0 ? (
        <Card>
          <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
            <p className="text-[var(--muted)] mb-4">No academic years yet. Create one to start using the system.</p>
            <button type="button" onClick={openCreateModal} className={btnPrimary}>
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
                        {editingDates && editStart && editEnd
                          ? `${new Date(editStart).toLocaleDateString()} – ${new Date(editEnd).toLocaleDateString()}`
                          : `${new Date(detail.year_start_date).toLocaleDateString()} – ${new Date(detail.year_end_date).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editingDates ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditingDates(false)}
                            className={btnSecondary}
                            disabled={datesSaving}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={saveYearDates}
                            className={btnPrimary}
                            disabled={datesSaving}
                          >
                            {datesSaving ? "Saving…" : "Save dates"}
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={beginEditDates} className={btnSecondary}>
                          Edit dates
                        </button>
                      )}
                      {!detail.is_active && !editingDates && (
                        <button type="button" onClick={() => activate(detail.id)} className={btnPrimary}>
                          Set active
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {editingDates ? (
                      <>
                        <div className="rounded-lg border border-[var(--border)] p-3 sm:col-span-1">
                          <label className="text-[10px] uppercase tracking-wide text-[var(--muted)] block mb-1">
                            Start date
                          </label>
                          <input
                            type="date"
                            value={editStart}
                            onChange={(e) => setEditStart(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div className="rounded-lg border border-[var(--border)] p-3 sm:col-span-1">
                          <label className="text-[10px] uppercase tracking-wide text-[var(--muted)] block mb-1">
                            End date
                          </label>
                          <input
                            type="date"
                            value={editEnd}
                            onChange={(e) => setEditEnd(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="rounded-lg border border-[var(--border)] p-3">
                          <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Start</p>
                          <p className="text-sm font-semibold mt-1">{fmtShort(detail.year_start_date)}</p>
                        </div>
                        <div className="rounded-lg border border-[var(--border)] p-3">
                          <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">End</p>
                          <p className="text-sm font-semibold mt-1">{fmtShort(detail.year_end_date)}</p>
                        </div>
                      </>
                    )}
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

                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h4 className="text-sm font-semibold">Terms</h4>
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => {
                        setEditingTerm(null);
                        setTermName("");
                        setTermStart(toDateInputValue(detail.year_start_date));
                        setTermEnd(toDateInputValue(detail.year_end_date));
                        setTermModal(true);
                      }}
                    >
                      + Add term
                    </button>
                  </div>
                  {termsLoading ? (
                    <p className="text-sm text-[var(--muted)]">Loading terms…</p>
                  ) : terms.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                      Split the year into terms (e.g. Term 1, Term 2) for fees and exams.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                      {terms.map((t) => (
                        <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                          <div>
                            <p className="text-sm font-medium">{t.term_name}</p>
                            <p className="text-[11px] text-[var(--muted)]">
                              {fmtShort(t.term_start_date)} – {fmtShort(t.term_end_date)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className={btnSecondary}
                              onClick={() => {
                                setEditingTerm(t);
                                setTermName(t.term_name);
                                setTermStart(toDateInputValue(t.term_start_date));
                                setTermEnd(toDateInputValue(t.term_end_date));
                                setTermModal(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                              onClick={async () => {
                                if (!confirm(`Delete ${t.term_name}?`)) return;
                                try {
                                  await api(`/api/academic/terms/${t.id}`, {
                                    token: token ?? undefined,
                                    method: "DELETE",
                                  });
                                  snackbar.success("Term deleted.");
                                  loadTerms();
                                  if (selectedId) {
                                    api<YearDetail>(`/api/academic/years/${selectedId}/detail`, {
                                      token: token ?? undefined,
                                    }).then(setDetail);
                                  }
                                } catch (err) {
                                  snackbar.error(err instanceof Error ? err.message : "Delete failed");
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
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
            Suggested from your cycle: <strong>{cycleLabel}</strong>. Edit any field before creating.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="AY 2026"
                required
              />
              <button type="button" onClick={loadSuggestion} disabled={suggestLoading} className={btnSecondary}>
                {suggestLoading ? "…" : "Reset defaults"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Start date</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End date</label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>
          {start && end && (
            <p className="text-xs text-[var(--muted)]">
              {new Date(start).toLocaleDateString()} – {new Date(end).toLocaleDateString()}
            </p>
          )}
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

      <Modal
        open={termModal}
        onClose={() => setTermModal(false)}
        title={editingTerm ? "Edit term" : "Add term"}
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!selectedId || !termName.trim() || !termStart || !termEnd) return;
            setTermSaving(true);
            try {
              if (editingTerm) {
                await api(`/api/academic/terms/${editingTerm.id}`, {
                  token: token ?? undefined,
                  method: "PATCH",
                  body: JSON.stringify({
                    term_name: termName.trim(),
                    term_start_date: termStart,
                    term_end_date: termEnd,
                  }),
                });
                snackbar.success("Term updated.");
              } else {
                await api("/api/academic/terms", {
                  token: token ?? undefined,
                  method: "POST",
                  body: JSON.stringify({
                    academic_year_id: selectedId,
                    term_name: termName.trim(),
                    term_start_date: termStart,
                    term_end_date: termEnd,
                  }),
                });
                snackbar.success("Term created.");
              }
              setTermModal(false);
              loadTerms();
              if (selectedId) {
                api<YearDetail>(`/api/academic/years/${selectedId}/detail`, { token: token ?? undefined }).then(
                  setDetail
                );
              }
            } catch (err) {
              snackbar.error(err instanceof Error ? err.message : "Failed to save term");
            } finally {
              setTermSaving(false);
            }
          }}
        >
          <div>
            <label className="block text-sm font-medium mb-1">Term name</label>
            <input
              type="text"
              value={termName}
              onChange={(e) => setTermName(e.target.value)}
              className={inputClass}
              placeholder="Term 1"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Start</label>
              <input type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End</label>
              <input type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} className={inputClass} required />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setTermModal(false)} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={termSaving} className={btnPrimary}>
              {termSaving ? "Saving…" : editingTerm ? "Save" : "Add term"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
