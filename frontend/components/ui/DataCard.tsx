import { ReactNode } from "react";
import { Sparkline } from "./Sparkline";

interface DataCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
  showSparkline?: boolean;
}

export function DataCard({
  title,
  value,
  subtitle,
  icon,
  className = "",
  showSparkline = true,
}: DataCardProps) {
  return (
    <div
      className={`rounded-xl bg-white border border-[var(--border)] p-5 flex flex-col justify-between min-h-[7.5rem] ${className}`}
    >
      <p className="text-[11px] font-semibold tracking-wide text-[var(--muted-light)] uppercase">
        {title}
      </p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] tracking-tight">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-[var(--muted)] mt-1">{subtitle}</p>
          )}
        </div>
        <div className="flex items-end gap-2">
          {icon && (
            <div className="hidden sm:flex rounded-lg p-2 bg-[var(--primary-light)] text-[var(--muted)]">
              {icon}
            </div>
          )}
          {showSparkline && <Sparkline />}
        </div>
      </div>
    </div>
  );
}
