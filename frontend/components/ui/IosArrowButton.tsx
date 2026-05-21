"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

function ChevronRightIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type IosArrowButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
};

/** Primary submit: centered label with iOS-style chevron beside the text (no circle). */
export function IosArrowButton({
  children,
  loading = false,
  loadingLabel = "Loading…",
  disabled,
  className = "",
  type = "submit",
  ...props
}: IosArrowButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`w-full py-3.5 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${className}`}
      {...props}
    >
      <span>{loading ? loadingLabel : children}</span>
      {loading ? (
        <span
          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0"
          aria-hidden
        />
      ) : (
        <ChevronRightIcon className="w-4 h-4 shrink-0" />
      )}
    </button>
  );
}
