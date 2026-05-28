"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/ui/PulsingDotsLoader";

type AcademicYearLite = { id: string; academic_year_name: string; is_active?: boolean };
type K12SectionRow = { id: string; name: string; capacity: number; student_count: number };
type K12ClassRow = { id: string; name: string; numeric_level: number | null; sections: K12SectionRow[] };
type EnrollmentRow = {
  id: string;
  student_id: string;
  student_name: string | null;
  roll_no: string | null;
  stream: string | null;
};

export default function StudentsByClassPage() {
  const { token, user, loading: authLoading } = useAuth();
  const [years, setYears] = useState<AcademicYearLite[]>([]);
  const [yearId, setYearId] = useState("");
  const [structure, setStructure] = useState<K12ClassRow[]>([]);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loadingYears, setLoadingYears] = useState(true);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);

  const apiOpts = { token: token ?? undefined };

  useEffect(() => {
    if (authLoading) return;
    if (!user && !token) {
      setLoadingYears(false);
      return;
    }
    setLoadingYears(true);
    api<AcademicYearLite[]>("/api/academic/years?include_counts=false", apiOpts)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setYears(list);
        const active = list.find((y) => y.is_active) ?? list[0];
        if (active && !yearId) setYearId(active.id);
      })
      .catch(() => setYears([]))
      .finally(() => setLoadingYears(false));
    // yearId intentionally excluded: we only auto-set once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, authLoading]);

  useEffect(() => {
    if (authLoading || (!user && !token)) return;
    if (!yearId) {
      setStructure([]);
      setClassId("");
      setSectionId("");
      setEnrollments([]);
      return;
    }
    setLoadingStructure(true);
    api<K12ClassRow[]>(`/api/k12/structure?academic_year_id=${encodeURIComponent(yearId)}`, apiOpts)
      .then((rows) => setStructure(Array.isArray(rows) ? rows : []))
      .catch(() => setStructure([]))
      .finally(() => setLoadingStructure(false));
    setClassId("");
    setSectionId("");
    setEnrollments([]);
  }, [token, user, authLoading, yearId]);

  useEffect(() => {
    if (!classId) {
      setSectionId("");
      setEnrollments([]);
      return;
    }
    setSectionId("");
    setEnrollments([]);
  }, [classId]);

  useEffect(() => {
    if (authLoading || (!user && !token)) return;
    if (!yearId || !sectionId) {
      setEnrollments([]);
      return;
    }
    setLoadingEnrollments(true);
    api<any[]>(
      `/api/k12/enrollments?academic_year_id=${encodeURIComponent(yearId)}&section_id=${encodeURIComponent(sectionId)}&include_students=true`,
      apiOpts
    )
      .then((rows) => {
        const list = (Array.isArray(rows) ? rows : []).map((r) => ({
          id: r.id,
          student_id: r.student_id,
          student_name: r.student_name ?? null,
          roll_no: r.roll_no ?? null,
          stream: r.stream ?? null,
        }));
        setEnrollments(list);
      })
      .catch(() => setEnrollments([]))
      .finally(() => setLoadingEnrollments(false));
  }, [token, user, authLoading, yearId, sectionId]);

  const selectedClass = useMemo(() => structure.find((c) => c.id === classId) ?? null, [structure, classId]);
  const needsStream = (selectedClass?.numeric_level ?? 0) >= 9;

  const yearOptions = useMemo(
    () => [{ value: "", label: "Select academic year…" }, ...years.map((y) => ({ value: y.id, label: y.academic_year_name }))],
    [years]
  );
  const classOptions = useMemo(
    () => [{ value: "", label: "Select class…" }, ...structure.map((c) => ({ value: c.id, label: c.name }))],
    [structure]
  );
  const sectionOptions = useMemo(() => {
    if (!selectedClass) return [{ value: "", label: "Select section…" }];
    return [{ value: "", label: "Select section…" }, ...(selectedClass.sections || []).map((s) => ({ value: s.id, label: s.name }))];
  }, [selectedClass]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Students by Class</h1>
        <Link href="/dashboard/students" className="text-sm font-medium text-[var(--foreground)] hover:underline">
          All Students
        </Link>
      </div>

      <Card>
        {authLoading ? (
          <PageLoader minHeight="min-h-[12rem]" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              {loadingYears ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : (
                <SelectField
                  label="Academic year"
                  options={yearOptions}
                  value={yearId}
                  onChange={setYearId}
                  placeholder="Select academic year"
                />
              )}
            </div>
            <div>
              {loadingStructure ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <p className="text-gray-500 text-sm py-2">Loading...</p>
                </>
              ) : (
                <SelectField
                  label="Class"
                  options={classOptions}
                  value={classId}
                  onChange={setClassId}
                  placeholder="Select class"
                />
              )}
            </div>
            <div>
              {!classId ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                  <p className="text-gray-500 text-sm py-2">Select a class first</p>
                </>
              ) : (
                <SelectField
                  label="Section"
                  options={sectionOptions}
                  value={sectionId}
                  onChange={setSectionId}
                  placeholder="Select section"
                />
              )}
            </div>
          </div>
        )}
      </Card>

      {selectedClass && sectionId && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedClass.name} → {selectedClass.sections.find((s) => s.id === sectionId)?.name ?? "Section"}
          </h2>
          {loadingEnrollments ? (
            <p className="text-gray-500">Loading students...</p>
          ) : enrollments.length === 0 ? (
            <p className="text-gray-500">No students in this section.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-4">#</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Roll</th>
                    {needsStream && <th className="pb-2">Stream</th>}
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((s, i) => (
                    <tr key={s.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4">{i + 1}</td>
                      <td className="py-2 font-medium">{s.student_name ?? s.student_id}</td>
                      <td className="py-2">{s.roll_no ?? "—"}</td>
                      {needsStream && <td className="py-2">{s.stream ?? "—"}</td>}
                      <td className="py-2">
                        <Link href={`/dashboard/students/${s.student_id}`} className="text-[var(--foreground)] hover:underline font-medium">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
