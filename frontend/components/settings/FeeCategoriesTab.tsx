"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SelectField } from "@/components/ui/SelectField";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { TAB_META } from "@/components/settings/settings-nav";
import { api } from "@/lib/api";
import { useSchoolSettings } from "@/contexts/SchoolSettingsContext";
import { useSnackbar } from "@/contexts/SnackbarContext";
import { formatMoneyCompact } from "@/lib/currency";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/ui";

type YearOption = { id: string; academic_year_name: string; is_active: boolean };

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

type BoardItem = {
  class_id: string;
  class_name: string;
  structure_id: string | null;
  monthly_total: number;
  annual_total: number;
  student_count: number;
  item_count: number;
};

type StructureItem = {
  id?: string | null;
  fees_category_id: string | null;
  description: string | null;
  amount: number;
  frequency: string | null;
  due_day: string | null;
  yearly_amount?: number | null;
  category_code?: string | null;
  category_name?: string | null;
};

type FeeStructureDetail = {
  id: string;
  program_id: string;
  academic_year_id: string;
  class_name: string | null;
  student_count: number;
  annual_total: number;
  monthly_total: number;
  updated_at: string | null;
  components: StructureItem[];
};

type PaymentMethod = {
  id: string;
  name: string;
  method_type: string;
  provider: string | null;
  fee_note: string | null;
  is_enabled: boolean;
};

type DiscountRule = {
  id: string;
  name: string;
  discount_percent: number;
  criteria_type: string;
  criteria_label: string | null;
  auto_apply: boolean;
  is_enabled: boolean;
  student_count: number;
};

const FREQ_OPTIONS = [
  { value: "Monthly", label: "Monthly" },
  { value: "Quarterly", label: "Quarterly" },
  { value: "Yearly", label: "Yearly" },
  { value: "One time", label: "One time" },
  { value: "On demand", label: "On demand" },
  { value: "Penalty", label: "Penalty" },
];

function classSortKey(name: string) {
  const m = name.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 9999;
}

function sortBoard(rows: BoardItem[]) {
  return [...rows].sort((a, b) => classSortKey(a.class_name) - classSortKey(b.class_name));
}

function yearlyFromAmount(amount: number, frequency: string | null) {
  const f = (frequency || "Monthly").toLowerCase().replace(/-/g, " ");
  if (f === "monthly") return amount * 12;
  if (f === "quarterly") return amount * 4;
  return amount;
}

