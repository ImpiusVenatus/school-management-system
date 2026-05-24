"use client";

type Size = "sm" | "md";

const dotSize: Record<Size, string> = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
};

/** Three pulsing dots for inline loading indicators. */
export function PulsingDots({ size = "md", className = "" }: { size?: Size; className?: string }) {
  const dot = dotSize[size];
  return (
    <div className={`flex items-center justify-center gap-1.5 ${className}`} role="status" aria-label="Loading">
      <span className={`${dot} rounded-full bg-[var(--foreground)] pulsing-dot`} style={{ animationDelay: "0ms" }} />
      <span className={`${dot} rounded-full bg-[var(--foreground)] pulsing-dot`} style={{ animationDelay: "0.15s" }} />
      <span className={`${dot} rounded-full bg-[var(--foreground)] pulsing-dot`} style={{ animationDelay: "0.3s" }} />
    </div>
  );
}

/** Centered page-level loader (replaces "Loading…" copy). */
export function PageLoader({
  className = "",
  minHeight = "min-h-[40vh]",
}: {
  className?: string;
  minHeight?: string;
}) {
  return (
    <div className={`flex w-full items-center justify-center ${minHeight} ${className}`}>
      <PulsingDots size="md" />
    </div>
  );
}
