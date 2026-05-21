"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { api } from "@/lib/api";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass } from "@/lib/ui";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  from_time: string;
  to_time: string;
  subject_name: string;
  subject_code: string;
  section_name: string | null;
  instructor_name: string | null;
  room_name: string | null;
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
  sections: SectionSetup[];
};

type K12Subject = { id: string; name: string; code: string };
type Instructor = { id: string; instructor_name: string };
type Room = { id: string; room_name: string };

function fmtTime(t: string) {
  return t?.slice(0, 5) ?? "";
}

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
  const [addPassMarks, setAddPassMarks] = useState("40");

  const [slotModal, setSlotModal] = useState(false);
  const [slotDay, setSlotDay] = useState("0");
  const [slotFrom, setSlotFrom] = useState("09:00");
  const [slotTo, setSlotTo] = useState("09:45");
  const [slotSubjectId, setSlotSubjectId] = useState("");
  const [slotSectionId, setSlotSectionId] = useState("");
  const [slotInstructorId, setSlotInstructorId] = useState("");
  const [slotRoomId, setSlotRoomId] = useState("");

  const [editName, setEditName] = useState(className);
  const [editLevel, setEditLevel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, subs, inst, rms] = await Promise.all([
        api<ClassSetup>(`/api/k12/classes/${classId}/setup`, { token: token ?? undefined }),
        api<K12Subject[]>("/api/k12/subjects", { token: token ?? undefined }),
        api<Instructor[]>("/api/instructors?limit=200", { token: token ?? undefined }).catch(() => []),
        api<Room[]>("/api/rooms", { token: token ?? undefined }).catch(() => []),
      ]);
      setSetup(data);
      setEditName(data.name);
      setEditLevel(data.numeric_level != null ? String(data.numeric_level) : "");
      setAllSubjects(subs);
      setInstructors(inst.filter((i) => i.instructor_name));
      setRooms(rms);
    } catch {
      snackbarRef.current.error("Could not load class setup");
      setSetup(null);
    } finally {
      setLoading(false);
    }
  }, [classId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const unassignedSubjects = useMemo(() => {
    if (!setup) return allSubjects;
    const assigned = new Set(setup.subjects.map((s) => s.subject_id));
    return allSubjects.filter((s) => !assigned.has(s.id));
  }, [allSubjects, setup]);

  const slotsByDay = useMemo(() => {
    const map: TimetableSlot[][] = DAYS.map(() => []);
    if (!setup) return map;
    for (const slot of setup.timetable) {
      if (slot.day_of_week >= 0 && slot.day_of_week < 7) {
        map[slot.day_of_week].push(slot);
      }
    }
    return map;
  }, [setup]);

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
          pass_marks: parseInt(addPassMarks, 10) || 40,
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

  async function addSlot(e: React.FormEvent) {
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
          day_of_week: parseInt(slotDay, 10),
          from_time: slotFrom,
          to_time: slotTo,
        }),
      });
      setSetup((s) => (s ? { ...s, timetable: [...s.timetable, slot] } : s));
      setSlotModal(false);
      snackbarRef.current.success("Period added.");
    } catch (err) {
      snackbarRef.current.error(err instanceof Error ? err.message : "Failed to add period");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSlot(slotId: string) {
    try {
      await api(`/api/k12/timetable/${slotId}`, { token: token ?? undefined, method: "DELETE" });
      setSetup((s) => (s ? { ...s, timetable: s.timetable.filter((x) => x.id !== slotId) } : s));
      snackbarRef.current.success("Period removed.");
    } catch (err) {
      snackbarRef.current.error(err instanceof Error ? err.message : "Failed to delete");
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
    return <p className="text-sm text-[var(--muted)] py-4">Loading class setup…</p>;
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
                      Full {s.full_marks} · Pass {s.pass_marks}
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
            <form onSubmit={assignSubject} className="flex flex-wrap items-end gap-2 p-3 rounded-lg bg-neutral-50/80 border border-[var(--border)]">
              <SelectField
                label="Add subject"
                options={unassignedSubjects.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
                value={addSubjectId}
                onChange={setAddSubjectId}
                className="min-w-[12rem] flex-1"
              />
              <div>
                <label className="block text-xs font-medium mb-1">Full</label>
                <input type="number" value={addFullMarks} onChange={(e) => setAddFullMarks(e.target.value)} className={`${inputClass} w-20`} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Pass</label>
                <input type="number" value={addPassMarks} onChange={(e) => setAddPassMarks(e.target.value)} className={`${inputClass} w-20`} />
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
          <div className="flex justify-between items-center gap-2">
            <p className="text-sm text-[var(--muted)]">Weekly periods for {setup.name}</p>
            <button
              type="button"
              className={btnSecondary}
              disabled={setup.subjects.length === 0}
              onClick={() => {
                setSlotSubjectId(setup.subjects[0]?.subject_id ?? "");
                setSlotModal(true);
              }}
            >
              + Add period
            </button>
          </div>
          {setup.subjects.length === 0 && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Assign subjects first, then build the timetable.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {DAYS.map((day, di) => (
              <div key={day} className="rounded-lg border border-[var(--border)] p-3 min-h-[6rem]">
                <p className="text-xs font-semibold text-[var(--muted)] mb-2">{day}</p>
                {slotsByDay[di].length === 0 ? (
                  <p className="text-[11px] text-[var(--muted)]">—</p>
                ) : (
                  <ul className="space-y-2">
                    {slotsByDay[di].map((slot) => (
                      <li key={slot.id} className="text-xs rounded-md bg-white border border-[var(--border)] px-2 py-1.5">
                        <div className="flex justify-between gap-1">
                          <span className="font-medium">
                            {fmtTime(slot.from_time)}–{fmtTime(slot.to_time)}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteSlot(slot.id)}
                            className="cursor-pointer text-red-600 hover:underline"
                          >
                            ×
                          </button>
                        </div>
                        <p>{slot.subject_name}</p>
                        {(slot.section_name || slot.instructor_name || slot.room_name) && (
                          <p className="text-[var(--muted)]">
                            {[slot.section_name, slot.instructor_name, slot.room_name].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {panel === "settings" && (
        <div className="space-y-6">
          <form onSubmit={saveClassSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
            <div>
              <label className="block text-sm font-medium mb-1">Class name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} required />
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
          <div>
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

      <Modal open={slotModal} onClose={() => !saving && setSlotModal(false)} title="Add period" size="md">
        <form onSubmit={addSlot} className="space-y-3">
          <SelectField
            label="Day"
            options={DAYS.map((d, i) => ({ value: String(i), label: d }))}
            value={slotDay}
            onChange={setSlotDay}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">From</label>
              <input type="time" value={slotFrom} onChange={(e) => setSlotFrom(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">To</label>
              <input type="time" value={slotTo} onChange={(e) => setSlotTo(e.target.value)} className={inputClass} required />
            </div>
          </div>
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
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={() => setSlotModal(false)} className={btnSecondary} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !slotSubjectId} className={btnPrimary}>
              {saving ? "Adding…" : "Add period"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
