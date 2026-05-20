"use client";

import { useState } from "react";
import { Dropdown, type DropdownOption } from "./Dropdown";

export type { DropdownOption };

export const GENDER_OPTIONS: DropdownOption[] = [
  { value: "", label: "—" },
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];

export const RELATION_OPTIONS: DropdownOption[] = [
  { value: "", label: "—" },
  { value: "Father", label: "Father" },
  { value: "Mother", label: "Mother" },
  { value: "Guardian", label: "Guardian" },
  { value: "Other", label: "Other" },
];

function ChevronDown() {
  return (
    <svg className="w-4 h-4 shrink-0 text-[var(--muted-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function SelectField({
  label,
  labelClassName = "block text-sm font-medium text-gray-700 mb-1",
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
  triggerClassName = "",
  disabled = false,
  required = false,
}: {
  label?: string;
  labelClassName?: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? (value ? value : placeholder);

  return (
    <div className={className}>
      {label && (
        <label className={labelClassName}>
          {label}
          {required ? " *" : ""}
        </label>
      )}
      <Dropdown
        kind="select"
        open={open && !disabled}
        onOpenChange={(o) => !disabled && setOpen(o)}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full block"
        trigger={
          <button
            type="button"
            disabled={disabled}
            className={`w-full px-3 py-2 border border-[var(--border)] rounded-xl text-left text-sm flex items-center justify-between gap-2 hover:bg-gray-50/80 disabled:opacity-50 disabled:cursor-not-allowed ${
              !selected?.label && !value ? "text-[var(--muted-light)]" : "text-[var(--foreground)]"
            } ${triggerClassName}`}
          >
            <span className="truncate">{display}</span>
            <ChevronDown />
          </button>
        }
      />
    </div>
  );
}
