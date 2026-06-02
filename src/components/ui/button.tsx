import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  void variant;
  const base =
    "inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50";
  const styles = "border-[var(--border)] !bg-[var(--primary)] !text-white hover:!bg-[var(--primary-hover)]";

  return <button className={cn(base, styles, className)} {...props} />;
}
