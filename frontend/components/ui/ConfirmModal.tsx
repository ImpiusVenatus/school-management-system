"use client";

import { Modal } from "./Modal";
import { btnPrimary, btnSecondary } from "@/lib/ui";

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger" | "warning";
  loading?: boolean;
}) {
  const confirmClass =
    variant === "danger"
      ? "py-2 px-4 rounded-xl bg-[var(--accent-red)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      : variant === "warning"
        ? "py-2 px-4 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        : btnPrimary;

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="text-sm text-[var(--muted)] leading-relaxed">{children}</div>
        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} disabled={loading} className={btnSecondary}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className={confirmClass}>
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
