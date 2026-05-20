"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  SETTINGS_NAV,
  TAB_META,
  type SettingsTab,
} from "@/components/settings/settings-nav";

export function SettingsShell({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  schoolType?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolvedTab: SettingsTab =
    pathname.startsWith("/dashboard/settings/roles") ? "roles" : activeTab;
  const meta = TAB_META[resolvedTab];

  const goToTab = (tab: SettingsTab) => {
    const href = tab === "profile" ? "/dashboard/settings" : `/dashboard/settings?tab=${tab}`;
    router.push(href);
    onTabChange(tab);
  };

  const isActive = (tab: SettingsTab) => {
    return resolvedTab === tab || searchParams.get("tab") === tab;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 min-h-0">
      <nav className="lg:w-56 shrink-0">
        <p className="px-3 mb-3 text-[10px] font-semibold tracking-[0.14em] text-[var(--muted-light)] uppercase">
          Settings
        </p>
        <div className="space-y-5">
          {SETTINGS_NAV.map((group) => (
            <div key={group.heading}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-wide text-[var(--muted-light)] uppercase">
                {group.heading}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => goToTab(item.id)}
                        className={`w-full text-left px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                          active
                            ? "bg-[var(--primary)] text-white"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {item.label}
                        {item.placeholder && !active && (
                          <span className="ml-1 text-[10px] opacity-60">·</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 mx-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 hidden lg:block">
          <p className="text-[11px] font-medium text-emerald-700">All changes saved</p>
          <p className="text-[10px] text-[var(--muted)] mt-0.5">Settings sync on save</p>
        </div>
      </nav>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--muted)] mb-4">
          System / Settings / <span className="text-[var(--foreground)]">{meta.breadcrumb}</span>
        </p>
        {children}
      </div>
    </div>
  );
}

export type { SettingsTab };
