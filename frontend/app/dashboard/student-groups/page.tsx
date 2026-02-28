"use client";

import { Card } from "@/components/ui/Card";

export default function StudentGroupsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Class / Student Groups</h1>
      <Card>
        <p className="text-gray-500">Manage classes and student groups. Use the backend API at <code className="text-sm bg-gray-100 px-1">/api/student-groups</code> to list and edit.</p>
      </Card>
    </div>
  );
}
