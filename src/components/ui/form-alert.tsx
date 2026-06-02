import * as React from "react";
import { cn } from "@/lib/utils";

export function FormAlert({
  className,
  tone = "error",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: "error" | "info" }) {
  const toneClass = tone === "error"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--muted)]";

  return <div className={cn("rounded-[var(--radius-sm)] border px-3 py-2 text-sm", toneClass, className)} {...props} />;
}
