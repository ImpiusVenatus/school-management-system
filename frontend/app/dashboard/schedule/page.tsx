"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/ui/PulsingDotsLoader";
import { useSnackbar } from "@/contexts/SnackbarContext";

type Schedule = {
  id: string;
  student_group_id: string;
  instructor_id: string;
  instructor_name: string | null;
  course_id: string;
  schedule_date: string;
  from_time: string;
  to_time: string;
  room_id: string | null;
  title: string | null;
};

type StudentGroup = { id: string; student_group_name: string };
type Course = { id: string; course_name: string };
type Instructor = { id: string; instructor_name: string };
type Room = { id: string; room_name: string };

type AcademicYearLite = { id: string; academic_year_name: string; is_active?: boolean };
type K12SectionRow = { id: string; name: string; capacity: number; class_teacher_id?: string | null };
type K12StructureRow = { id: string; name: string; numeric_level: number | null; sections: K12SectionRow[] };
type TimetableSlot = {
  id: string;
  class_id: string;
  section_id: string | null;
  section_name: string | null;
  stream: string | null;
  subject_id: string;
  subject_name: string;
  instructor_id: string | null;
  instructor_name: string | null;
  room_name: string | null;
  day_of_week: number;
  period_index: number;
  from_time: string;
  to_time: string;
};
type ClassSetup = {
  id: string;
  name: string;
  numeric_level: number | null;
  academic_year_id: string;
  timetable_settings: {
    weekdays: number[];
    periods_per_day: number;
    start_time: string;
    period_minutes: number;
    break_after_period: number;
    break_minutes: number;
  };
  timetable: TimetableSlot[];
  sections: Array<{ id: string; name: string }>;
};

