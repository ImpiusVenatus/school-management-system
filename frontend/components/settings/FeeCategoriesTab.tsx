"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { api } from "@/lib/api";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { btnPrimary, btnSecondary, inputClass } from "@/lib/ui";

type FeeCategory = {
  id: string;
  name: string;
  code: string | null;
  default_frequency: string | null;
  taxable_percent: number | null;
  refundable: boolean;
  is_active: boolean;
  structure_count: number;
};

const FREQ_OPTIONS = [
  { value: "Monthly", label: "Monthly" },
  { value: "Quarterly", label: "Quarterly" },
  { value: "Yearly", label: "Yearly" },
  { value: "One-time", label: "One-time" },
];

export function FeeCategoriesTab({ token }: { token?: string | null }) {
  const snackbar = useSnackbar();
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [frequency, setFrequency] = useState("Monthly");
  const [taxable, setTaxable] = useState("");
  const [refundable, setRefundable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api<FeeCategory[]>("/api/fees/categories", { token: token ?? undefined });
      setCategories(rows);
    } catch {
      snackbar.error("Could not load fee categories");
    } finally {
      setLoading(false);
    }
  }, [token, snackbar]);

  useEffect(() => {
    load();
  }, [load]);

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const row = await api<FeeCategory>("/api/fees/categories", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || undefined,
          default_frequency: frequency,
          taxable_percent: taxable ? parseFloat(taxable) : undefined,
          refundable,
        }),
      });
      setCategories((prev) => [...prev, row]);
      setModal(false);
      snackbar.success("Category created.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(cat: FeeCategory) {
    try {
      const updated = await api<FeeCategory>(`/api/fees/categories/${cat.id}`, {
        token: token ?? undefined,
        method: "PATCH",
        body: JSON.stringify({ is_active: !cat.is_active }),
      });
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch {
      snackbar.error("Could not update");
    }
  }

  const meta = TAB_META["fee-categories"];

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        actions={
          <button type="button" onClick={() => setModal(true)} className={btnPrimary}>
            + New category
          </button>
        }
      />

      <Card className="p-0 overflow-hidden mb-6">
        {loading ? (
          <p className="p-6 text-sm text-[var(--muted)]">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="p-6 text-sm text-[var(--muted)]">No fee categories. Add tuition, transport, etc.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase text-[var(--muted)] border-b bg-neutral-50/80">
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-left px-4 py-3">Code</th>
                  <th className="text-left px-4 py-3">Frequency</th>
                  <th className="text-left px-4 py-3">Tax</th>
                  <th className="text-left px-4 py-3">Refundable</th>
                  <th className="text-left px-4 py-3">Used in</th>
                  <th className="text-left px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border)] hover:bg-neutral-50/50">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.code ?? "—"}</td>
                    <td className="px-4 py-3">{c.default_frequency ?? "—"}</td>
                    <td className="px-4 py-3">{c.taxable_percent != null ? `${c.taxable_percent}%` : "—"}</td>
                    <td className="px-4 py-3">
                      {c.refundable ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-800">Refundable</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{c.structure_count} structures</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={c.is_active}
                        onClick={() => toggleActive(c)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${c.is_active ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${c.is_active ? "left-5" : "left-0.5"}`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-dashed">
          <h4 className="text-sm font-semibold mb-1">Fee structures by class</h4>
          <p className="text-sm text-[var(--muted)]">Link categories to classes per year — use Fees in the sidebar for schedules and invoices.</p>
        </Card>
        <Card className="border-dashed">
          <h4 className="text-sm font-semibold mb-1">Payment methods & discounts</h4>
          <p className="text-sm text-[var(--muted)]">Gateways and sibling discounts — coming in the next design pass.</p>
        </Card>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="New fee category" size="md">
        <form onSubmit={createCategory} className="space-y-4">
          <input type="text" required placeholder="Name (e.g. Tuition)" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          <input type="text" placeholder="Code (TUI)" value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          <SelectField label="Default frequency" options={FREQ_OPTIONS} value={frequency} onChange={setFrequency} />
          <input type="number" placeholder="Tax % (optional)" value={taxable} onChange={(e) => setTaxable(e.target.value)} className={inputClass} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={refundable} onChange={(e) => setRefundable(e.target.checked)} />
            Refundable
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setModal(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} className={btnPrimary}>{saving ? "Creating…" : "Create"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
