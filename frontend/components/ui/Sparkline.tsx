/** Minimal decorative sparkline for metric cards */
export function Sparkline({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 32"
      className={`w-20 h-8 text-neutral-300 ${className}`}
      fill="none"
      aria-hidden
    >
      <path
        d="M0 24 L12 18 L24 22 L36 10 L48 14 L60 8 L80 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
