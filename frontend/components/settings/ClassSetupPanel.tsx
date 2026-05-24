"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { api } from "@/lib/api";
import { cachedGet } from "@/lib/settings-cache";
import { PageLoader } from "@/components/ui/PulsingDotsLoader";
import { computePassMarks } from "@/lib/k12-class";
import {
  cellKey,
  DEFAULT_TIMETABLE_SETTINGS,
  periodTimeRange,
  WEEKDAY_LABELS,
  type TimetableSettings,
} from "@/lib/timetable";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass } from "@/lib/ui";

type SubjectItem = {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  full_marks: number;
  pass_marks: number;
  is_optional: boolean;
};

type TimetableSlot = {
  id: string;
  day_of_week: number;
  period_index: number;
  from_time: string;
  to_time: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  section_name: string | null;
  instructor_name: string | null;
  room_name: string | null;
  section_id: string | null;
  instructor_id: string | null;
  room_id: string | null;
};

type SectionSetup = {
  id: string;
  name: string;
  capacity: number;
  class_teacher_id: string | null;
  class_teacher_name: string | null;
};

type ClassSetup = {
  id: string;
  name: string;
  numeric_level: number | null;
  academic_year_id: string;
  subjects: SubjectItem[];
  timetable: TimetableSlot[];
  timetable_settings: TimetableSettings;
  sections: SectionSetup[];
  pass_threshold_percent?: number;
  grading_scale_name?: string | null;
};

type K12Subject = { id: string; name: string; code: string };
type Instructor = { id: string; instructor_name: string };
type Room = { id: string; room_name: string };

const ALL_WEEKDAYS = WEEKDAY_LABELS.map((label, i) => ({ value: i, label }));

