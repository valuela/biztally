import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-medium text-[var(--foreground)]",
        className
      )}
      {...props}
    />
  );
}
