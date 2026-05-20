"use client";

import { motion, AnimatePresence } from "framer-motion";

export type SnackbarVariant = "success" | "error" | "info" | "warning";

const variantStyles: Record<SnackbarVariant, string> = {
  success: "bg-[var(--foreground)] text-white",
  error: "bg-[var(--accent-red)] text-white",
  info: "bg-white text-[var(--foreground)] border border-[var(--border)]",
  warning: "bg-amber-50 text-amber-950 border border-amber-200",
};

export function Snackbar({
  message,
  variant = "info",
  open,
  onClose,
}: {
  message: string;
  variant?: SnackbarVariant;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && message && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[calc(100%-2rem)] sm:w-auto"
          role="status"
        >
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${variantStyles[variant]}`}
          >
            <span className="flex-1">{message}</span>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-1 rounded-lg opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
