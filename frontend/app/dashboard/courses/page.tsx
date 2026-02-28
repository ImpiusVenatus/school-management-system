"use client";

import { Card } from "@/components/ui/Card";

export default function CoursesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Subject / Courses</h1>
      <Card>
        <p className="text-gray-500">Manage subjects and courses. Use the backend API at <code className="text-sm bg-gray-100 px-1">/api/courses</code> and <code className="text-sm bg-gray-100 px-1">/api/programs</code>.</p>
      </Card>
    </div>
  );
}
