"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type Club = { id: string; name: string; description: string | null; academic_year_id: string | null; is_active: boolean };

export default function ClubsPage() {
  const { token } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api<Club[]>("/api/clubs?limit=100", { token })
      .then(setClubs)
      .catch(() => setClubs([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Clubs</h1>
      <Card>
        {loading ? <p className="text-gray-500">Loading...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Description</th>
                  <th className="pb-2">Year</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clubs.length === 0 ? <tr><td colSpan={5} className="py-4 text-gray-400">No clubs.</td></tr> : clubs.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-3 font-medium">{c.name}</td>
                    <td className="py-3 text-gray-600">{c.description ?? "—"}</td>
                    <td className="py-3">{c.academic_year_id ?? "—"}</td>
                    <td className="py-3">{c.is_active ? "Active" : "Inactive"}</td>
                    <td className="py-3"><Link href={"/dashboard/clubs/" + c.id} className="text-[#7A4CFF] hover:underline">View</Link></td>
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