export function ClassSetupPanel({
  token,
  classId,
  className,
  onClassUpdated,
}: {
  token?: string | null;
  classId: string;
  className: string;
  onClassUpdated: (patch: { name?: string; numeric_level?: number | null }) => void;
}) {
  const snackbar = useSnackbar();
  const snackbarRef = useRef(snackbar);
  snackbarRef.current = snackbar;

  const [panel, setPanel] = useState<"subjects" | "timetable" | "settings">("subjects");
  const [setup, setSetup] = useState<ClassSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [allSubjects, setAllSubjects] = useState<K12Subject[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [saving, setSaving] = useState(false);

  const [addSubjectId, setAddSubjectId] = useState("");
  const [addFullMarks, setAddFullMarks] = useState("100");

  const [editName, setEditName] = useState(className);
  const [editLevel, setEditLevel] = useState("");
  const [ttWeekdays, setTtWeekdays] = useState<number[]>(DEFAULT_TIMETABLE_SETTINGS.weekdays);
  const [ttPeriods, setTtPeriods] = useState(String(DEFAULT_TIMETABLE_SETTINGS.periods_per_day));
  const [ttPeriodMins, setTtPeriodMins] = useState(String(DEFAULT_TIMETABLE_SETTINGS.period_minutes));
  const [ttBreakMins, setTtBreakMins] = useState(String(DEFAULT_TIMETABLE_SETTINGS.break_minutes));
  const [ttBreakAfter, setTtBreakAfter] = useState(String(DEFAULT_TIMETABLE_SETTINGS.break_after_period));
  const [ttStart, setTtStart] = useState("08:00");

  const [slotModal, setSlotModal] = useState(false);
  const [assignDay, setAssignDay] = useState(0);
  const [assignPeriod, setAssignPeriod] = useState(0);
  const [assignSlotId, setAssignSlotId] = useState<string | null>(null);
  const [slotSubjectId, setSlotSubjectId] = useState("");
  const [slotSectionId, setSlotSectionId] = useState("");
  const [slotInstructorId, setSlotInstructorId] = useState("");
  const [slotRoomId, setSlotRoomId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setAllSubjects([]);
    try {
      const [data, inst, rms] = await Promise.all([
        api<ClassSetup>(`/api/k12/classes/${classId}/setup`, { token: token ?? undefined }),
        cachedGet<Instructor[]>("/api/instructors?limit=200", { token: token ?? undefined }).catch(
          () => [] as Instructor[]
        ),
        cachedGet<Room[]>("/api/rooms", { token: token ?? undefined }).catch(() => [] as Room[]),
      ]);
      setSetup(data);
      setEditName(data.name);
      setEditLevel(data.numeric_level != null ? String(data.numeric_level) : "");
      applyTimetableSettingsToForm(data.timetable_settings);
      setInstructors(inst.filter((i) => i.instructor_name));
      setRooms(rms);
    } catch {
      snackbarRef.current.error("Could not load class setup");
      setSetup(null);
    } finally {
      setLoading(false);
    }
  }, [classId, token]);

  function applyTimetableSettingsToForm(ts: TimetableSettings) {
    setTtWeekdays(ts.weekdays);
    setTtPeriods(String(ts.periods_per_day));
    setTtPeriodMins(String(ts.period_minutes));
    setTtBreakMins(String(ts.break_minutes));
    setTtBreakAfter(String(ts.break_after_period));
    const st = ts.start_time?.slice(0, 5) ?? "08:00";
    setTtStart(st);
  }

  const loadSubjectOptions = useCallback(async () => {
    if (allSubjects.length > 0) return;
    try {
      const subs = await cachedGet<K12Subject[]>("/api/k12/subjects/options", {
        token: token ?? undefined,
      });
      setAllSubjects(subs);
    } catch {
      snackbarRef.current.error("Could not load subjects list");
    }
  }, [allSubjects.length, token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (panel === "subjects") loadSubjectOptions();
  }, [panel, loadSubjectOptions]);

  const unassignedSubjects = useMemo(() => {
    if (!setup) return allSubjects;
    const assigned = new Set(setup.subjects.map((s) => s.subject_id));
    return allSubjects.filter((s) => !assigned.has(s.id));
  }, [allSubjects, setup]);

  const passThresholdPercent = setup?.pass_threshold_percent ?? 40;
  const ttSettings = setup?.timetable_settings ?? DEFAULT_TIMETABLE_SETTINGS;

  const previewPassMarks = useMemo(
    () => computePassMarks(parseInt(addFullMarks, 10) || 0, passThresholdPercent),
    [addFullMarks, passThresholdPercent]
  );

  const slotMap = useMemo(() => {
    const map = new Map<string, TimetableSlot>();
    if (!setup) return map;
    for (const slot of setup.timetable) {
      map.set(cellKey(slot.day_of_week, slot.period_index), slot);
    }
    return map;
  }, [setup]);

  const activeWeekdays = useMemo(
    () => [...ttSettings.weekdays].sort((a, b) => a - b),
    [ttSettings.weekdays]
  );

  const periodCount = ttSettings.periods_per_day;

  async function assignSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!addSubjectId) return;
    setSaving(true);
    try {
      const item = await api<SubjectItem>(`/api/k12/classes/${classId}/subjects`, {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          subject_id: addSubjectId,
          full_marks: parseInt(addFullMarks, 10) || 100,
        }),
      });
      setSetup((s) => (s ? { ...s, subjects: [...s.subjects, item] } : s));
      setAddSubjectId("");
      snackbarRef.current.success("Subject assigned.");
    } catch (err) {
      snackbarRef.current.error(err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setSaving(false);
    }
  }

  async function removeSubject(subjectId: string) {
    try {
      await api(`/api/k12/classes/${classId}/subjects/${subjectId}`, {
        token: token ?? undefined,
        method: "DELETE",
      });
      setSetup((s) => (s ? { ...s, subjects: s.subjects.filter((x) => x.subject_id !== subjectId) } : s));
      snackbarRef.current.success("Subject removed.");
    } catch (err) {
      snackbarRef.current.error(err instanceof Error ? err.message : "Failed to remove");
    }
  }

  function openAssignCell(day: number, period: number) {
    const existing = slotMap.get(cellKey(day, period));
    setAssignDay(day);
    setAssignPeriod(period);
    setAssignSlotId(existing?.id ?? null);
    setSlotSubjectId(existing?.subject_id ?? setup?.subjects[0]?.subject_id ?? "");
    setSlotSectionId(existing?.section_id ?? "");
    setSlotInstructorId(existing?.instructor_id ?? "");
    setSlotRoomId(existing?.room_id ?? "");
    setSlotModal(true);
  }

  async function saveSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!slotSubjectId) return;
    setSaving(true);
    try {
      const slot = await api<TimetableSlot>(`/api/k12/classes/${classId}/timetable`, {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          subject_id: slotSubjectId,
          section_id: slotSectionId || null,
          instructor_id: slotInstructorId || null,
          room_id: slotRoomId || null,
          day_of_week: assignDay,
          period_index: assignPeriod,
        }),
      });
      const key = cellKey(assignDay, assignPeriod);
      setSetup((s) => {
        if (!s) return s;
        const rest = s.timetable.filter((x) => cellKey(x.day_of_week, x.period_index) !== key);
        return { ...s, timetable: [...rest, slot] };
      });
      setSlotModal(false);
      snackbarRef.current.success("Period saved.");
    } catch (err) {
      snackbarRef.current.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function clearSlot() {
    if (!assignSlotId) {
      setSlotModal(false);
      return;
    }
    setSaving(true);
    try {
      await api(`/api/k12/timetable/${assignSlotId}`, { token: token ?? undefined, method: "DELETE" });
      const key = cellKey(assignDay, assignPeriod);
      setSetup((s) =>
        s ? { ...s, timetable: s.timetable.filter((x) => cellKey(x.day_of_week, x.period_index) !== key) } : s
      );
      setSlotModal(false);
      snackbarRef.current.success("Period cleared.");
    } catch (err) {
      snackbarRef.current.error(err instanceof Error ? err.message : "Failed to clear");
    } finally {
      setSaving(false);
    }
  }

  async function saveClassSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const level = editLevel.trim() ? parseInt(editLevel, 10) : null;
      await api(`/api/k12/classes/${classId}`, {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          numeric_level: Number.isFinite(level) ? level : null,
        }),
      });
      onClassUpdated({ name: editName.trim(), numeric_level: level });
      setSetup((s) => (s ? { ...s, name: editName.trim(), numeric_level: level } : s));
      snackbarRef.current.success("Class settings saved.");
    } catch (err) {
      snackbarRef.current.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function saveTimetableSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const periods = Math.min(12, Math.max(1, parseInt(ttPeriods, 10) || 8));
      const breakAfter = parseInt(ttBreakAfter, 10) || 0;
      if (breakAfter > periods) {
        snackbarRef.current.error("Break must be before the last period of the day.");
        return;
      }
      const updated = await api<TimetableSettings>(`/api/k12/classes/${classId}/timetable-settings`, {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({
          weekdays: ttWeekdays,
          periods_per_day: periods,
          period_minutes: parseInt(ttPeriodMins, 10) || 45,
          break_minutes: parseInt(ttBreakMins, 10) || 0,
          break_after_period: breakAfter,
          start_time: `${ttStart}:00`,
        }),
      });
      setSetup((s) => (s ? { ...s, timetable_settings: updated } : s));
      applyTimetableSettingsToForm(updated);
      snackbarRef.current.success("Timetable layout saved.");
    } catch (err) {
      snackbarRef.current.error(err instanceof Error ? err.message : "Failed to save timetable layout");
    } finally {
      setSaving(false);
    }
  }

  function toggleWeekday(day: number) {
    setTtWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  }

  async function saveSectionTeacher(sectionId: string, teacherId: string) {
    try {
      await api(`/api/k12/sections/${sectionId}`, {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({ class_teacher_id: teacherId || null }),
      });
      const teacher = instructors.find((i) => i.id === teacherId);
      setSetup((s) =>
        s
          ? {
              ...s,
              sections: s.sections.map((sec) =>
                sec.id === sectionId
                  ? {
                      ...sec,
                      class_teacher_id: teacherId || null,
                      class_teacher_name: teacher?.instructor_name ?? null,
                    }
                  : sec
              ),
            }
          : s
      );
      snackbarRef.current.success("Class teacher updated.");
    } catch (err) {
      snackbarRef.current.error(err instanceof Error ? err.message : "Failed to update teacher");
    }
  }

  if (loading) {
    return <PageLoader minHeight="min-h-[12rem]" />;
  }
  if (!setup) {
    return <p className="text-sm text-[var(--muted)] py-4">Could not load class details.</p>;
  }

  const tabBtn = (id: typeof panel, label: string) => (
    <button
      type="button"
      onClick={() => setPanel(id)}
      className={`cursor-pointer text-sm font-medium px-3 py-1.5 rounded-full border transition-colors ${
        panel === id
          ? "bg-[var(--primary)] text-white border-[var(--primary)]"
          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <div className="flex flex-wrap gap-2 mb-4">
        {tabBtn("subjects", "Subjects")}
        {tabBtn("timetable", "Timetable")}
        {tabBtn("settings", "Class settings")}
      </div>

      {panel === "subjects" && (
        <div className="space-y-4">
          {setup.subjects.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No subjects assigned yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {setup.subjects.map((s) => (
                <li key={s.subject_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">
                      {s.subject_name}{" "}
                      <span className="text-[var(--muted)] font-normal">({s.subject_code})</span>
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">
                      Full {s.full_marks} · Pass {s.pass_marks} ({passThresholdPercent}%)
                      {s.is_optional ? " · Optional" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSubject(s.subject_id)}
                    className="cursor-pointer text-xs text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {unassignedSubjects.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">
              All subjects are assigned.{" "}
              <Link href="/dashboard/settings?tab=subjects" className="underline">
                Add more subjects
              </Link>
            </p>
          ) : (
            <form
              onSubmit={assignSubject}
              className="flex flex-wrap items-end gap-2 p-3 rounded-lg bg-neutral-50/80 border border-[var(--border)]"
            >
              <SelectField
                label="Add subject"
                options={unassignedSubjects.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
                value={addSubjectId}
                onChange={setAddSubjectId}
                className="min-w-[12rem] flex-1"
              />
              <div>
                <label className="block text-xs font-medium mb-1">Full marks</label>
                <input
                  type="number"
                  min={1}
                  value={addFullMarks}
                  onChange={(e) => setAddFullMarks(e.target.value)}
                  className={`${inputClass} w-24`}
                />
              </div>
              <div className="pb-2">
                <p className="text-xs text-[var(--muted)]">
                  Pass <span className="font-semibold text-[var(--foreground)] tabular-nums">{previewPassMarks}</span>
                  <span className="text-[var(--muted)]"> ({passThresholdPercent}%)</span>
                </p>
              </div>
              <button type="submit" disabled={saving || !addSubjectId} className={btnPrimary}>
                Assign
              </button>
            </form>
          )}
        </div>
      )}

      {panel === "timetable" && (
        <div className="space-y-4">
          {setup.subjects.length === 0 ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Assign subjects first, then fill the weekly timetable.
            </p>
          ) : activeWeekdays.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Choose school days under Class settings → Timetable layout, then return here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm border-collapse min-w-[32rem]">
                <thead>
                  <tr className="bg-neutral-50/90 border-b border-[var(--border)]">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-[var(--muted)] w-16 sticky left-0 bg-neutral-50/90">
                      Day
                    </th>
                    {Array.from({ length: periodCount }, (_, p) => {
                      const range = periodTimeRange(ttSettings, p);
                      return (
                        <th key={p} className="px-1 py-2 text-center min-w-[5.5rem]">
                          <span className="block text-[10px] font-semibold text-[var(--foreground)]">P{p + 1}</span>
                          <span className="block text-[9px] text-[var(--muted)] font-normal">
                            {range.from}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activeWeekdays.map((day) => (
                    <tr key={day} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-2 text-xs font-semibold text-[var(--muted)] sticky left-0 bg-white">
                        {WEEKDAY_LABELS[day]}
                      </td>
                      {Array.from({ length: periodCount }, (_, period) => {
                        const slot = slotMap.get(cellKey(day, period));
                        return (
                          <td key={period} className="p-1">
                            <button
                              type="button"
                              onClick={() => openAssignCell(day, period)}
                              className={`w-full min-h-[3.25rem] rounded-md border text-left px-2 py-1.5 transition-colors cursor-pointer ${
                                slot
                                  ? "border-[var(--primary)]/30 bg-[var(--primary-light)] hover:bg-[var(--primary-light)]"
                                  : "border-dashed border-[var(--border)] bg-white hover:bg-neutral-50 hover:border-[var(--primary)]/40"
                              }`}
                            >
                              {slot ? (
                                <>
                                  <p className="text-xs font-semibold leading-tight truncate">{slot.subject_name}</p>
                                  <p className="text-[10px] text-[var(--muted)] truncate">{slot.subject_code}</p>
                                </>
                              ) : (
                                <span className="text-[10px] text-[var(--muted)]">+</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-[var(--muted)]">
            Click a cell to assign or change a subject for that period.
            {ttSettings.break_after_period > 0 && ttSettings.break_minutes > 0 && (
              <>
                {" "}
                Break: {ttSettings.break_minutes} min after period {ttSettings.break_after_period}.
              </>
            )}
          </p>
        </div>
      )}

      {panel === "settings" && (
        <div className="space-y-8">
          <form onSubmit={saveClassSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
            <h4 className="sm:col-span-2 text-sm font-semibold">Class details</h4>
            <div>
              <label className="block text-sm font-medium mb-1">Class name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Grade level (optional)</label>
              <input
                type="number"
                min={1}
                max={13}
                value={editLevel}
                onChange={(e) => setEditLevel(e.target.value)}
                className={inputClass}
                placeholder="e.g. 10"
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? "Saving…" : "Save class"}
              </button>
            </div>
          </form>

          <form onSubmit={saveTimetableSettings} className="max-w-2xl space-y-4 border-t border-[var(--border)] pt-6">
            <div>
              <h4 className="text-sm font-semibold">Timetable layout</h4>
              <p className="text-xs text-[var(--muted)] mt-1">
                Set the school week and periods. The timetable tab uses this to build the weekly grid.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">School days</p>
              <div className="flex flex-wrap gap-2">
                {ALL_WEEKDAYS.map(({ value, label }) => (
                  <label
                    key={value}
                    className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border cursor-pointer ${
                      ttWeekdays.includes(value)
                        ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                        : "border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={ttWeekdays.includes(value)}
                      onChange={() => toggleWeekday(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Periods per day</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={ttPeriods}
                  onChange={(e) => setTtPeriods(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Minutes per period</label>
                <input
                  type="number"
                  min={15}
                  max={120}
                  value={ttPeriodMins}
                  onChange={(e) => setTtPeriodMins(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Day starts at</label>
                <input type="time" value={ttStart} onChange={(e) => setTtStart(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Break length (min)</label>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={ttBreakMins}
                  onChange={(e) => setTtBreakMins(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Break after period</label>
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={ttBreakAfter}
                  onChange={(e) => setTtBreakAfter(e.target.value)}
                  className={inputClass}
                  placeholder="0 = no break"
                />
              </div>
            </div>
            <button type="submit" disabled={saving || ttWeekdays.length === 0} className={btnPrimary}>
              {saving ? "Saving…" : "Save timetable layout"}
            </button>
          </form>

          <div className="border-t border-[var(--border)] pt-6">
            <h4 className="text-sm font-semibold mb-2">Section class teachers</h4>
            {setup.sections.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Add sections to assign class teachers.</p>
            ) : (
              <ul className="space-y-3">
                {setup.sections.map((sec) => (
                  <li key={sec.id} className="flex flex-wrap items-end gap-2">
                    <span className="text-sm font-medium w-24 shrink-0">{sec.name}</span>
                    <SelectField
                      label=""
                      options={[
                        { value: "", label: "— No teacher —" },
                        ...instructors.map((i) => ({ value: i.id, label: i.instructor_name })),
                      ]}
                      value={sec.class_teacher_id ?? ""}
                      onChange={(v) => saveSectionTeacher(sec.id, v)}
                      className="min-w-[14rem] flex-1"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <Modal
        open={slotModal}
        onClose={() => !saving && setSlotModal(false)}
        title={`${WEEKDAY_LABELS[assignDay]} · Period ${assignPeriod + 1}`}
        size="md"
      >
        <form onSubmit={saveSlot} className="space-y-3">
          <p className="text-xs text-[var(--muted)]">
            {periodTimeRange(ttSettings, assignPeriod).from} – {periodTimeRange(ttSettings, assignPeriod).to}
          </p>
          <SelectField
            label="Subject"
            options={setup.subjects.map((s) => ({
              value: s.subject_id,
              label: `${s.subject_name} (${s.subject_code})`,
            }))}
            value={slotSubjectId}
            onChange={setSlotSubjectId}
          />
          <SelectField
            label="Section (optional)"
            options={[
              { value: "", label: "All sections" },
              ...setup.sections.map((s) => ({ value: s.id, label: s.name })),
            ]}
            value={slotSectionId}
            onChange={setSlotSectionId}
          />
          <SelectField
            label="Teacher (optional)"
            options={[
              { value: "", label: "—" },
              ...instructors.map((i) => ({ value: i.id, label: i.instructor_name })),
            ]}
            value={slotInstructorId}
            onChange={setSlotInstructorId}
          />
          <SelectField
            label="Room (optional)"
            options={[
              { value: "", label: "—" },
              ...rooms.map((r) => ({ value: r.id, label: r.room_name })),
            ]}
            value={slotRoomId}
            onChange={setSlotRoomId}
          />
          <div className="flex flex-wrap gap-2 justify-between pt-2">
            {assignSlotId ? (
              <button type="button" onClick={clearSlot} className="text-sm text-red-700 hover:underline" disabled={saving}>
                Clear period
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setSlotModal(false)} className={btnSecondary} disabled={saving}>
                Cancel
              </button>
              <button type="submit" disabled={saving || !slotSubjectId} className={btnPrimary}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
