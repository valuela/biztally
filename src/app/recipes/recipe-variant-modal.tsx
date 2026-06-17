"use client";

import { Pencil, Plus, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { updateRecipeVariant } from "./actions";
import { RecipeVariantForm, type RecipeVariantFormInitialValue } from "./recipe-variant-form";

type InventoryOption = {
  id: string;
  name: string;
  brand_name: string | null;
  unit: string;
  cost_per_unit: string | number;
  recipe_density_grams_per_cup: string | number | null;
};

export function RecipeVariantModal({
  recipeId,
  inventoryItems,
  currency,
  variantId,
  initialVariant,
  triggerLabel = "Add variant",
}: {
  recipeId: string;
  inventoryItems: InventoryOption[];
  currency: string;
  variantId?: string;
  initialVariant?: RecipeVariantFormInitialValue;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const isEdit = Boolean(variantId && initialVariant);
  const action = isEdit && variantId ? updateRecipeVariant.bind(null, recipeId, variantId) : undefined;

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
      >
        {isEdit ? <Pencil size={16} /> : <Plus size={16} />}
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button className="absolute inset-0 cursor-default" aria-label="Close variant modal" onClick={() => setOpen(false)} />
          <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)] sm:max-w-4xl sm:rounded-[var(--radius-lg)]">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
              <div>
                <h2 id={titleId} className="text-lg font-semibold">{isEdit ? "Edit recipe variant" : "Add recipe variant"}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Add only the topping or ingredient difference from the base recipe.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 sm:p-5">
              <RecipeVariantForm
                recipeId={recipeId}
                inventoryItems={inventoryItems}
                currency={currency}
                action={action}
                initialVariant={initialVariant}
                submitLabel={isEdit ? "Save changes" : "Add variant"}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
