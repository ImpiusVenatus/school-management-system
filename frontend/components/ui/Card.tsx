import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-white p-6 border border-[var(--border)] ${className}`}
    >
      {children}
    </div>
  );
}
