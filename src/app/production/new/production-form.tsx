"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProductionRun } from "../actions";

type RecipeOption = {
  id: string;
  name: string;
  batch_yield: string | number;
  yield_unit: string;
  selling_price: string | number;
};

type VariantOption = {
  id: string;
  recipe_id: string;
  name: string;
  selling_price: string | number;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 gap-2" disabled={pending}>
      <Save size={16} />
      {pending ? "Saving..." : label}
    </Button>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: string | number | null | undefined) {
  if (value == null || value === "") return 0;
  return typeof value === "number" ? value : Number.parseFloat(value) || 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
}

export function ProductionForm({
  recipes,
  variants,
  defaultRecipeId,
  initialValue,
  action = createProductionRun,
  submitLabel = "Save production",
  cancelHref = "/production",
}: {
  recipes: RecipeOption[];
  variants: VariantOption[];
  defaultRecipeId?: string;
  initialValue?: {
    recipe_id: string;
    recipe_variant_id: string | null;
    production_date: string;
    quantity_produced: string | number;
    selling_price_per_unit: string | number;
    notes: string | null;
  };
  action?: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
  cancelHref?: string;
}) {
  const requestedRecipeId = initialValue?.recipe_id ?? defaultRecipeId;
  const initialRecipeId = requestedRecipeId && recipes.some((recipe) => recipe.id === requestedRecipeId) ? requestedRecipeId : recipes[0]?.id ?? "";
  const [recipeId, setRecipeId] = useState(initialRecipeId);
  const [variantId, setVariantId] = useState(initialValue?.recipe_id === initialRecipeId ? initialValue.recipe_variant_id ?? "" : "");
  const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);
  const recipeVariants = useMemo(() => variants.filter((variant) => variant.recipe_id === recipeId), [recipeId, variants]);
  const selectedVariant = recipeVariants.find((variant) => variant.id === variantId);
  const defaultQuantity =
    initialValue && initialValue.recipe_id === selectedRecipe?.id ? String(initialValue.quantity_produced) : selectedRecipe ? String(selectedRecipe.batch_yield) : "";
  const defaultSellingPrice =
    initialValue && initialValue.recipe_id === selectedRecipe?.id
      ? String(initialValue.selling_price_per_unit)
      : String(toNumber(selectedVariant?.selling_price) > 0 ? selectedVariant?.selling_price : selectedRecipe?.selling_price ?? "");
  const [quantityProduced, setQuantityProduced] = useState(defaultQuantity);
  const [sellingPricePerUnit, setSellingPricePerUnit] = useState(defaultSellingPrice);
  const expectedRevenue = toNumber(quantityProduced) * toNumber(sellingPricePerUnit);

  function applyRecipe(nextRecipeId: string) {
    const nextRecipe = recipes.find((recipe) => recipe.id === nextRecipeId);
    setRecipeId(nextRecipeId);
    setVariantId("");
    setQuantityProduced(nextRecipe ? String(nextRecipe.batch_yield) : "");
    setSellingPricePerUnit(nextRecipe ? String(nextRecipe.selling_price ?? "") : "");
  }

  function applyVariant(nextVariantId: string) {
    const nextVariant = variants.find((variant) => variant.id === nextVariantId);
    setVariantId(nextVariantId);
    setSellingPricePerUnit(String(toNumber(nextVariant?.selling_price) > 0 ? nextVariant?.selling_price : selectedRecipe?.selling_price ?? ""));
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="recipe_id">Recipe</Label>
          <select
            id="recipe_id"
            name="recipe_id"
            required
            value={recipeId}
            onChange={(event) => {
              applyRecipe(event.target.value);
            }}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            {recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipe_variant_id">Variant</Label>
          <select
            id="recipe_variant_id"
            name="recipe_variant_id"
            value={variantId}
            onChange={(event) => applyVariant(event.target.value)}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <option value="">Base recipe</option>
            {recipeVariants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="production_date">Production date</Label>
          <Input id="production_date" name="production_date" type="date" defaultValue={initialValue?.production_date ?? today()} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity_produced">Quantity produced</Label>
          <Input
            key={selectedRecipe?.id ?? "quantity"}
            id="quantity_produced"
            name="quantity_produced"
            inputMode="decimal"
            value={quantityProduced}
            onChange={(event) => setQuantityProduced(event.target.value)}
            required
          />
          <p className="text-xs text-[var(--muted)]">Usually the final pieces made, not ingredient quantity.</p>
        </div>

        <div className="space-y-2">
          <Label>Unit</Label>
          <div className="flex h-11 items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 text-sm text-[var(--muted)]">
            {selectedRecipe?.yield_unit ?? "pcs"}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="selling_price_per_unit">Selling price / unit</Label>
          <Input
            id="selling_price_per_unit"
            name="selling_price_per_unit"
            inputMode="decimal"
            value={sellingPricePerUnit}
            onChange={(event) => setSellingPricePerUnit(event.target.value)}
            required
          />
          <p className="text-xs text-[var(--muted)]">Defaults from recipe or variant, but can be changed for this batch.</p>
        </div>

        <div className="space-y-2">
          <Label>Expected revenue</Label>
          <div className="flex h-11 items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 text-sm font-semibold text-[var(--foreground)]">
            {formatMoney(expectedRevenue)}
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initialValue?.notes ?? ""}
            className="min-h-[96px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            placeholder="Example: made for weekend orders, small batch test, etc."
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Link
          href={cancelHref}
          className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-alt)]"
        >
          Cancel
        </Link>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
