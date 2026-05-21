"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from "react";
import { Snackbar, type SnackbarVariant } from "@/components/ui/Snackbar";

type SnackbarContextType = {
  show: (message: string, variant?: SnackbarVariant, durationMs?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
};

const SnackbarContext = createContext<SnackbarContextType | null>(null);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [variant, setVariant] = useState<SnackbarVariant>("info");
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setOpen(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const show = useCallback(
    (msg: string, v: SnackbarVariant = "info", durationMs = 4000) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      setVariant(v);
      setOpen(true);
      timerRef.current = setTimeout(() => setOpen(false), durationMs);
    },
    []
  );

  const value = useMemo<SnackbarContextType>(
    () => ({
      show,
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error", 6000),
      info: (m) => show(m, "info"),
      warning: (m) => show(m, "warning", 6000),
    }),
    [show]
  );

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar message={message} variant={variant} open={open} onClose={dismiss} />
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error("useSnackbar must be used within SnackbarProvider");
  return ctx;
}
