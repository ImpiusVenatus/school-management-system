"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type Student = {
  id: string;
  student_name: string | null;
  student_email_id: string;
  first_name: string;
  last_name: string;
  student_mobile_number?: string;
  date_of_birth?: string;
  gender?: string;
  guardians?: { guardian_name: string; relation?: string }[];
};

type Enrollment = {
  id: string;
  grade_level?: string;
  section_name?: string;
  student_advisor_name?: string;
  academic_year_id?: string;
};

export default function StudentDetailPage() {
  const params = useParams();
  const { token } = useAuth();
  const id = params.id as string;
  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !id) return;
    api<Student>(`/api/students/${id}`, { token })
      .then(setStudent)
      .catch(() => setStudent(null));
    api<Enrollment[]>(`/api/enrollments?student_id=${id}&limit=10`, { token })
      .then(setEnrollments)
      .catch(() => setEnrollments([]))
      .finally(() => setLoading(false));
  }, [token, id]);

  if (loading && !student) {
    return <div className="text-gray-500">Loading...</div>;
  }
  if (!student) {
    return (
      <div className="text-gray-500">
        Student not found. <Link href="/dashboard/students" className="text-[#7A4CFF]">Back to list</Link>
      </div>
    );
  }

  const currentEnrollment = enrollments[0];
  const displayName = student.student_name ?? `${student.first_name} ${student.last_name}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/students" className="text-gray-500 hover:text-gray-700">
          Back to Students
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">ID</dt>
              <dd className="font-medium">{student.id}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd>{student.student_email_id}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Mobile</dt>
              <dd>{student.student_mobile_number ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Date of birth</dt>
              <dd>{student.date_of_birth ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Gender</dt>
              <dd>{student.gender ?? "—"}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current enrollment</h2>
          {currentEnrollment ? (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Grade</dt>
                <dd>{currentEnrollment.grade_level ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Section</dt>
                <dd>{currentEnrollment.section_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Advisor</dt>
                <dd>{currentEnrollment.student_advisor_name ?? "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-gray-500">No enrollment record.</p>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Guardians</h2>
        {student.guardians && student.guardians.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {student.guardians.map((g, i) => (
              <li key={i}>
                {g.guardian_name} {g.relation ? `(${g.relation})` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No guardians linked.</p>
        )}
      </Card>
    </div>
  );
}
