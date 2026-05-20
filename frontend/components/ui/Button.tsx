import { ButtonHTMLAttributes } from "react";
import { btnDanger, btnPrimary, btnSecondary } from "@/lib/ui";

type Variant = "primary" | "secondary" | "danger";

const variants: Record<Variant, string> = {
  primary: btnPrimary,
  secondary: btnSecondary,
  danger: btnDanger,
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button type="button" className={`${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
