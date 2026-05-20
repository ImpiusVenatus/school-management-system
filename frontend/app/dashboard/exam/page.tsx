"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSnackbar } from "@/contexts/SnackbarContext";

type AssessmentPlan = {
  id: string;
  student_group_id: string;
  assessment_name: string;
  course_id: string | null;
  grading_scale_id: string | null;
  schedule_date: string | null;
  maximum_assessment_score: number | null;
};

type GradingScale = { id: string; grading_scale_name: string };
type StudentGroup = { id: string; student_group_name: string };
type Course = { id: string; course_name: string };
type GroupStudent = { student: string; student_name: string | null };
type PlanCriteria = { assessment_criteria_id: string; maximum_score: number };

export default function ExamPage() {
  const { token, hasPermission } = useAuth();
  const snackbar = useSnackbar();
  const [plans, setPlans] = useState<AssessmentPlan[]>([]);
  const [gradingScales, setGradingScales] = useState<GradingScale[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showMarks, setShowMarks] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [roster, setRoster] = useState<GroupStudent[]>([]);
  const [criteria, setCriteria] = useState<PlanCriteria[]>([]);
  const [marks, setMarks] = useState<Record<string, Record<string, number>>>({});
  const [planForm, setPlanForm] = useState({
    assessment_name: "",
    student_group_id: "",
    course_id: "",
    grading_scale_id: "",
    schedule_date: "",
    maximum_assessment_score: "100",
    assessment_group_id: "default",
  });
  const [saving, setSaving] = useState(false);

  const apiOpts = { token: token ?? undefined };

  function loadPlans() {
    api<AssessmentPlan[]>("/api/assessment/plans", apiOpts).then(setPlans).catch(() => setPlans([]));
  }

  useEffect(() => {
    loadPlans();
    api<GradingScale[]>("/api/assessment/grading-scales", apiOpts).then(setGradingScales).catch(() => {});
    api<StudentGroup[]>("/api/student-groups?limit=200", apiOpts).then(setGroups).catch(() => {});
    api<Course[]>("/api/courses?limit=200", apiOpts).then(setCourses).catch(() => {});
  }, [token]);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/assessment/plans", {
        ...apiOpts,
        method: "POST",
        body: JSON.stringify({
          ...planForm,
          maximum_assessment_score: parseFloat(planForm.maximum_assessment_score),
          assessment_criteria: [{ assessment_criteria_id: "default", maximum_score: parseFloat(planForm.maximum_assessment_score) }],
        }),
      });
      setShowPlanForm(false);
      loadPlans();
    } finally {
      setSaving(false);
    }
  }

  async function openMarkEntry(planId: string, groupId: string) {
    setSelectedPlan(planId);
    const students = await api<GroupStudent[]>(`/api/student-groups/${groupId}/students`, apiOpts);
    const crit = await api<PlanCriteria[]>(`/api/assessment/plans/${planId}/criteria`, apiOpts);
    setRoster(students);
    setCriteria(crit.length ? crit : [{ assessment_criteria_id: "default", maximum_score: 100 }]);
    setMarks({});
    setShowMarks(true);
  }

  async function saveMarks(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      for (const s of roster) {
        const details = criteria.map((c) => ({
          assessment_criteria_id: c.assessment_criteria_id,
          maximum_score: c.maximum_score,
          score: marks[s.student]?.[c.assessment_criteria_id] ?? 0,
        }));
        await api("/api/assessment/results", {
          ...apiOpts,
          method: "POST",
          body: JSON.stringify({
            assessment_plan_id: selectedPlan,
            student_id: s.student,
            details,
          }),
        });
      }
      setShowMarks(false);
      snackbar.success("Marks saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Exam / Assessment</h1>
        {hasPermission("exams.manage") && (
          <button type="button" onClick={() => setShowPlanForm(true)} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90">New Assessment Plan</button>
        )}
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Assessment plans</h2>
        {plans.length === 0 ? (
          <p className="text-gray-500">No assessment plans yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2">Name</th>
                <th className="pb-2">Section</th>
                <th className="pb-2">Date</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-2 font-medium">{p.assessment_name}</td>
                  <td className="py-2">{groups.find((g) => g.id === p.student_group_id)?.student_group_name ?? p.student_group_id}</td>
                  <td className="py-2">{p.schedule_date ?? "—"}</td>
                  <td className="py-2">
                    {hasPermission("marks.enter") && (
                      <button type="button" onClick={() => openMarkEntry(p.id, p.student_group_id)} className="text-[var(--foreground)] font-medium hover:underline text-xs">Enter marks</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Grading scales</h2>
        <div className="space-y-2">
          {gradingScales.map((gs) => (
            <p key={gs.id} className="text-sm">{gs.grading_scale_name}</p>
          ))}
        </div>
      </Card>

      <Modal open={showPlanForm} onClose={() => setShowPlanForm(false)} title="New Assessment Plan" size="lg">
        <form onSubmit={createPlan} className="space-y-4">
          <input type="text" value={planForm.assessment_name} onChange={(e) => setPlanForm({ ...planForm, assessment_name: e.target.value })} placeholder="Mid-Term 2026" required className="w-full px-3 py-2 border rounded-lg" />
          <SelectField
            label="Section"
            required
            options={groups.map((g) => ({ value: g.id, label: g.student_group_name }))}
            value={planForm.student_group_id}
            onChange={(v) => setPlanForm({ ...planForm, student_group_id: v })}
            placeholder="Select section"
          />
          <SelectField
            label="Course"
            required
            options={courses.map((c) => ({ value: c.id, label: c.course_name }))}
            value={planForm.course_id}
            onChange={(v) => setPlanForm({ ...planForm, course_id: v })}
            placeholder="Select course"
          />
          <SelectField
            label="Grading scale"
            required
            options={gradingScales.map((g) => ({ value: g.id, label: g.grading_scale_name }))}
            value={planForm.grading_scale_id}
            onChange={(v) => setPlanForm({ ...planForm, grading_scale_id: v })}
            placeholder="Select grading scale"
          />
          <input type="date" value={planForm.schedule_date} onChange={(e) => setPlanForm({ ...planForm, schedule_date: e.target.value })} required className="w-full px-3 py-2 border rounded-lg" />
          <input type="number" value={planForm.maximum_assessment_score} onChange={(e) => setPlanForm({ ...planForm, maximum_assessment_score: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          <button type="submit" disabled={saving} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90">Create</button>
        </form>
      </Modal>

      <Modal open={showMarks} onClose={() => setShowMarks(false)} title="Enter marks" size="xl">
        <form onSubmit={saveMarks}>
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="pb-2 text-left">Student</th>
                {criteria.map((c) => <th key={c.assessment_criteria_id} className="pb-2">{c.assessment_criteria_id}</th>)}
              </tr>
            </thead>
            <tbody>
              {roster.map((s) => (
                <tr key={s.student} className="border-b">
                  <td className="py-2">{s.student_name ?? s.student}</td>
                  {criteria.map((c) => (
                    <td key={c.assessment_criteria_id} className="py-2">
                      <input
                        type="number"
                        min={0}
                        max={c.maximum_score}
                        className="w-20 px-2 py-1 border rounded"
                        value={marks[s.student]?.[c.assessment_criteria_id] ?? ""}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setMarks((prev) => ({
                            ...prev,
                            [s.student]: { ...prev[s.student], [c.assessment_criteria_id]: v },
                          }));
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button type="submit" disabled={saving} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90">Save all</button>
        </form>
      </Modal>
    </div>
  );
}