export default function SchedulePage() {
  const { token, user, loading: authLoading } = useAuth();
  const snackbar = useSnackbar();

  const [schoolType, setSchoolType] = useState<"program" | "k12">("program");

  // K12 routine state
  const [years, setYears] = useState<AcademicYearLite[]>([]);
  const [yearId, setYearId] = useState("");
  const [structure, setStructure] = useState<K12StructureRow[]>([]);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [streamFilter, setStreamFilter] = useState("");
  const [classSetup, setClassSetup] = useState<ClassSetup | null>(null);
  const [loadingK12, setLoadingK12] = useState(true);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formGroup, setFormGroup] = useState("");
  const [formCourse, setFormCourse] = useState("");
  const [formInstructor, setFormInstructor] = useState("");
  const [formRoom, setFormRoom] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formFrom, setFormFrom] = useState("09:00");
  const [formTo, setFormTo] = useState("10:00");
  const [formTitle, setFormTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadSchedules = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (groupFilter) params.set("student_group_id", groupFilter);
    api<Schedule[]>(`/api/course-schedules?${params.toString()}`, { token })
      .then(setSchedules)
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  }, [token, groupFilter]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api<StudentGroup[]>("/api/student-groups?limit=200", { token }),
      api<Course[]>("/api/courses?limit=200", { token }),
      api<Instructor[]>("/api/instructors?limit=200", { token }),
      api<Room[]>("/api/rooms?limit=200", { token }),
    ])
      .then(([g, c, i, r]) => {
        setGroups(g);
        setCourses(c);
        setInstructors(i);
        setRooms(r);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  // Determine school type
  useEffect(() => {
    if (authLoading) return;
    api<{ school_type?: string; current_academic_year_id?: string | null }>("/api/settings", { token: token ?? undefined })
      .then((s) => {
        const t = s.school_type === "k12" ? "k12" : "program";
        setSchoolType(t);
        if (s.current_academic_year_id && !yearId) setYearId(s.current_academic_year_id);
      })
      .catch(() => setSchoolType("program"));
    // yearId intentionally excluded (auto-set only once)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, token]);

  // Load K12 years + structure (for the selected year)
  useEffect(() => {
    if (schoolType !== "k12") return;
    if (authLoading) return;
    if (!user && !token) {
      setLoadingK12(false);
      return;
    }
    setLoadingK12(true);
    api<AcademicYearLite[]>("/api/academic/years?include_counts=false", { token: token ?? undefined })
      .then((rows) => setYears(Array.isArray(rows) ? rows : []))
      .catch(() => setYears([]));
  }, [schoolType, authLoading, user, token]);

  useEffect(() => {
    if (schoolType !== "k12") return;
    if (!yearId) {
      setStructure([]);
      setClassId("");
      setSectionId("");
      setClassSetup(null);
      setLoadingK12(false);
      return;
    }
    setLoadingK12(true);
    api<K12StructureRow[]>(`/api/k12/structure?academic_year_id=${encodeURIComponent(yearId)}`, { token: token ?? undefined })
      .then((rows) => setStructure(Array.isArray(rows) ? rows : []))
      .catch(() => setStructure([]))
      .finally(() => setLoadingK12(false));
  }, [schoolType, token, yearId]);

  useEffect(() => {
    if (schoolType !== "k12") return;
    if (!classId) {
      setClassSetup(null);
      return;
    }
    setLoadingK12(true);
    api<ClassSetup>(`/api/k12/classes/${encodeURIComponent(classId)}/setup`, { token: token ?? undefined })
      .then((d) => setClassSetup(d))
      .catch((err) => {
        setClassSetup(null);
        snackbar.error(err instanceof Error ? err.message : "Failed to load timetable");
      })
      .finally(() => setLoadingK12(false));
  }, [schoolType, token, classId, snackbar]);

  const yearOptions = useMemo(
    () => [{ value: "", label: "Select academic year…" }, ...years.map((y) => ({ value: y.id, label: y.academic_year_name }))],
    [years]
  );
  const classOptions = useMemo(
    () => [{ value: "", label: "Select class…" }, ...structure.map((c) => ({ value: c.id, label: c.name }))],
    [structure]
  );
  const selectedClass = useMemo(() => structure.find((c) => c.id === classId) ?? null, [structure, classId]);
  const sectionOptions = useMemo(() => {
    if (!selectedClass) return [{ value: "", label: "All sections" }];
    return [{ value: "", label: "All sections" }, ...(selectedClass.sections || []).map((s) => ({ value: s.id, label: s.name }))];
  }, [selectedClass]);
  const streamOptions = useMemo(
    () => [
      { value: "", label: "All streams" },
      { value: "Science", label: "Science" },
      { value: "Commerce", label: "Commerce" },
      { value: "Arts", label: "Arts" },
    ],
    []
  );

  const filteredSlots = useMemo(() => {
    const slots = classSetup?.timetable ?? [];
    return slots.filter((s) => {
      if (sectionId && s.section_id !== sectionId) return false;
      if (streamFilter && (s.stream || "") !== streamFilter) return false;
      return true;
    });
  }, [classSetup, sectionId, streamFilter]);

  async function createSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !formGroup || !formCourse || !formInstructor || !formRoom || !formDate) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/course-schedules", {
        token,
        method: "POST",
        body: JSON.stringify({
          student_group_id: formGroup,
          course_id: formCourse,
          instructor_id: formInstructor,
          room_id: formRoom,
          schedule_date: formDate,
          from_time: formFrom,
          to_time: formTo,
          title: formTitle || undefined,
        }),
      });
      setShowForm(false);
      loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (schoolType === "k12") {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Routine</h1>
          <p className="text-sm text-[var(--muted)]">Read-only view of the timetable configured in Settings.</p>
        </div>

        <Card>
          {authLoading || loadingK12 ? (
            <PageLoader minHeight="min-h-[12rem]" />
          ) : (
            <div className="flex flex-wrap gap-3">
              <SelectField
                label="Academic year"
                options={yearOptions}
                value={yearId}
                onChange={(v) => {
                  setYearId(v);
                  setClassId("");
                  setSectionId("");
                  setStreamFilter("");
                }}
                triggerClassName="min-w-[14rem]"
              />
              <SelectField
                label="Class"
                options={classOptions}
                value={classId}
                onChange={(v) => {
                  setClassId(v);
                  setSectionId("");
                  setStreamFilter("");
                }}
                triggerClassName="min-w-[14rem]"
              />
              <SelectField
                label="Section"
                options={sectionOptions}
                value={sectionId}
                onChange={setSectionId}
                placeholder="All sections"
                triggerClassName="min-w-[10rem]"
              />
              <SelectField
                label="Stream"
                options={streamOptions}
                value={streamFilter}
                onChange={setStreamFilter}
                placeholder="All streams"
                triggerClassName="min-w-[10rem]"
              />
            </div>
          )}
        </Card>

        <Card>
          {!classId ? (
            <p className="text-sm text-[var(--muted)]">Select a class to view its timetable.</p>
          ) : !classSetup ? (
            <p className="text-sm text-[var(--muted)]">No timetable found for this class.</p>
          ) : filteredSlots.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No timetable slots match the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2">Day</th>
                    <th className="pb-2">Period</th>
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Section</th>
                    <th className="pb-2">Stream</th>
                    <th className="pb-2">Subject</th>
                    <th className="pb-2">Teacher</th>
                    <th className="pb-2">Room</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSlots
                    .slice()
                    .sort((a, b) => (a.day_of_week - b.day_of_week) || (a.period_index - b.period_index))
                    .map((s) => (
                      <tr key={s.id} className="border-b border-gray-100">
                        <td className="py-2">
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][s.day_of_week] ?? String(s.day_of_week)}
                        </td>
                        <td className="py-2">{s.period_index + 1}</td>
                        <td className="py-2">{String(s.from_time).slice(0, 5)} – {String(s.to_time).slice(0, 5)}</td>
                        <td className="py-2">{s.section_name ?? "All"}</td>
                        <td className="py-2">{s.stream ?? "All"}</td>
                        <td className="py-2 font-medium">{s.subject_name}</td>
                        <td className="py-2">{s.instructor_name ?? "—"}</td>
                        <td className="py-2">{s.room_name ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Routine / Schedule</h1>
        <button type="button" onClick={() => setShowForm(true)} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90">
          Add Schedule
        </button>
      </div>

      <Card>
        <div className="mb-4">
          <SelectField
            label="Section"
            options={[{ value: "", label: "All sections" }, ...groups.map((g) => ({ value: g.id, label: g.student_group_name }))]}
            value={groupFilter}
            onChange={setGroupFilter}
            placeholder="All sections"
            triggerClassName="min-w-[12rem]"
          />
        </div>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : schedules.length === 0 ? (
          <p className="text-gray-500">No schedule entries. Add one using Add Schedule.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Section</th>
                  <th className="pb-2">Course</th>
                  <th className="pb-2">Instructor</th>
                  <th className="pb-2">Room</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="py-2">{s.schedule_date}</td>
                    <td className="py-2">{typeof s.from_time === "string" ? s.from_time.slice(0, 5) : ""} – {typeof s.to_time === "string" ? s.to_time.slice(0, 5) : ""}</td>
                    <td className="py-2">{groups.find((g) => g.id === s.student_group_id)?.student_group_name ?? s.student_group_id}</td>
                    <td className="py-2 font-medium">{courses.find((c) => c.id === s.course_id)?.course_name ?? s.course_id}</td>
                    <td className="py-2">{s.instructor_name ?? s.instructor_id}</td>
                    <td className="py-2">{rooms.find((r) => r.id === s.room_id)?.room_name ?? s.room_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Schedule" size="lg">
        <form onSubmit={createSchedule} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Section"
              required
              options={groups.map((g) => ({ value: g.id, label: g.student_group_name }))}
              value={formGroup}
              onChange={setFormGroup}
              placeholder="Select section"
            />
            <SelectField
              label="Course"
              required
              options={courses.map((c) => ({ value: c.id, label: c.course_name }))}
              value={formCourse}
              onChange={setFormCourse}
              placeholder="Select course"
            />
            <SelectField
              label="Instructor"
              required
              options={instructors.map((i) => ({ value: i.id, label: i.instructor_name }))}
              value={formInstructor}
              onChange={setFormInstructor}
              placeholder="Select instructor"
            />
            <SelectField
              label="Room"
              required
              options={rooms.map((r) => ({ value: r.id, label: r.room_name }))}
              value={formRoom}
              onChange={setFormRoom}
              placeholder="Select room"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
              <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input type="time" value={formFrom} onChange={(e) => setFormFrom(e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input type="time" value={formTo} onChange={(e) => setFormTo(e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="py-2 px-4 rounded-lg border">Cancel</button>
            <button type="submit" disabled={saving} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">{saving ? "Saving..." : "Create"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
