"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type Club = { id: string; name: string; description: string | null; academic_year_id: string | null; is_active: boolean };
type Moderator = { id: string; instructor_id: string; instructor_name: string | null; is_chief: boolean; academic_year_id: string };
type Member = { id: string; student_id: string; student_name: string | null; role: string; academic_year_id: string };
type Post = { id: string; title: string; body: string | null; created_at: string | null };

export default function ClubDetailPage() {
  const params = useParams();
  const { token } = useAuth();
  const id = params.id as string;
  const [club, setClub] = useState<Club | null>(null);
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [yearFilter, setYearFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !id) return;
    api<Club>("/api/clubs/" + id, { token })
      .then(setClub)
      .catch(() => setClub(null));
  }, [token, id]);

  useEffect(() => {
    if (!token || !id) return;
    const q = yearFilter ? "?academic_year_id=" + encodeURIComponent(yearFilter) : "";
    Promise.all([
      api<Moderator[]>("/api/clubs/" + id + "/moderators" + q, { token }).catch(() => []),
      api<Member[]>("/api/clubs/" + id + "/members" + q, { token }).catch(() => []),
      api<Post[]>("/api/clubs/" + id + "/posts" + q, { token }).catch(() => []),
    ]).then(([m, mb, p]) => {
      setModerators(Array.isArray(m) ? m : []);
      setMembers(Array.isArray(mb) ? mb : []);
      setPosts(Array.isArray(p) ? p : []);
    }).finally(() => setLoading(false));
  }, [token, id, yearFilter]);

  if (!club) return <div className="text-gray-500">Club not found. <Link href="/dashboard/clubs" className="text-[var(--foreground)] font-medium">Back</Link></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/clubs" className="text-gray-500 hover:text-gray-700">Back to Clubs</Link>
        <h1 className="text-2xl font-bold text-gray-900">{club.name}</h1>
      </div>
      {club.description && <p className="text-gray-600">{club.description}</p>}

      <div className="flex gap-2 items-center">
        <label className="text-sm font-medium text-gray-700">Academic year</label>
        <input type="text" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} placeholder="Filter by year" className="px-3 py-2 border rounded-lg w-40" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Moderators</h2>
          {loading ? <p className="text-gray-500">Loading...</p> : moderators.length === 0 ? <p className="text-gray-500">No moderators.</p> : (
            <ul className="space-y-2 text-sm">
              {moderators.map((m) => (
                <li key={m.id}>{m.instructor_name ?? m.instructor_id} {m.is_chief ? "(Chief)" : ""}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Members</h2>
          {loading ? <p className="text-gray-500">Loading...</p> : members.length === 0 ? <p className="text-gray-500">No members.</p> : (
            <ul className="space-y-2 text-sm">
              {members.map((m) => (
                <li key={m.id}>{m.student_name ?? m.student_id} – {m.role}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Posts</h2>
        {loading ? <p className="text-gray-500">Loading...</p> : posts.length === 0 ? <p className="text-gray-500">No posts.</p> : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="border-b border-gray-100 pb-2">
                <span className="font-medium">{p.title}</span>
                <p className="text-sm text-gray-600">{p.body ?? ""}</p>
                <p className="text-xs text-gray-400">{p.created_at ? new Date(p.created_at).toLocaleString() : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
