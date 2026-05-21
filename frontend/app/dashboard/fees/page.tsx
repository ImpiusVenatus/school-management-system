"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolSettings } from "@/contexts/SchoolSettingsContext";

type Invoice = { id: string; student_id: string; period_label: string; due_date: string; total: number; status: string };
type FeeStructure = { id: string; program_id: string; total_amount: number | null };

export default function FeesPage() {
  const { token, hasPermission } = useAuth();
  const { formatMoney } = useSchoolSettings();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [structureId, setStructureId] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [saving, setSaving] = useState(false);

  function loadInvoices() {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    api<Invoice[]>(`/api/invoices?${params.toString()}`, { token: token ?? undefined })
      .then(setInvoices)
      .catch(() => setInvoices([]));
  }

  useEffect(() => {
    api<FeeStructure[]>("/api/fees/structures", { token: token ?? undefined }).then(setStructures).catch(() => {});
    loadInvoices();
  }, [token, statusFilter]);

  async function generateInvoices(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/invoices/generate-from-structure", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({ fee_structure_id: structureId, period_label: periodLabel, due_date: dueDate }),
      });
      setShowGenerate(false);
      loadInvoices();
    } finally {
      setSaving(false);
    }
  }

  async function collectPayment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/invoices/payments", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({ invoice_id: payInvoiceId, amount: parseFloat(payAmount), method: "cash" }),
      });
      setShowPay(false);
      loadInvoices();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Fees & Invoices</h1>
        <div className="flex gap-2">
          {hasPermission("fees.manage") && (
            <button type="button" onClick={() => setShowGenerate(true)} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90">Generate Invoices</button>
          )}
          {hasPermission("payments.collect") && (
            <button type="button" onClick={() => setShowPay(true)} className="py-2 px-4 rounded-lg border text-sm">Collect Payment</button>
          )}
        </div>
      </div>
      <Card>
        <SelectField
          className="mb-4 max-w-xs"
          options={[
            { value: "", label: "All statuses" },
            { value: "pending", label: "Pending" },
            { value: "partial", label: "Partial" },
            { value: "paid", label: "Paid" },
            { value: "overdue", label: "Overdue" },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="All statuses"
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-gray-500 text-left">
              <th className="pb-2">Student</th>
              <th className="pb-2">Period</th>
              <th className="pb-2">Due</th>
              <th className="pb-2">Total</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b">
                <td className="py-2">{inv.student_id}</td>
                <td className="py-2">{inv.period_label}</td>
                <td className="py-2">{inv.due_date}</td>
                <td className="py-2 tabular-nums">{formatMoney(inv.total, { maximumFractionDigits: 2 })}</td>
                <td className="py-2 capitalize">{inv.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {structures.length > 0 && (
          <p className="text-xs text-gray-500 mt-4">{structures.length} fee structure(s) configured.</p>
        )}
      </Card>

      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Invoices">
        <form onSubmit={generateInvoices} className="space-y-4">
          <SelectField
            label="Fee structure"
            required
            options={structures.map((s) => ({
              value: s.id,
              label: `${s.id} (${s.total_amount != null ? formatMoney(s.total_amount) : "—"})`,
            }))}
            value={structureId}
            onChange={setStructureId}
            placeholder="Select fee structure"
          />
          <input type="text" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="Jan 2026" required className="w-full px-3 py-2 border rounded-lg" />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="w-full px-3 py-2 border rounded-lg" />
          <button type="submit" disabled={saving} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90">Generate</button>
        </form>
      </Modal>

      <Modal open={showPay} onClose={() => setShowPay(false)} title="Collect Payment">
        <form onSubmit={collectPayment} className="space-y-4">
          <input type="text" value={payInvoiceId} onChange={(e) => setPayInvoiceId(e.target.value)} placeholder="Invoice ID" required className="w-full px-3 py-2 border rounded-lg" />
          <input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Amount" required className="w-full px-3 py-2 border rounded-lg" />
          <button type="submit" disabled={saving} className="py-2 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90">Record payment</button>
        </form>
      </Modal>
    </div>
  );
}