function displayStructureRef(className: string | null, yearLabel: string): string {
  const y = yearLabel.match(/\d{4}/)?.[0] ?? new Date().getFullYear().toString();
  const num = className?.match(/grade\s*(\d+)/i)?.[1] ?? className?.match(/(\d+)/)?.[1];
  const slug = num ? `G${num}` : (className?.replace(/\s+/g, "").slice(0, 6).toUpperCase() ?? "CLS");
  return `STR-${y}-${slug}`;
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function IconEdit({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L16.862 4.487" />
    </svg>
  );
}

function IconTrash({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

export function FeeCategoriesTab({
  token,
  years,
  activeYearId,
}: {
  token?: string | null;
  years: YearOption[];
  activeYearId: string | null;
}) {
  const snackbar = useSnackbar();
  const { formatMoney, currencyCode } = useSchoolSettings();
  const opts = { token: token ?? undefined };
  const meta = TAB_META["fee-categories"];

  const [yearId, setYearId] = useState(activeYearId || years[0]?.id || "");
  const [showArchived, setShowArchived] = useState(false);
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [allCategories, setAllCategories] = useState<FeeCategory[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [board, setBoard] = useState<BoardItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [structure, setStructure] = useState<FeeStructureDetail | null>(null);
  const [draftItems, setDraftItems] = useState<StructureItem[]>([]);
  const [structureBaseline, setStructureBaseline] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([]);

  const [loading, setLoading] = useState(true);
  const [structureLoading, setStructureLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [structureSaving, setStructureSaving] = useState(false);
  const [addingItem, setAddingItem] = useState(false);

  const [catModal, setCatModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FeeCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catCode, setCatCode] = useState("");
  const [catFreq, setCatFreq] = useState("Monthly");
  const [catTax, setCatTax] = useState("");
  const [catRefundable, setCatRefundable] = useState(false);

  const [payModal, setPayModal] = useState(false);
  const [payName, setPayName] = useState("");
  const [payType, setPayType] = useState("cash");
  const [payProvider, setPayProvider] = useState("");
  const [payFee, setPayFee] = useState("");

  const [ruleModal, setRuleModal] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [rulePercent, setRulePercent] = useState("10");
  const [ruleCriteria, setRuleCriteria] = useState("custom");

  const [deleteItemIdx, setDeleteItemIdx] = useState<number | null>(null);
  const [structureEditing, setStructureEditing] = useState(false);
  const [addItemModal, setAddItemModal] = useState(false);
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemCatId, setNewItemCatId] = useState("");
  const [newItemFreq, setNewItemFreq] = useState("Monthly");
  const [newItemDueDay, setNewItemDueDay] = useState("10");
  const [newItemAmount, setNewItemAmount] = useState("");

  type StructureLeaveAction =
    | { type: "class"; classId: string }
    | { type: "year"; yearId: string };
  type DiscardConfirmContext = { kind: "edit" } | { kind: "navigate"; action: StructureLeaveAction };
  const [discardConfirm, setDiscardConfirm] = useState<DiscardConfirmContext | null>(null);

  useEffect(() => {
    if (activeYearId && !yearId) setYearId(activeYearId);
  }, [activeYearId, yearId]);

  const loadCategories = useCallback(async () => {
    const rows = await api<FeeCategory[]>("/api/fees/categories", opts);
    setAllCategories(rows);
    const archived = rows.filter((c) => !c.is_active);
    setArchivedCount(archived.length);
    setCategories(showArchived ? archived : rows.filter((c) => c.is_active));
  }, [token, showArchived]);

  const loadBoard = useCallback(async () => {
    if (!yearId) return;
    const rows = await api<BoardItem[]>(`/api/fees/structures/board?academic_year_id=${yearId}`, opts);
    const sorted = sortBoard(rows);
    setBoard(sorted);
    setSelectedClassId((prev) =>
      prev && sorted.some((r) => r.class_id === prev) ? prev : sorted[0]?.class_id ?? null
    );
  }, [yearId, token]);

  const loadStructure = useCallback(
    async (classId: string) => {
      if (!yearId) return;
      setStructureLoading(true);
      try {
        const detail = await api<FeeStructureDetail>(
          `/api/fees/structures/by-class/${classId}?academic_year_id=${yearId}`,
          opts
        );
        setStructure(detail);
        setDraftItems(detail.components.map((c) => ({ ...c })));
        setStructureBaseline(JSON.stringify(detail.components));
        setStructureEditing(false);
      } catch {
        snackbar.error("Could not load fee structure");
        setStructure(null);
        setDraftItems([]);
      } finally {
        setStructureLoading(false);
      }
    },
    [yearId, token, snackbar]
  );

  const loadFinance = useCallback(async () => {
    const data = await api<{ payment_methods: PaymentMethod[]; discount_rules: DiscountRule[] }>(
      "/api/fees/finance-extras",
      opts
    );
    setPaymentMethods(data.payment_methods);
    setDiscountRules(data.discount_rules);
  }, [token]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadCategories(), loadBoard(), loadFinance()]);
    } catch {
      snackbar.error("Could not load fee settings");
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadBoard, loadFinance, snackbar]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadCategories();
  }, [showArchived, loadCategories]);

  useEffect(() => {
    if (yearId) loadBoard();
  }, [yearId, loadBoard]);

  useEffect(() => {
    if (selectedClassId) loadStructure(selectedClassId);
  }, [selectedClassId, loadStructure]);

  const activeCatsForPicker = allCategories.filter((c) => c.is_active);

  const structureDirty = structureBaseline !== JSON.stringify(draftItems);

  const draftAnnual = useMemo(() => {
    return draftItems.reduce((sum, it) => {
      const y = yearlyFromAmount(it.amount, it.frequency);
      return sum + y;
    }, 0);
  }, [draftItems]);

  function openNewCategoryModal() {
    setEditingCategory(null);
    setCatName("");
    setCatCode("");
    setCatFreq("Monthly");
    setCatTax("");
    setCatRefundable(false);
    setCatModal(true);
  }

  function openEditCategory(cat: FeeCategory) {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatCode(cat.code ?? "");
    setCatFreq(cat.default_frequency || "Monthly");
    setCatTax(cat.taxable_percent != null ? String(cat.taxable_percent) : "");
    setCatRefundable(cat.refundable);
    setCatModal(true);
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: catName.trim(),
      code: catCode.trim() || undefined,
      default_frequency: catFreq,
      taxable_percent: catTax ? parseFloat(catTax) : undefined,
      refundable: catRefundable,
    };
    try {
      if (editingCategory) {
        await api<FeeCategory>(`/api/fees/categories/${editingCategory.id}`, {
          ...opts,
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        snackbar.success("Category updated.");
      } else {
        await api<FeeCategory>("/api/fees/categories", {
          ...opts,
          method: "POST",
          body: JSON.stringify(payload),
        });
        snackbar.success("Category created.");
      }
      setCatModal(false);
      setEditingCategory(null);
      await loadCategories();
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategoryActive(cat: FeeCategory) {
    try {
      const updated = await api<FeeCategory>(`/api/fees/categories/${cat.id}`, {
        ...opts,
        method: "PATCH",
        body: JSON.stringify({ is_active: !cat.is_active }),
      });
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      await loadCategories();
    } catch {
      snackbar.error("Could not update category");
    }
  }

  function isTransientSaveError(err: unknown): boolean {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    return (
      msg.includes("internal server error") ||
      msg.includes("request failed") ||
      msg.includes("503") ||
      msg.includes("500") ||
      msg.includes("network") ||
      msg.includes("connection") ||
      msg.includes("ssl") ||
      msg.includes("fetch")
    );
  }

  async function saveStructure(attempt = 0) {
    if (!structure || structureSaving) return;
    setStructureSaving(true);
    try {
      const updated = await api<FeeStructureDetail>(`/api/fees/structures/${structure.id}`, {
        ...opts,
        method: "PATCH",
        body: JSON.stringify({
          components: draftItems.map((it) => ({
            id: it.id,
            fees_category_id: it.fees_category_id,
            description: it.description,
            amount: it.amount,
            frequency: it.frequency,
            due_day: it.due_day,
          })),
        }),
      });
      setStructure(updated);
      setDraftItems(updated.components.map((c) => ({ ...c })));
      setStructureBaseline(JSON.stringify(updated.components));
      setStructureEditing(false);
      await loadBoard();
      snackbar.success("Fee structure saved.");
    } catch (err) {
      if (attempt < 1 && isTransientSaveError(err)) {
        await new Promise((r) => setTimeout(r, 600));
        setStructureSaving(false);
        return saveStructure(1);
      }
      snackbar.error(
        isTransientSaveError(err)
          ? "Could not save — the database connection dropped. Your edits are still here; tap Save again."
          : err instanceof Error
            ? err.message
            : "Save failed"
      );
    } finally {
      setStructureSaving(false);
    }
  }

  function discardStructure() {
    setDraftItems(JSON.parse(structureBaseline) as StructureItem[]);
    setStructureEditing(false);
  }

  function applyStructureNavigate(action: StructureLeaveAction) {
    if (action.type === "class") {
      setStructureEditing(false);
      setSelectedClassId(action.classId);
    } else {
      setYearId(action.yearId);
      setStructureEditing(false);
    }
  }

  function requestStructureNavigate(action: StructureLeaveAction) {
    if (structureDirty) {
      setDiscardConfirm({ kind: "navigate", action });
      return;
    }
    if (structureEditing) setStructureEditing(false);
    applyStructureNavigate(action);
  }

  function openDiscardConfirm(context: DiscardConfirmContext) {
    setDiscardConfirm(context);
  }

  function confirmDiscardChanges() {
    const ctx = discardConfirm;
    discardStructure();
    setDiscardConfirm(null);
    if (ctx?.kind === "navigate") applyStructureNavigate(ctx.action);
  }

  function cancelStructureEdit() {
    if (!structureDirty) {
      setStructureEditing(false);
      return;
    }
    openDiscardConfirm({ kind: "edit" });
  }

  function resetNewItemForm(cat: FeeCategory) {
    setNewItemDesc(cat.name);
    setNewItemCatId(cat.id);
    setNewItemFreq(cat.default_frequency || "Monthly");
    setNewItemDueDay("10");
    setNewItemAmount("");
  }

  function openAddItemModal() {
    const firstCat = activeCatsForPicker[0] ?? categories[0];
    if (!firstCat) {
      snackbar.error("Add a fee category first.");
      return;
    }
    resetNewItemForm(firstCat);
    setAddItemModal(true);
  }

  function onNewItemCategoryChange(catId: string) {
    setNewItemCatId(catId);
    const cat = allCategories.find((c) => c.id === catId);
    if (cat) {
      setNewItemDesc(cat.name);
      setNewItemFreq(cat.default_frequency || "Monthly");
    }
  }

  async function submitNewItem(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(newItemAmount);
    if (!newItemDesc.trim() || !newItemCatId || Number.isNaN(amount) || amount < 0) {
      snackbar.error("Enter item name, category, and a valid amount.");
      return;
    }
    setAddingItem(true);
    try {
      const cat = allCategories.find((c) => c.id === newItemCatId);
      setDraftItems((prev) => [
        ...prev,
        {
          fees_category_id: newItemCatId,
          description: newItemDesc.trim(),
          amount,
          frequency: newItemFreq,
          due_day: newItemDueDay.trim() || "10",
          category_code: cat?.code ?? null,
          category_name: cat?.name ?? null,
        },
      ]);
      setStructureEditing(true);
      setAddItemModal(false);
      snackbar.success("Item added to the draft. Click Save to store on the server.");
    } finally {
      setAddingItem(false);
    }
  }

  function handleAddStructure() {
    if (!selectedClassId && board[0]) setSelectedClassId(board[0].class_id);
    openAddItemModal();
  }

  function updateItem(idx: number, patch: Partial<StructureItem>) {
    setDraftItems((prev) => {
      const next = [...prev];
      const row = { ...next[idx], ...patch };
      if (patch.fees_category_id) {
        const cat = allCategories.find((c) => c.id === patch.fees_category_id);
        if (cat) {
          row.description = cat.name;
          row.category_code = cat.code;
          row.category_name = cat.name;
          if (!row.frequency) row.frequency = cat.default_frequency;
        }
      }
      next[idx] = row;
      return next;
    });
  }

  async function cloneLastYear() {
    const prev = years.find((y) => y.id !== yearId);
    if (!yearId || !prev) {
      snackbar.error("Select a year with a previous year to clone from.");
      return;
    }
    if (!window.confirm(`Clone fee structures from ${prev.academic_year_name} to the selected year?`)) return;
    setSaving(true);
    try {
      const res = await api<{ cloned: number }>("/api/fees/structures/clone-year", {
        ...opts,
        method: "POST",
        body: JSON.stringify({
          from_academic_year_id: prev.id,
          to_academic_year_id: yearId,
        }),
      });
      snackbar.success(`Cloned ${res.cloned} structure(s).`);
      await loadBoard();
      if (selectedClassId) await loadStructure(selectedClassId);
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Clone failed");
    } finally {
      setSaving(false);
    }
  }

  async function togglePaymentMethod(pm: PaymentMethod) {
    try {
      const updated = await api<PaymentMethod>(`/api/fees/payment-methods/${pm.id}`, {
        ...opts,
        method: "PATCH",
        body: JSON.stringify({ is_enabled: !pm.is_enabled }),
      });
      setPaymentMethods((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch {
      snackbar.error("Could not update payment method");
    }
  }

  async function createPaymentMethod(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const row = await api<PaymentMethod>("/api/fees/payment-methods", {
        ...opts,
        method: "POST",
        body: JSON.stringify({
          name: payName.trim(),
          method_type: payType,
          provider: payProvider.trim() || undefined,
          fee_note: payFee.trim() || undefined,
        }),
      });
      setPaymentMethods((prev) => [...prev, row]);
      setPayModal(false);
      snackbar.success("Payment method added.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDiscountRule(rule: DiscountRule) {
    try {
      const updated = await api<DiscountRule>(`/api/fees/discount-rules/${rule.id}`, {
        ...opts,
        method: "PATCH",
        body: JSON.stringify({ is_enabled: !rule.is_enabled }),
      });
      setDiscountRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      snackbar.error("Could not update rule");
    }
  }

  async function createDiscountRule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const row = await api<DiscountRule>("/api/fees/discount-rules", {
        ...opts,
        method: "POST",
        body: JSON.stringify({
          name: ruleName.trim(),
          discount_percent: parseFloat(rulePercent) || 0,
          criteria_type: ruleCriteria,
          criteria_label: ruleCriteria.replace(/_/g, " "),
          auto_apply: true,
        }),
      });
      setDiscountRules((prev) => [...prev, row]);
      setRuleModal(false);
      snackbar.success("Discount rule added.");
    } catch (err) {
      snackbar.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const yearLabel = years.find((y) => y.id === yearId)?.academic_year_name || "—";

  return (
    <>
      <SettingsPageHeader
        title={meta.title}
        subtitle="Define what's billable, how much, and when. Fee structures attach categories to a class for an academic year."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} disabled title="Import coming soon">
              Import
            </button>
            <button type="button" onClick={openNewCategoryModal} className={btnPrimary}>
              + New category
            </button>
          </div>
        }
      />

      {/* Categories */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-sm text-[var(--muted)]">
          {showArchived
            ? `${archivedCount} archived`
            : `${categories.length} active${archivedCount > 0 ? ` · ${archivedCount} archived` : ""}`}
        </p>
        {archivedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            {showArchived ? "Hide archived" : "Manage archived"}
          </button>
        )}
      </div>

      <Card className="p-0 overflow-hidden mb-8">
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
                  <th className="text-left px-4 py-3">Default frequency</th>
                  <th className="text-left px-4 py-3">Taxable</th>
                  <th className="text-left px-4 py-3">Refundable</th>
                  <th className="text-left px-4 py-3">Used by</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border)] hover:bg-neutral-50/50">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.code ?? "—"}</td>
                    <td className="px-4 py-3">{c.default_frequency ?? "—"}</td>
                    <td className="px-4 py-3">
                      {c.taxable_percent != null ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-900">
                          {c.taxable_percent}% GST
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.refundable ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-800">
                          Refundable
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{c.structure_count} structures</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 text-xs ${c.is_active ? "text-emerald-700" : "text-[var(--muted)]"}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${c.is_active ? "bg-emerald-500" : "bg-neutral-300"}`}
                          />
                          {c.is_active ? "Active" : "Archived"}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={c.is_active}
                          onClick={() => toggleCategoryActive(c)}
                          className={`w-9 h-5 rounded-full relative ${c.is_active ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${c.is_active ? "left-4" : "left-0.5"}`}
                          />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEditCategory(c)}
                        className={`${btnSecondary} text-xs py-1.5 px-2.5`}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Fee structures */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Fee structures</h2>
          <p className="text-sm text-[var(--muted)] mt-1">
            <span className="font-medium text-[var(--foreground)]">{yearLabel}</span>
            <span className="mx-1.5">·</span>
            one structure per class
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <SelectField
            className="w-44"
            options={years.map((y) => ({ value: y.id, label: y.academic_year_name }))}
            value={yearId}
            onChange={(id) => requestStructureNavigate({ type: "year", yearId: id })}
            placeholder="Academic year"
          />
          <button type="button" onClick={cloneLastYear} className={btnSecondary} disabled={!yearId || saving}>
            Clone last year&apos;s
          </button>
          <button type="button" onClick={handleAddStructure} className={btnPrimary} disabled={!yearId || board.length === 0}>
            + Structure
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,280px)_1fr] gap-4 mb-8">
        <Card className="p-0 overflow-hidden border border-[var(--border)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
            Pick a class
          </p>
          <ul className="max-h-[520px] overflow-y-auto">
            {board.map((row) => {
              const selected = selectedClassId === row.class_id;
              const amountLabel =
                row.monthly_total > 0
                  ? `${formatMoney(row.monthly_total)} / mo`
                  : row.item_count > 0
                    ? `${formatMoney(row.annual_total)} / yr`
                    : "—";
              return (
                <li key={row.class_id}>
                  <button
                    type="button"
                    onClick={() => requestStructureNavigate({ type: "class", classId: row.class_id })}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 border-b border-[var(--border)] text-left transition-colors border-l-[3px] ${
                      selected
                        ? "border-l-neutral-900 bg-[var(--primary-light)]"
                        : "border-l-transparent hover:bg-neutral-50/80"
                    }`}
                  >
                    <span className="text-sm font-medium">{row.class_name}</span>
                    <span className="text-xs text-[var(--muted)] tabular-nums shrink-0">{amountLabel}</span>
                  </button>
                </li>
              );
            })}
            {board.length === 0 && !loading && (
              <li className="px-4 py-6 text-sm text-[var(--muted)]">
                No classes for {yearLabel}. Add classes under{" "}
                <Link href="/dashboard/settings?tab=classes" className="text-[var(--primary)] underline">
                  Classes & sections
                </Link>
                .
              </li>
            )}
          </ul>
        </Card>

        <Card className="p-5 min-h-[360px] border border-[var(--border)]">
          {structureLoading ? (
            <p className="text-sm text-[var(--muted)] py-12 text-center">Loading structure…</p>
          ) : !structure ? (
            <p className="text-sm text-[var(--muted)] py-12 text-center">Select a class to view its fee structure.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">
                    {structure.class_name} · {yearLabel}
                  </h3>
                  <p className="text-xs text-[var(--muted)] mt-1.5">
                    {displayStructureRef(structure.class_name, yearLabel)}
                    {structure.updated_at ? ` · last edited ${formatShortDate(structure.updated_at)}` : ""}
                    {structure.student_count > 0
                      ? ` · linked to ${structure.student_count} student${structure.student_count === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {structureEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={cancelStructureEdit}
                        disabled={structureSaving}
                        className={btnSecondary}
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveStructure()}
                        disabled={structureSaving || !structureDirty}
                        className={btnPrimary}
                      >
                        {structureSaving ? "Saving…" : "Save"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStructureEditing(true)}
                      className={`${btnSecondary} p-2.5`}
                      aria-label="Edit fee structure"
                    >
                      <IconEdit />
                    </button>
                  )}
                  <Link href="/dashboard/fees" className={btnSecondary}>
                    Generate invoices…
                  </Link>
                </div>
              </div>

              {structureDirty && (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2 mb-4">
                  You have unsaved changes on this class. Adding items only updates the draft — use{" "}
                  <span className="font-semibold">Save</span> to write them to the server.
                </p>
              )}

              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)] bg-neutral-50/60">
                      <th className="text-left px-4 py-2.5">Item</th>
                      <th className="text-left px-4 py-2.5">Category</th>
                      <th className="text-left px-4 py-2.5">Frequency</th>
                      <th className="text-left px-4 py-2.5">Due day</th>
                      <th className="text-right px-4 py-2.5">Amount</th>
                      <th className="text-right px-4 py-2.5">Yearly</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {draftItems.length === 0 && !structureEditing && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                          No fee items yet. Click Edit or + Add item to build this structure.
                        </td>
                      </tr>
                    )}
                    {draftItems.map((it, idx) => {
                      const catCode =
                        it.category_code ||
                        allCategories.find((c) => c.id === it.fees_category_id)?.code ||
                        "—";
                      const yearly = yearlyFromAmount(it.amount, it.frequency);
                      return (
                        <tr key={idx} className="border-t border-[var(--border)]">
                          {structureEditing ? (
                            <>
                              <td className="px-3 py-2">
                                <input
                                  value={it.description || ""}
                                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                                  className={`${inputClass} py-1.5 text-xs`}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <SelectField
                                  className="min-w-[100px]"
                                  options={activeCatsForPicker.map((c) => ({
                                    value: c.id,
                                    label: c.code || c.name,
                                  }))}
                                  value={it.fees_category_id || ""}
                                  onChange={(v) => updateItem(idx, { fees_category_id: v })}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <SelectField
                                  options={FREQ_OPTIONS}
                                  value={it.frequency || "Monthly"}
                                  onChange={(v) => updateItem(idx, { frequency: v })}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  value={it.due_day || ""}
                                  onChange={(e) => updateItem(idx, { due_day: e.target.value })}
                                  className={`${inputClass} py-1.5 text-xs w-16`}
                                  placeholder="10"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={it.amount}
                                  onChange={(e) => updateItem(idx, { amount: parseFloat(e.target.value) || 0 })}
                                  className={`${inputClass} py-1.5 text-xs w-28 text-right tabular-nums`}
                                />
                              </td>
                              <td className="px-4 py-2 text-right text-[var(--muted)] tabular-nums">
                                {formatMoney(yearly)}
                              </td>
                              <td className="px-2 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setDeleteItemIdx(idx)}
                                  className="p-1.5 text-[var(--muted)] hover:text-red-600 rounded"
                                  aria-label="Remove item"
                                >
                                  <IconTrash className="w-4 h-4" />
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-medium">{it.description || "—"}</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700">
                                  {catCode}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[var(--muted)]">{it.frequency || "—"}</td>
                              <td className="px-4 py-3 text-[var(--muted)] tabular-nums">{it.due_day || "—"}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{formatMoney(it.amount)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">
                                {formatMoney(yearly)}
                              </td>
                              <td className="px-2 py-3" />
                            </>
                          )}
                        </tr>
                      );
                    })}
                    {draftItems.length > 0 && (
                      <tr className="bg-[var(--primary-light)] border-t border-[var(--border)]">
                        <td colSpan={5} className="px-4 py-3 font-semibold">
                          Annual total
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{formatMoney(draftAnnual)}</td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-4">
                <button type="button" onClick={openAddItemModal} className={`${btnSecondary} text-sm`}>
                  + Add item
                </button>
                {draftItems.length > 0 && (
                  <p className="text-xs text-[var(--muted)]">
                    ~{formatMoney(draftAnnual)} / student / year
                    {structure.student_count > 0 ? (
                      <>
                        {" "}
                        · {formatMoneyCompact(draftAnnual * structure.student_count, currencyCode)} for{" "}
                        {structure.student_count} students
                      </>
                    ) : (
                      " · no enrolled students"
                    )}
                  </p>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Payment methods & discounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold">Payment methods</h4>
            <button type="button" onClick={() => setPayModal(true)} className={`${btnSecondary} text-xs`}>
              + Gateway
            </button>
          </div>
          <ul className="space-y-3">
            {paymentMethods.map((pm) => (
              <li key={pm.id} className="flex items-start justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
                <div>
                  <p className="text-sm font-medium">{pm.name}</p>
                  <p className="text-xs text-[var(--muted)]">{pm.fee_note || pm.provider || pm.method_type}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pm.is_enabled}
                  onClick={() => togglePaymentMethod(pm)}
                  className={`shrink-0 w-10 h-5 rounded-full relative ${pm.is_enabled ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${pm.is_enabled ? "left-5" : "left-0.5"}`}
                  />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold">Discount & scholarship rules</h4>
            <button type="button" onClick={() => setRuleModal(true)} className={`${btnSecondary} text-xs`}>
              + Rule
            </button>
          </div>
          <ul className="space-y-3">
            {discountRules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-start justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">
                    {rule.name}{" "}
                    <span className="text-[var(--muted)] font-normal">
                      ({rule.discount_percent}%)
                    </span>
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {rule.criteria_label ||
                      `${rule.criteria_type.replace(/_/g, " ")}${rule.auto_apply ? " · auto" : ""}`}
                    {rule.student_count > 0 ? ` · ${rule.student_count} students` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.is_enabled}
                  onClick={() => toggleDiscountRule(rule)}
                  className={`shrink-0 w-10 h-5 rounded-full relative ${rule.is_enabled ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${rule.is_enabled ? "left-5" : "left-0.5"}`}
                  />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Modal
        open={catModal}
        onClose={() => !saving && setCatModal(false)}
        title={editingCategory ? "Edit fee category" : "New fee category"}
        size="md"
      >
        <form onSubmit={saveCategory} className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              required
              placeholder="Tuition"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className={inputClass}
            />
          </div>
          <input
            type="text"
            placeholder="Code (TUI)"
            value={catCode}
            onChange={(e) => setCatCode(e.target.value)}
            className={inputClass}
          />
          <SelectField label="Default frequency" options={FREQ_OPTIONS} value={catFreq} onChange={setCatFreq} />
          <input
            type="number"
            placeholder="Tax % (optional)"
            value={catTax}
            onChange={(e) => setCatTax(e.target.value)}
            className={inputClass}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={catRefundable} onChange={(e) => setCatRefundable(e.target.checked)} />
            Refundable
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setCatModal(false)} className={btnSecondary} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : editingCategory ? "Save changes" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={payModal} onClose={() => setPayModal(false)} title="Add payment method" size="md">
        <form onSubmit={createPaymentMethod} className="space-y-4">
          <input
            type="text"
            required
            placeholder="Name"
            value={payName}
            onChange={(e) => setPayName(e.target.value)}
            className={inputClass}
          />
          <SelectField
            label="Type"
            options={[
              { value: "cash", label: "Cash" },
              { value: "upi", label: "UPI" },
              { value: "card", label: "Card" },
              { value: "bank", label: "Bank transfer" },
            ]}
            value={payType}
            onChange={setPayType}
          />
          <input
            type="text"
            placeholder="Provider (optional)"
            value={payProvider}
            onChange={(e) => setPayProvider(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Fee note"
            value={payFee}
            onChange={(e) => setPayFee(e.target.value)}
            className={inputClass}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setPayModal(false)} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              Add
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={ruleModal} onClose={() => setRuleModal(false)} title="Add discount rule" size="md">
        <form onSubmit={createDiscountRule} className="space-y-4">
          <input
            type="text"
            required
            placeholder="Rule name"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            className={inputClass}
          />
          <input
            type="number"
            min={0}
            max={100}
            placeholder="Discount %"
            value={rulePercent}
            onChange={(e) => setRulePercent(e.target.value)}
            className={inputClass}
          />
          <SelectField
            label="Criteria"
            options={[
              { value: "sibling_2nd", label: "2nd sibling" },
              { value: "sibling_3rd", label: "3rd+ sibling" },
              { value: "staff_child", label: "Staff child" },
              { value: "custom", label: "Custom" },
            ]}
            value={ruleCriteria}
            onChange={setRuleCriteria}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setRuleModal(false)} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              Add
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={addItemModal}
        onClose={() => !addingItem && setAddItemModal(false)}
        title="Add fee item"
        size="md"
      >
        <form onSubmit={(e) => void submitNewItem(e)} className="space-y-4">
          <p className="text-xs text-[var(--muted)] -mt-1">
            This adds a line to the draft only. Nothing is sent to the server until you click{" "}
            <span className="font-medium text-[var(--foreground)]">Save</span> on the fee structure.
          </p>
          <div>
            <label className={labelClass}>Item name</label>
            <input
              type="text"
              required
              value={newItemDesc}
              onChange={(e) => setNewItemDesc(e.target.value)}
              className={inputClass}
              placeholder="Tuition"
            />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <SelectField
              options={activeCatsForPicker.map((c) => ({
                value: c.id,
                label: c.code ? `${c.code} — ${c.name}` : c.name,
              }))}
              value={newItemCatId}
              onChange={onNewItemCategoryChange}
              placeholder="Select category"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Frequency</label>
              <SelectField options={FREQ_OPTIONS} value={newItemFreq} onChange={setNewItemFreq} />
            </div>
            <div>
              <label className={labelClass}>Due day</label>
              <input
                type="text"
                value={newItemDueDay}
                onChange={(e) => setNewItemDueDay(e.target.value)}
                className={inputClass}
                placeholder="10"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Amount</label>
            <input
              type="number"
              required
              min={0}
              step="0.01"
              value={newItemAmount}
              onChange={(e) => setNewItemAmount(e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setAddItemModal(false)}
              disabled={addingItem}
              className={btnSecondary}
            >
              Cancel
            </button>
            <button type="submit" disabled={addingItem} className={btnPrimary}>
              {addingItem ? "Adding…" : "Add to draft"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={discardConfirm !== null}
        onClose={() => setDiscardConfirm(null)}
        onConfirm={confirmDiscardChanges}
        title="Discard unsaved changes?"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        variant="warning"
      >
        <p>
          {discardConfirm?.kind === "navigate"
            ? "You have unsaved fee structure changes. Discarding will revert this class and you will lose those edits."
            : "Your edits to this fee structure have not been saved. Discarding will restore the last saved version."}
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={deleteItemIdx !== null}
        onClose={() => setDeleteItemIdx(null)}
        onConfirm={() => {
          if (deleteItemIdx !== null) {
            setDraftItems((prev) => prev.filter((_, i) => i !== deleteItemIdx));
            setStructureEditing(true);
          }
          setDeleteItemIdx(null);
        }}
        title="Remove fee item?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
      >
        <p>This line will be removed from the structure. Save the structure to apply the change permanently.</p>
      </ConfirmModal>
    </>
  );
}
