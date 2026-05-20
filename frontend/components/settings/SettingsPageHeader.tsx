"use client";

import { btnPrimary, btnSecondary } from "@/lib/ui";

export function SettingsPageHeader({
  title,
  subtitle,
  actions,
  onDiscard,
  onSave,
  saving,
  saveLabel = "Save changes",
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onDiscard?: () => void;
  onSave?: () => void;
  saving?: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--foreground)] tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {actions}
        {onDiscard && (
          <button type="button" onClick={onDiscard} className={btnSecondary} disabled={saving}>
            Discard
          </button>
        )}
        {onSave && (
          <button type="button" onClick={onSave} disabled={saving} className={btnPrimary}>
            {saving ? "Saving…" : saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}
