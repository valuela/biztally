"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSellableProduct } from "./actions";

type RecipeOption = {
  id: string;
  name: string;
};

type VariantOption = {
  id: string;
  recipe_id: string;
  name: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 gap-2" disabled={pending}>
      <Save size={16} />
      {pending ? "Saving..." : "Save product"}
    </Button>
  );
}

type ProductInitialValue = {
  name: string;
  sku: string | null;
  recipe_id: string;
  recipe_variant_id: string | null;
  units_per_package: string | number;
  package_label: string;
  selling_price: string | number;
  packaging_cost: string | number;
  notes: string | null;
};

export function ProductForm({
  recipes,
  variants,
  initialValue,
  action = createSellableProduct,
}: {
  recipes: RecipeOption[];
  variants: VariantOption[];
  initialValue?: ProductInitialValue;
  action?: (formData: FormData) => void | Promise<void>;
}) {
  const initialRecipeId = initialValue?.recipe_id && recipes.some((recipe) => recipe.id === initialValue.recipe_id) ? initialValue.recipe_id : recipes[0]?.id ?? "";
  const [recipeId, setRecipeId] = useState(initialRecipeId);
  const recipeVariants = useMemo(() => variants.filter((variant) => variant.recipe_id === recipeId), [recipeId, variants]);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="name">Product name</Label>
          <Input id="name" name="name" placeholder="Puto Tub - 6 pcs" defaultValue={initialValue?.name ?? ""} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" placeholder="PUTO-TUB-6" defaultValue={initialValue?.sku ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="package_label">Package label</Label>
          <Input id="package_label" name="package_label" placeholder="tub" defaultValue={initialValue?.package_label ?? "tub"} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipe_id">Recipe</Label>
          <select
            id="recipe_id"
            name="recipe_id"
            required
            value={recipeId}
            onChange={(event) => setRecipeId(event.target.value)}
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
            key={recipeId}
            id="recipe_variant_id"
            name="recipe_variant_id"
            defaultValue={initialValue?.recipe_id === recipeId ? initialValue.recipe_variant_id ?? "" : ""}
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
          <Label htmlFor="units_per_package">Pieces per package</Label>
          <Input id="units_per_package" name="units_per_package" inputMode="decimal" defaultValue={initialValue?.units_per_package ?? "6"} required />
          <p className="text-xs text-[var(--muted)]">Example: 6 pieces inside 1 tub.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="selling_price">Selling price per package</Label>
          <Input id="selling_price" name="selling_price" inputMode="decimal" placeholder="125" defaultValue={initialValue?.selling_price ?? ""} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="packaging_cost">Extra packaging cost</Label>
          <Input id="packaging_cost" name="packaging_cost" inputMode="decimal" defaultValue={initialValue?.packaging_cost ?? "0"} required />
          <p className="text-xs text-[var(--muted)]">Use this for the tub, sticker, spoon, or bag.</p>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initialValue?.notes ?? ""}
            className="min-h-[88px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            placeholder="Example: assorted tub, 6 pcs per tub, sold chilled."
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Link
          href="/products"
          className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-alt)]"
        >
          Cancel
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}
