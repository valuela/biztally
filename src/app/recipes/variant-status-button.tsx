"use client";

import { Eye, EyeOff } from "lucide-react";
import { toggleRecipeVariantStatus } from "./actions";

export function VariantStatusButton({
  recipeId,
  variantId,
  variantName,
  isActive,
}: {
  recipeId: string;
  variantId: string;
  variantName: string;
  isActive: boolean;
}) {
  const action = toggleRecipeVariantStatus.bind(null, recipeId, variantId, isActive);
  const Icon = isActive ? EyeOff : Eye;

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const actionLabel = isActive ? "archive" : "reactivate";
        if (!window.confirm(`${actionLabel[0].toUpperCase()}${actionLabel.slice(1)} ${variantName}?`)) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
      >
        <Icon size={15} />
        {isActive ? "Archive" : "Reactivate"}
      </button>
    </form>
  );
}
