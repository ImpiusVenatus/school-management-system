"use client";

import { Card } from "@/components/ui/Card";
import type { SettingsTab } from "@/components/settings/settings-nav";
import { TAB_META } from "@/components/settings/settings-nav";

export function SettingsPlaceholder({ tab }: { tab: SettingsTab }) {
  const meta = TAB_META[tab];
  return (
    <Card className="border-dashed">
      <div className="py-12 px-6 text-center max-w-md mx-auto">
        <p className="text-sm font-semibold text-[var(--foreground)] mb-2">{meta.title}</p>
        <p className="text-sm text-[var(--muted)] mb-6">{meta.subtitle}</p>
        <span className="inline-block text-xs font-medium px-3 py-1.5 rounded-full bg-[var(--primary-light)] text-[var(--muted)]">
          Coming soon — design in progress
        </span>
      </div>
    </Card>
  );
}
