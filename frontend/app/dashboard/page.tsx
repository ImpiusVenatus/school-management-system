"use client";

import { useEffect, useState } from "react";
import { DataCard } from "@/components/ui/DataCard";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<{ students: number; teachers: number; guardians: number } | null>(null);
  const [recentNotices, setRecentNotices] = useState<Array<{ id: string; title: string; created_at: string }>>([]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api<unknown[]>("/api/students?limit=500", { token }).then((r) => ({ students: (r?.length ?? 0) })),
      api<unknown[]>("/api/instructors?limit=500", { token }).then((r) => ({ teachers: (r?.length ?? 0) })),
      api<unknown[]>("/api/guardians?limit=500", { token }).then((r) => ({ guardians: (r?.length ?? 0) })),
    ])
      .then(([s, t, g]) => setStats({ students: (s as { students: number }).students, teachers: (t as { teachers: number }).teachers, guardians: (g as { guardians: number }).guardians }))
      .catch(() => setStats({ students: 0, teachers: 0, guardians: 0 }));

    api<Array<{ id: string; title: string; created_at: string }>>("/api/notices?limit=5", { token })
      .then(setRecentNotices)
      .catch(() => setRecentNotices([]));
  }, [token]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DataCard
          title="Students"
          value={typeof stats?.students === "number" ? stats.students.toLocaleString() : "—"}
          icon={<span className="text-2xl">&#127891;</span>}
          iconBg="bg-[#7A4CFF]/10"
        />
        <DataCard
          title="Teachers"
          value={typeof stats?.teachers === "number" ? stats.teachers.toLocaleString() : "—"}
          icon={<span className="text-2xl">&#128104;</span>}
          iconBg="bg-[#4BC0C0]/20"
        />
        <DataCard
          title="Parents"
          value={typeof stats?.guardians === "number" ? stats.guardians.toLocaleString() : "—"}
          icon={<span className="text-2xl">&#128101;</span>}
          iconBg="bg-[#FF9F43]/20"
        />
        <DataCard
          title="Earnings"
          value="$ —"
          icon={<span className="text-2xl">&#128176;</span>}
          iconBg="bg-[#7DD39E]/20"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Exam Result (placeholder)</h2>
          <div className="h-64 flex items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-lg">
            Chart area
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Students – Gender (placeholder)</h2>
          <div className="h-64 flex items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-lg">
            Donut chart
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Star Students (placeholder)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">ID</th>
                  <th className="pb-2">Marks</th>
                  <th className="pb-2">Percent</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100"><td colSpan={4} className="py-4 text-center text-gray-400">No data</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity / Notices</h2>
          <ul className="space-y-3">
            {recentNotices.length === 0 ? (
              <li className="text-gray-400 text-sm">No notices yet.</li>
            ) : (
              recentNotices.map((n) => (
                <li key={n.id} className="flex items-start gap-3 text-sm">
                  <span className="rounded bg-[#4BC0C0]/20 p-1.5 text-[#4BC0C0]">&#128221;</span>
                  <div>
                    <p className="font-medium text-gray-900">{n.title}</p>
                    <p className="text-gray-500 text-xs">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
