"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { AddStudentForm } from "@/components/forms/AddStudentForm";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const PAGE_SIZE = 50;

type Student = {
  id: string;
  student_name: string | null;
  student_email_id: string;
  first_name: string;
  last_name: string;
};

export default function AllStudentsPage() {
  const { token } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [totalFetched, setTotalFetched] = useState(0);
  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("skip", String(page * PAGE_SIZE));
    if (search.trim()) params.set("search", search.trim());
    api<Student[]>(`/api/students?${params.toString()}`, { token })
      .then((data) => {
        setStudents(data);
        setTotalFetched(data.length);
      })
      .catch(() => {
        setStudents([]);
        setTotalFetched(0);
      })
      .finally(() => setLoading(false));
  }, [token, page, search]);

  const hasMore = totalFetched >= PAGE_SIZE;
  const displayName = (s: Student) => (s.student_name ?? [s.first_name, s.last_name].filter(Boolean).join(" ")) || s.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">All Students</h1>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/students/by-class" className="text-[var(--foreground)] font-medium hover:underline font-medium">
            By Class
          </Link>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90"
          >
            Add Student
          </button>
        </div>
        <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Student" size="xl">
          <AddStudentForm
            onSuccess={() => {
              setAddModalOpen(false);
              setPage(0);
              if (token) {
                const params = new URLSearchParams();
                params.set("limit", String(PAGE_SIZE));
                params.set("skip", "0");
                api<Student[]>(`/api/students?${params.toString()}`, { token })
                  .then((data) => {
                    setStudents(data);
                    setTotalFetched(data.length);
                  })
                  .catch(() => {});
              }
            }}
            onCancel={() => setAddModalOpen(false)}
          />
        </Modal>
      </div>
      <Card>
        <div className="flex flex-wrap gap-4 mb-4">
          <input
            type="text"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg w-72 focus:ring-2 focus:ring-neutral-900/10 focus:border-[var(--border-strong)]"
          />
        </div>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">ID</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-gray-400">
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    students.map((s) => (
                      <tr key={s.id} className="border-b border-gray-100">
                        <td className="py-3 font-medium">{displayName(s)}</td>
                        <td className="py-3">{s.student_email_id}</td>
                        <td className="py-3">{s.id}</td>
                        <td className="py-3">
                          <Link href={`/dashboard/students/${s.id}`} className="text-[var(--foreground)] font-medium hover:underline">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + students.length}
                {hasMore ? " (load more with Next)" : ""}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || loading}
                  className="py-1.5 px-3 rounded-lg border border-gray-200 text-gray-700 disabled:opacity-50 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasMore || loading}
                  className="py-1.5 px-3 rounded-lg border border-gray-200 text-gray-700 disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
