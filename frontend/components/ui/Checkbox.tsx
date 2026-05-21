"use client";

import { InputHTMLAttributes, ReactNode, useId } from "react";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  boxClassName?: string;
};

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  id: idProp,
  disabled,
  className = "",
  boxClassName = "",
  ...rest
}: CheckboxProps) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <label
      htmlFor={id}
      className={`inline-flex items-start gap-2.5 cursor-pointer select-none rounded-md focus-within:outline-none focus-within:ring-2 focus-within:ring-neutral-900/15 ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
        {...rest}
      />
      <span
        aria-hidden
        className={`mt-0.5 shrink-0 w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-colors ${
          checked
            ? "bg-neutral-900 border-neutral-900"
            : "bg-white border-neutral-300"
        } ${boxClassName}`}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {(label || description) && (
        <span className="flex flex-col gap-0.5 min-w-0">
          {label && <span className="text-sm text-neutral-600 leading-snug">{label}</span>}
          {description && <span className="text-xs text-neutral-400 leading-snug">{description}</span>}
        </span>
      )}
    </label>
  );
}
