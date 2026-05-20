"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

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

export default function SchedulePage() {
  const { token } = useAuth();
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
