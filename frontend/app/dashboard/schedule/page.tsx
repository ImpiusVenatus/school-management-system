"use client";

import { Card } from "@/components/ui/Card";

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Routine / Schedule</h1>
      <Card>
        <p className="text-gray-500">Manage course schedule and routine. Use the backend API at <code className="text-sm bg-gray-100 px-1">/api/course-schedule</code>.</p>
      </Card>
    </div>
  );
}
