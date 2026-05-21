"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { api } from "@/lib/api";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/ui";

type Department = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  subject_count: number;
};

export function DepartmentsTab({ token }: { token?: string | null }) {
  const snackbar = useSnackbar();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api<Department[]>("/api/academic/departments", { token: token ?? undefined });
      setDepartments(rows);
    } catch {
      snackbar.error("Could not load departments");
    } finally {
      setLoading(false);
    }
  }, [token, snackbar]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setCode("");
    setModal(true);
  }

  function openEdit(d: Department) {
    setEditing(d);
    setName(d.name);
    setCode(d.code ?? "");
    setModal(true);
  }

  async function saveDepartment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || undefined,
      };
      if (editing) {
        const updated = await api<Department>(`/api/academic/departments/${editing.id}`, {
          token: token ?? undefined,
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setDepartments((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d)).sort((a, b) => a.name.localeCompare(b.name))
        );
        snackbar.success("Department updated.");
      } else {
        const created = await api<Department>("/api/academic/departments", {
          token: token ?? undefined,
          method: "POST",
          body: JSON.stringify({ ...payload, is_active: true }),
        });
        setDepartments((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        snackbar.success("Department created.");
      }
      setModal(false);
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(d: Department) {
    try {
      const updated = await api<Department>(`/api/academic/departments/${d.id}`, {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({ is_active: !d.is_active }),
      });
      setDepartments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch {
      snackbar.error("Could not update");
    }
  }

  async function removeDepartment(d: Department) {
    if (!confirm(`Delete department "${d.name}"?`)) return;
    try {
      await api(`/api/academic/departments/${d.id}`, { token: token ?? undefined, method: "DELETE" });
      setDepartments((prev) => prev.filter((x) => x.id !== d.id));
      snackbar.success("Department deleted.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Cannot delete department");
    }
  }

  const meta = TAB_META.departments;
  const activeCount = departments.filter((d) => d.is_active).length;

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        actions={
          <button type="button" onClick={openCreate} className={btnPrimary}>
            + New department
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Card className="py-3 px-4">
          <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Total</p>
          <p className="text-xl font-bold mt-1">{departments.length}</p>
        </Card>
        <Card className="py-3 px-4">
          <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Active</p>
          <p className="text-xl font-bold mt-1">{activeCount}</p>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-[var(--muted)]">Loading…</p>
        ) : departments.length === 0 ? (
          <p className="p-6 text-sm text-[var(--muted)]">
            No departments yet. Create departments (e.g. Languages, STEM), then assign subjects under{" "}
            <strong>Subjects</strong>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase text-[var(--muted)] border-b bg-neutral-50/80">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Code</th>
                  <th className="text-left px-4 py-3">Subjects</th>
                  <th className="text-left px-4 py-3">Active</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--border)] last:border-0 hover:bg-neutral-50/50">
                    <td className="px-4 py-3 font-medium">{d.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{d.code ?? "—"}</td>
                    <td className="px-4 py-3">{d.subject_count}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={d.is_active}
                        onClick={() => toggleActive(d)}
                        className={`cursor-pointer w-10 h-5 rounded-full relative transition-colors ${
                          d.is_active ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                            d.is_active ? "left-5" : "left-0.5"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => openEdit(d)} className={`${btnSecondary} mr-2`}>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDepartment(d)}
                        disabled={d.subject_count > 0}
                        className="cursor-pointer text-xs text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={d.subject_count > 0 ? "Reassign subjects first" : "Delete"}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modal}
        onClose={() => !saving && setModal(false)}
        title={editing ? "Edit department" : "New department"}
        size="md"
      >
        <form onSubmit={saveDepartment} className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Code (optional)</label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} placeholder="STEM" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setModal(false)} className={btnSecondary} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : editing ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
