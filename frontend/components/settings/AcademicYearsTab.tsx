"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { api } from "@/lib/api";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass } from "@/lib/ui";
import { toDateInputValue, type AcademicYearSuggest } from "@/lib/academicYear";
import { PageLoader, PulsingDots } from "@/components/ui/PulsingDotsLoader";

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

type HolidayRow = {
  id: string;
  academic_year_id: string;
  date: string;
  name: string;
  is_non_working: boolean;
};

type PromotionPlan = {
  academic_year_id: string;
  auto_promote: boolean;
  fee_carry_forward: boolean;
  year_close_enabled: boolean;
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

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function clampToYearRange(d: Date, startISO: string, endISO: string): Date {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  if (d < startOfMonth(start)) return startOfMonth(start);
  const endMonth = startOfMonth(end);
  if (d > endMonth) return endMonth;
  return d;
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

  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [holidayModal, setHolidayModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<HolidayRow | null>(null);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidayNonWorking, setHolidayNonWorking] = useState(true);
  const [holidaySaving, setHolidaySaving] = useState(false);

  const [promotionPlan, setPromotionPlan] = useState<PromotionPlan | null>(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promotionSaving, setPromotionSaving] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [calendarSelectedISO, setCalendarSelectedISO] = useState<string>(() => toISODate(new Date()));
  const [dayPanelOpen, setDayPanelOpen] = useState(false);

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

  const loadHolidays = useCallback(async () => {
    if (!selectedId) {
      setHolidays([]);
      return;
    }
    setHolidaysLoading(true);
    try {
      const rows = await api<HolidayRow[]>(`/api/settings/holidays?academic_year_id=${selectedId}`, {
        token: token ?? undefined,
      });
      setHolidays(rows);
    } catch {
      setHolidays([]);
    } finally {
      setHolidaysLoading(false);
    }
  }, [selectedId, token]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const loadPromotionPlan = useCallback(async () => {
    if (!selectedId) {
      setPromotionPlan(null);
      return;
    }
    setPromotionLoading(true);
    try {
      const plan = await api<PromotionPlan>(`/api/settings/promotion-plan?academic_year_id=${selectedId}`, {
        token: token ?? undefined,
      });
      setPromotionPlan(plan);
    } catch {
      setPromotionPlan({ academic_year_id: selectedId, auto_promote: false, fee_carry_forward: false, year_close_enabled: false });
    } finally {
      setPromotionLoading(false);
    }
  }, [selectedId, token]);

  useEffect(() => {
    loadPromotionPlan();
  }, [loadPromotionPlan]);

  useEffect(() => {
    if (!detail) return;
    setCalendarMonth((prev) =>
      clampToYearRange(prev, toDateInputValue(detail.year_start_date), toDateInputValue(detail.year_end_date))
    );
    const todayISO = toISODate(new Date());
    const startISO = toDateInputValue(detail.year_start_date);
    const endISO = toDateInputValue(detail.year_end_date);
    const initialISO = todayISO < startISO ? startISO : todayISO > endISO ? endISO : todayISO;
    setCalendarSelectedISO(initialISO);
  }, [detail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const holidayByDate = useMemo(() => {
    const map = new Map<string, HolidayRow[]>();
    for (const h of holidays) {
      const iso = toDateInputValue(h.date);
      const list = map.get(iso) ?? [];
      list.push(h);
      map.set(iso, list);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
      map.set(k, list);
    }
    return map;
  }, [holidays]);

  const selectedDayHolidays = useMemo(() => holidayByDate.get(calendarSelectedISO) ?? [], [holidayByDate, calendarSelectedISO]);

  const calendarGrid = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const startWeekday = (monthStart.getDay() + 6) % 7; // 0=Mon
    const firstGridDay = new Date(monthStart);
    firstGridDay.setDate(monthStart.getDate() - startWeekday);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(firstGridDay);
      d.setDate(firstGridDay.getDate() + i);
      days.push(d);
    }
    return { monthStart, days };
  }, [calendarMonth]);

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
        <PageLoader minHeight="min-h-[20rem]" />
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
                {detailLoading ? (
                  <div className="py-8 flex justify-center">
                    <PulsingDots />
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)]">Select a year</p>
                )}
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
                    <div className="py-4 flex justify-center">
                      <PulsingDots size="sm" />
                    </div>
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

                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <h4 className="text-sm font-semibold">Holidays & non-working days</h4>
                      <p className="text-sm text-[var(--muted)]">
                        Click a day to see holidays, or add one. Days with holidays are highlighted.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => {
                          setCalendarMonth((m) => {
                            if (!detail) return m;
                            return clampToYearRange(addMonths(m, -1), toDateInputValue(detail.year_start_date), toDateInputValue(detail.year_end_date));
                          });
                        }}
                        disabled={!detail}
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => {
                          setCalendarMonth((m) => {
                            if (!detail) return m;
                            return clampToYearRange(addMonths(m, 1), toDateInputValue(detail.year_start_date), toDateInputValue(detail.year_end_date));
                          });
                        }}
                        disabled={!detail}
                      >
                        Next
                      </button>
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => {
                          if (!detail) return;
                          const startISO = toDateInputValue(detail.year_start_date);
                          const endISO = toDateInputValue(detail.year_end_date);
                          const today = startOfMonth(new Date());
                          setCalendarMonth(clampToYearRange(today, startISO, endISO));
                          const todayISO = toISODate(new Date());
                          setCalendarSelectedISO(todayISO < startISO ? startISO : todayISO > endISO ? endISO : todayISO);
                          setDayPanelOpen(true);
                        }}
                        disabled={!detail}
                      >
                        Today
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,1fr)_minmax(280px,320px)] gap-4">
                    <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-white">
                      <div className="px-4 py-3 border-b border-[var(--border)] bg-neutral-50/70 flex items-center justify-between">
                        <p className="text-sm font-semibold">{monthLabel(calendarGrid.monthStart)}</p>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400" /> Holiday
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-slate-300" /> Working
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-light)] border-b border-[var(--border)]">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                          <div key={d} className="px-3 py-2">
                            {d}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7">
                        {calendarGrid.days.map((d) => {
                          const iso = toISODate(d);
                          const inMonth = d.getMonth() === calendarGrid.monthStart.getMonth();
                          const selected = iso === calendarSelectedISO;
                          const dayItems = holidayByDate.get(iso) ?? [];
                          const count = dayItems.length;
                          const hasNonWorking = dayItems.some((h) => h.is_non_working);
                          const startISO = detail ? toDateInputValue(detail.year_start_date) : "0000-01-01";
                          const endISO = detail ? toDateInputValue(detail.year_end_date) : "9999-12-31";
                          const disabled = iso < startISO || iso > endISO;
                          return (
                            <button
                              key={iso}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                setCalendarSelectedISO(iso);
                                setDayPanelOpen(true);
                              }}
                              className={[
                                "relative h-12 px-3 py-2 text-left border-b border-r border-[var(--border)] transition-colors",
                                "focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]",
                                selected ? "bg-black text-white shadow-sm" : inMonth ? "bg-white" : "bg-neutral-50/60",
                                disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-neutral-50",
                                selected ? "ring-2 ring-inset ring-black" : "",
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between">
                                <span
                                  className={
                                    selected
                                      ? "text-sm font-semibold text-white"
                                      : inMonth
                                        ? "text-sm font-medium"
                                        : "text-sm text-[var(--muted)]"
                                  }
                                >
                                  {d.getDate()}
                                </span>
                                {count > 0 && (
                                  <span
                                    className={[
                                      "inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-semibold",
                                      selected
                                        ? "bg-white/15 text-white border border-white/25"
                                        : "bg-amber-50 text-amber-800 border border-amber-200",
                                    ].join(" ")}
                                  >
                                    {count}
                                  </span>
                                )}
                              </div>
                              {count > 0 && (
                                <span
                                  className={[
                                    "absolute left-3 bottom-2 w-2 h-2 rounded-full",
                                    selected ? "bg-white" : hasNonWorking ? "bg-amber-400" : "bg-slate-300",
                                  ].join(" ")}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="text-sm font-semibold">Selected day</p>
                          <p className="text-xs text-[var(--muted)]">{new Date(`${calendarSelectedISO}T00:00:00`).toDateString()}</p>
                        </div>
                        <button
                          type="button"
                          className={btnSecondary}
                          onClick={() => {
                            setEditingHoliday(null);
                            setHolidayDate(calendarSelectedISO);
                            setHolidayName("");
                            setHolidayNonWorking(true);
                            setHolidayModal(true);
                          }}
                        >
                          + Add
                        </button>
                      </div>

                      {!dayPanelOpen ? (
                        <p className="text-sm text-[var(--muted)]">Click a day on the calendar.</p>
                      ) : holidaysLoading ? (
                        <div className="py-4 flex justify-center">
                          <PulsingDots size="sm" />
                        </div>
                      ) : selectedDayHolidays.length === 0 ? (
                        <p className="text-sm text-[var(--muted)]">No holidays on this day.</p>
                      ) : (
                        <ul className="space-y-2">
                          {selectedDayHolidays.map((h) => (
                            <li key={h.id} className="rounded-lg border border-[var(--border)] px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{h.name}</p>
                                  <p className="text-[11px] text-[var(--muted)]">
                                    {h.is_non_working ? "Non-working day" : "Working day"}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-neutral-50"
                                    onClick={() => {
                                      setEditingHoliday(h);
                                      setHolidayDate(toDateInputValue(h.date));
                                      setHolidayName(h.name);
                                      setHolidayNonWorking(h.is_non_working);
                                      setHolidayModal(true);
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                                    onClick={async () => {
                                      if (!confirm(`Delete "${h.name}"?`)) return;
                                      try {
                                        await api(`/api/settings/holidays/${h.id}`, {
                                          token: token ?? undefined,
                                          method: "DELETE",
                                        });
                                        snackbar.success("Holiday deleted.");
                                        loadHolidays();
                                      } catch (err) {
                                        snackbar.error(err instanceof Error ? err.message : "Delete failed");
                                      }
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-4 pt-4 border-t border-[var(--border)]">
                        <p className="text-xs font-semibold text-[var(--muted)] mb-2">All holidays (this year)</p>
                        {holidays.length === 0 ? (
                          <p className="text-sm text-[var(--muted)]">No holidays yet.</p>
                        ) : (
                          <div className="max-h-[260px] overflow-auto rounded-lg border border-[var(--border)]">
                            <ul className="divide-y divide-[var(--border)]">
                              {holidays.map((h) => (
                                <li
                                  key={h.id}
                                  className="px-3 py-2 text-sm hover:bg-neutral-50 cursor-pointer"
                                  onClick={() => {
                                    const iso = toDateInputValue(h.date);
                                    setCalendarSelectedISO(iso);
                                    setCalendarMonth((m) => (detail ? clampToYearRange(startOfMonth(new Date(`${iso}T00:00:00`)), toDateInputValue(detail.year_start_date), toDateInputValue(detail.year_end_date)) : m));
                                    setDayPanelOpen(true);
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium truncate">{h.name}</span>
                                    <span className="text-[11px] text-[var(--muted)] whitespace-nowrap">{fmtShort(h.date)}</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <h4 className="text-sm font-semibold">Promotion plan</h4>
                      <p className="text-sm text-[var(--muted)]">
                        Configure what should happen when this academic year ends.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={promotionSaving || promotionLoading || !promotionPlan}
                      onClick={async () => {
                        if (!promotionPlan) return;
                        setPromotionSaving(true);
                        try {
                          await api("/api/settings/promotion-plan", {
                            token: token ?? undefined,
                            method: "PUT",
                            body: JSON.stringify(promotionPlan),
                          });
                          snackbar.success("Promotion plan saved.");
                        } catch (err) {
                          snackbar.error(err instanceof Error ? err.message : "Failed to save");
                        } finally {
                          setPromotionSaving(false);
                        }
                      }}
                    >
                      {promotionSaving ? "Saving…" : "Save plan"}
                    </button>
                  </div>

                  {promotionLoading || !promotionPlan ? (
                    <div className="py-4 flex justify-center">
                      <PulsingDots size="sm" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={promotionPlan.auto_promote}
                          onChange={(e) => setPromotionPlan((p) => (p ? { ...p, auto_promote: e.target.checked } : p))}
                        />
                        <span>
                          <span className="font-medium">Auto-promote students</span>
                          <span className="block text-[11px] text-[var(--muted)]">
                            Mark students as promoted at year close. (No data migration yet.)
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={promotionPlan.fee_carry_forward}
                          onChange={(e) => setPromotionPlan((p) => (p ? { ...p, fee_carry_forward: e.target.checked } : p))}
                        />
                        <span>
                          <span className="font-medium">Carry forward fees</span>
                          <span className="block text-[11px] text-[var(--muted)]">
                            Keep unpaid invoices visible when switching to the next year.
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={promotionPlan.year_close_enabled}
                          onChange={(e) => setPromotionPlan((p) => (p ? { ...p, year_close_enabled: e.target.checked } : p))}
                        />
                        <span>
                          <span className="font-medium">Enable year close</span>
                          <span className="block text-[11px] text-[var(--muted)]">
                            Enables a future “Year close” action for this year.
                          </span>
                        </span>
                      </label>
                    </div>
                  )}
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
        open={holidayModal}
        onClose={() => !holidaySaving && setHolidayModal(false)}
        title={editingHoliday ? "Edit holiday" : "Add holiday"}
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!selectedId) return;
            if (!holidayDate || !holidayName.trim()) {
              snackbar.error("Name is required.");
              return;
            }
            setHolidaySaving(true);
            try {
              if (editingHoliday) {
                await api(`/api/settings/holidays/${editingHoliday.id}`, {
                  token: token ?? undefined,
                  method: "PATCH",
                  body: JSON.stringify({
                    date: holidayDate,
                    name: holidayName.trim(),
                    is_non_working: holidayNonWorking,
                  }),
                });
                snackbar.success("Holiday updated.");
              } else {
                await api("/api/settings/holidays", {
                  token: token ?? undefined,
                  method: "POST",
                  body: JSON.stringify({
                    academic_year_id: selectedId,
                    date: holidayDate,
                    name: holidayName.trim(),
                    is_non_working: holidayNonWorking,
                  }),
                });
                snackbar.success("Holiday added.");
              }
              setHolidayModal(false);
              loadHolidays();
            } catch (err) {
              snackbar.error(err instanceof Error ? err.message : "Failed to save holiday");
            } finally {
              setHolidaySaving(false);
            }
          }}
        >
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-1">
              Date
            </label>
            <div className="rounded-lg border border-[var(--border)] px-3 py-2 bg-neutral-50 text-sm">
              {new Date(`${holidayDate}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "2-digit",
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
              className={inputClass}
              placeholder="Independence Day"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={holidayNonWorking} onChange={(e) => setHolidayNonWorking(e.target.checked)} />
            Non-working day
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setHolidayModal(false)} className={btnSecondary} disabled={holidaySaving}>
              Cancel
            </button>
            <button type="submit" disabled={holidaySaving} className={btnPrimary}>
              {holidaySaving ? "Saving…" : editingHoliday ? "Save" : "Add"}
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
