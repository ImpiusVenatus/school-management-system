"use client";

import { useRef, useEffect } from "react";
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
}

export type DropdownProps = DropdownMenuProps | DropdownSelectProps;

const panelVariants = {
  closed: { opacity: 0, scale: 0.96, y: -4 },
  open: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: -4 },
};

export function Dropdown(props: DropdownProps) {
  const { open, onOpenChange, trigger, align = "left", className = "" } = props;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <div onClick={() => onOpenChange(!open)} className="cursor-pointer">
        {trigger}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial="closed"
            animate="open"
            exit="exit"
            variants={panelVariants}
            transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={`absolute z-50 mt-1 min-w-full w-full py-1 bg-white rounded-xl shadow-lg border border-[var(--border)] ${align === "right" ? "right-0" : "left-0"}`}
          >
            {props.kind === "menu" ? (
              props.children
            ) : (
              <ul className="max-h-60 overflow-auto">
                {props.placeholder && (
                  <li
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
            )}
          </motion.div>
        )}
      </AnimatePresence>
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
