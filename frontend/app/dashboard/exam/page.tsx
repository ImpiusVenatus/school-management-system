"use client";

import { Card } from "@/components/ui/Card";

export default function ExamPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Exam / Assessment</h1>
      <Card>
        <p className="text-gray-500">Manage exams and assessments. Use the backend API at <code className="text-sm bg-gray-100 px-1">/api/assessment</code>.</p>
      </Card>
    </div>
  );
}
