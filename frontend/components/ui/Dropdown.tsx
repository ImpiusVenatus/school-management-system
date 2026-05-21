"use client";

import { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

export type DropdownOption = { value: string; label: string };

interface DropdownPropsBase {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}

interface DropdownMenuProps extends DropdownPropsBase {
  kind: "menu";
  children: React.ReactNode;
}

interface DropdownSelectProps extends DropdownPropsBase {
  kind: "select";
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Render list in a portal above modals (avoids overflow clipping). Default true for selects. */
  portal?: boolean;
}

export type DropdownProps = DropdownMenuProps | DropdownSelectProps;

const panelVariants = {
  closed: { opacity: 0, scale: 0.96, y: -4 },
  open: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: -4 },
};

const PANEL_MAX_HEIGHT = 240;
const PORTAL_Z = 60;

type PanelCoords = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
};

function SelectOptionsList({
  props,
  onOpenChange,
}: {
  props: DropdownSelectProps;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ul className="max-h-60 overflow-auto">
      {props.placeholder && (
        <li
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            props.onChange("");
            onOpenChange(false);
          }}
          className="px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer"
        >
          {props.placeholder}
        </li>
      )}
      {props.options.map((opt) => (
        <li
          key={opt.value}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            props.onChange(opt.value);
            onOpenChange(false);
          }}
          className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-[var(--primary-light)] ${
            props.value === opt.value
              ? "bg-[var(--primary-light)] text-[var(--foreground)] font-medium"
              : "text-gray-700"
          }`}
        >
          {opt.label}
        </li>
      ))}
    </ul>
  );
}

function computePanelCoords(el: HTMLElement): PanelCoords {
  const rect = el.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp = spaceBelow < PANEL_MAX_HEIGHT + 12 && rect.top > spaceBelow;
  return {
    left: rect.left,
    width: rect.width,
    ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
  };
}

export function Dropdown(props: DropdownProps) {
  const { open, onOpenChange, trigger, align = "left", className = "" } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<PanelCoords | null>(null);
  const usePortal = props.kind === "select" && (props.portal ?? true);

  const refreshCoords = useCallback(() => {
    if (rootRef.current) {
      setCoords(computePanelCoords(rootRef.current));
    }
  }, []);

  useLayoutEffect(() => {
    if (!open || !usePortal) {
      setCoords(null);
      return;
    }
    refreshCoords();
    window.addEventListener("resize", refreshCoords);
    window.addEventListener("scroll", refreshCoords, true);
    return () => {
      window.removeEventListener("resize", refreshCoords);
      window.removeEventListener("scroll", refreshCoords, true);
    };
  }, [open, usePortal, refreshCoords]);

  useEffect(() => {
    if (!open) return;
    let removeListener: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      function handlePointerDown(e: PointerEvent) {
        const target = e.target as Node;
        if (rootRef.current?.contains(target)) return;
        if (panelRef.current?.contains(target)) return;
        onOpenChange(false);
      }
      document.addEventListener("pointerdown", handlePointerDown);
      removeListener = () => document.removeEventListener("pointerdown", handlePointerDown);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      removeListener?.();
    };
  }, [open, onOpenChange]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !open;
    if (next && usePortal && rootRef.current) {
      setCoords(computePanelCoords(rootRef.current));
    }
    onOpenChange(next);
  };

  const panelClass = `py-1 bg-white rounded-xl shadow-lg border border-[var(--border)] ${
    usePortal ? "" : `absolute z-50 mt-1 min-w-full w-full ${align === "right" ? "right-0" : "left-0"}`
  }`;

  const panelContent =
    props.kind === "menu" ? props.children : <SelectOptionsList props={props} onOpenChange={onOpenChange} />;

  const portalStyle: React.CSSProperties | undefined =
    usePortal && coords
      ? {
          position: "fixed",
          left: coords.left,
          width: coords.width,
          zIndex: PORTAL_Z,
          ...(coords.top != null ? { top: coords.top } : { bottom: coords.bottom }),
        }
      : undefined;

  const inlinePanel = (
    <motion.div
      ref={panelRef}
      initial="closed"
      animate="open"
      exit="exit"
      variants={panelVariants}
      transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={panelClass}
    >
      {panelContent}
    </motion.div>
  );

  const portalPanel = (
    <div ref={panelRef} className={panelClass} style={portalStyle} role="listbox">
      {panelContent}
    </div>
  );

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div onClick={handleTriggerClick} className="cursor-pointer">
        {trigger}
      </div>
      {usePortal ? (
        open && typeof document !== "undefined" && createPortal(portalPanel, document.body)
      ) : (
        <AnimatePresence>{open && inlinePanel}</AnimatePresence>
      )}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg mx-1 ${className}`}
    >
      {children}
    </button>
  );
}
