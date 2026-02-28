"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type Category = { id: string; name: string; slug: string | null; idx: number };
type Notice = { id: string; category_id: string; title: string; body: string | null; pinned: boolean; created_at: string | null };

export default function NoticesPage() {
  const { token, user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formCategory, setFormCategory] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formPinned, setFormPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const isAdmin = Boolean(user?.is_superuser || user?.role === "admin");

  useEffect(() => {
    if (!token) return;
    api<Category[]>("/api/notices/categories", { token }).then(setCategories).catch(() => setCategories([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (categoryId) params.set("category_id", categoryId);
    api<Notice[]>("/api/notices?" + params.toString(), { token })
      .then(setNotices)
      .catch(() => setNotices([]))
      .finally(() => setLoading(false));
  }, [token, categoryId]);

  async function createNotice(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !formCategory || !formTitle) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/notices", {
        token,
        method: "POST",
        body: JSON.stringify({ category_id: formCategory, title: formTitle, body: formBody || undefined, pinned: formPinned }),
      });
      setFormTitle("");
      setFormBody("");
      setFormPinned(false);
      setShowForm(false);
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (categoryId) params.set("category_id", categoryId);
      const list = await api<Notice[]>("/api/notices?" + params.toString(), { token });
      setNotices(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !newCategoryName.trim()) return;
    setSaving(true);
    try {
      await api("/api/notices/categories", { token, method: "POST", body: JSON.stringify({ name: newCategoryName.trim(), slug: null }) });
      setNewCategoryName("");
      setShowCategoryForm(false);
      const list = await api<Category[]>("/api/notices/categories", { token });
      setCategories(list);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Notices</h1>
        <div className="flex gap-2">
          {isAdmin && (
            <button type="button" onClick={() => setShowCategoryForm(true)} className="py-2 px-4 rounded-lg border border-gray-200">Add Category</button>
          )}
          <button type="button" onClick={() => setShowForm(true)} className="py-2 px-4 rounded-lg bg-[#7A4CFF] text-white font-medium">New Notice</button>
        </div>
      </div>

      <Card>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="px-3 py-2 border rounded-lg w-48">
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {loading ? <p className="text-gray-500">Loading...</p> : (
          <ul className="space-y-3">
            {notices.length === 0 ? <li className="text-gray-500">No notices.</li> : notices.map((n) => (
              <li key={n.id} className="border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  {n.pinned && <span className="text-amber-500 text-sm">Pinned</span>}
                  <span className="font-medium">{n.title}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{n.body ?? ""}</p>
                <p className="text-xs text-gray-400 mt-1">{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showForm && (
        <Card>
          <h3 className="font-semibold text-gray-900 mb-3">New Notice</h3>
          <form onSubmit={createNotice} className="space-y-3 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select required value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input type="text" required value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
              <textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} className="w-full px-3 py-2 border rounded-lg" rows={3} />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={formPinned} onChange={(e) => setFormPinned(e.target.checked)} />
              <span className="text-sm">Pinned</span>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="py-2 px-4 rounded-lg bg-[#7A4CFF] text-white disabled:opacity-50">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="py-2 px-4 rounded-lg border">Cancel</button>
            </div>
          </form>
        </Card>
      )}

      {showCategoryForm && isAdmin && (
        <Card>
          <h3 className="font-semibold text-gray-900 mb-3">New Category</h3>
          <form onSubmit={createCategory} className="flex gap-2 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="px-3 py-2 border rounded-lg w-64" />
            </div>
            <button type="submit" disabled={saving} className="py-2 px-4 rounded-lg bg-[#7A4CFF] text-white disabled:opacity-50">Add</button>
            <button type="button" onClick={() => setShowCategoryForm(false)} className="py-2 px-4 rounded-lg border">Cancel</button>
          </form>
        </Card>
      )}
    </div>
  );
}
