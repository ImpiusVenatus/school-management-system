import { ReactNode } from "react";
import Link from "next/link";

export function DashboardCard({
  title,
  children,
  className = "",
  action,
  actionHref,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  actionHref?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-white border border-[var(--border)] p-5 sm:p-6 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
        {actionHref ? (
          <Link
            href={actionHref}
            className="text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            View all →
          </Link>
        ) : (
          action
        )}
      </div>
      {children}
    </div>
  );
}
