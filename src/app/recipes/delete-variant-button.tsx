"use client";

import { Trash2 } from "lucide-react";
import { deleteRecipeVariant } from "./actions";

export function DeleteVariantButton({
  recipeId,
  variantId,
  variantName,
}: {
  recipeId: string;
  variantId: string;
  variantName: string;
}) {
  const action = deleteRecipeVariant.bind(null, recipeId, variantId);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Delete ${variantName}? This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        <Trash2 size={15} />
        Delete
      </button>
    </form>
  );
}
