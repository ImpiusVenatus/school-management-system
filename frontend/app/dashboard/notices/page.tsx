"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
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
  const categoryOptions = [{ value: "", label: "All" }, ...categories.map((c) => ({ value: c.id, label: c.name }))];

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
          <button type="button" onClick={() => setShowForm(true)} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90">New Notice</button>
        </div>
      </div>

      <Card>
        <div className="mb-4">
          <SelectField
            label="Category"
            options={categoryOptions}
            value={categoryId}
            onChange={setCategoryId}
            placeholder="All"
            triggerClassName="w-48"
          />
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

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Notice" size="md">
        <form onSubmit={createNotice} className="space-y-3">
          <div>
            <SelectField
              label="Category"
              required
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              value={formCategory}
              onChange={setFormCategory}
              placeholder="Select category"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input type="text" required value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-neutral-900/10" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
            <textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-neutral-900/10" rows={3} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formPinned} onChange={(e) => setFormPinned(e.target.checked)} />
            <span className="text-sm">Pinned</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving || !formCategory} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="py-2 px-4 rounded-lg border border-gray-200">Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal open={showCategoryForm && isAdmin} onClose={() => setShowCategoryForm(false)} title="New Category" size="sm">
        <form onSubmit={createCategory} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-neutral-900/10" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving || !newCategoryName.trim()} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">Add</button>
            <button type="button" onClick={() => setShowCategoryForm(false)} className="py-2 px-4 rounded-lg border border-gray-200">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
