"use client";

import Link from "next/link";
import { Plus, Save, Trash2 } from "lucide-react";
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

type ProductComponent = {
  recipe_id: string;
  recipe_variant_id: string | null;
  units_per_package: string | number;
};

type ProductType = "single" | "assorted";

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
  product_type?: ProductType;
  sellable_product_components?: ProductComponent[];
};

function defaultComponent(recipeId: string, units: string | number = "1"): ProductComponent {
  return {
    recipe_id: recipeId,
    recipe_variant_id: null,
    units_per_package: units,
  };
}

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
  const initialProductType = initialValue?.product_type ?? "single";
  const initialComponents =
    initialValue?.sellable_product_components && initialValue.sellable_product_components.length > 0
      ? initialValue.sellable_product_components
      : [defaultComponent(initialRecipeId, initialValue?.units_per_package ?? "6")];
  const [productType, setProductType] = useState<ProductType>(initialProductType);
  const [recipeId, setRecipeId] = useState(initialRecipeId);
  const [components, setComponents] = useState<ProductComponent[]>(
    productType === "assorted" ? initialComponents : [defaultComponent(initialRecipeId, initialValue?.units_per_package ?? "6")]
  );
  const [singleUnitsPerPackage, setSingleUnitsPerPackage] = useState(String(initialValue?.units_per_package ?? "6"));
  const recipeVariants = useMemo(() => variants.filter((variant) => variant.recipe_id === recipeId), [recipeId, variants]);
  const totalComponentUnits = components.reduce((total, component) => total + (Number(component.units_per_package) || 0), 0);

  function variantsForRecipe(nextRecipeId: string) {
    return variants.filter((variant) => variant.recipe_id === nextRecipeId);
  }

  function updateComponent(index: number, patch: Partial<ProductComponent>) {
    setComponents((current) => current.map((component, currentIndex) => (currentIndex === index ? { ...component, ...patch } : component)));
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="name">Product name</Label>
          <Input id="name" name="name" placeholder="Assorted Puto Tub - 6 pcs" defaultValue={initialValue?.name ?? ""} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" placeholder="PUTO-ASSORTED-6" defaultValue={initialValue?.sku ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="package_label">Package label</Label>
          <Input id="package_label" name="package_label" placeholder="tub" defaultValue={initialValue?.package_label ?? "tub"} required />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Product type</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["single", "Single variant", "Example: 6 pcs Eden cheese in one tub."],
              ["assorted", "Assorted", "Example: 3 pcs Eden + 3 pcs Salted Egg."],
            ].map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  const nextType = value as ProductType;
                  setProductType(nextType);
                  if (nextType === "single") {
                    setComponents([defaultComponent(recipeId, singleUnitsPerPackage || "6")]);
                  } else if (components.length < 2) {
                    setComponents([defaultComponent(recipeId, "3"), defaultComponent(recipeId, "3")]);
                  }
                }}
                className={`rounded-[var(--radius-md)] border p-4 text-left transition-colors ${
                  productType === value
                    ? "border-[var(--primary)] bg-blue-50 text-[var(--foreground)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                }`}
              >
                <span className="block font-semibold">{label}</span>
                <span className="mt-1 block text-sm text-[var(--muted)]">{description}</span>
              </button>
            ))}
          </div>
          <input type="hidden" name="product_type" value={productType} />
        </div>

        {productType === "single" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="recipe_id">Recipe</Label>
              <select
                id="recipe_id"
                name="recipe_id"
                required
                value={recipeId}
                onChange={(event) => {
                  setRecipeId(event.target.value);
                  setComponents([defaultComponent(event.target.value, singleUnitsPerPackage || "6")]);
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
          </>
        ) : (
          <div className="space-y-3 md:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label>Assorted contents</Label>
                <p className="mt-1 text-sm text-[var(--muted)]">Define how many pieces of each recipe or variant go inside one package.</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={() => setComponents((current) => [...current, defaultComponent(recipes[0]?.id ?? "", "1")])}
              >
                <Plus size={16} />
                Add component
              </Button>
            </div>

            <input type="hidden" name="recipe_id" value={components[0]?.recipe_id ?? recipeId} />
            <input type="hidden" name="recipe_variant_id" value={components[0]?.recipe_variant_id ?? ""} />

            <div className="space-y-3">
              {components.map((component, index) => {
                const componentVariants = variantsForRecipe(component.recipe_id);

                return (
                  <div key={`${index}-${component.recipe_id}-${component.recipe_variant_id ?? "base"}`} className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] p-3 md:grid-cols-[1fr_1fr_120px_auto]">
                    <div className="space-y-2">
                      <Label htmlFor={`component_recipe_${index}`}>Recipe</Label>
                      <select
                        id={`component_recipe_${index}`}
                        name="component_recipe_id"
                        value={component.recipe_id}
                        onChange={(event) => updateComponent(index, { recipe_id: event.target.value, recipe_variant_id: null })}
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
                      <Label htmlFor={`component_variant_${index}`}>Variant</Label>
                      <select
                        id={`component_variant_${index}`}
                        name="component_recipe_variant_id"
                        value={component.recipe_variant_id ?? ""}
                        onChange={(event) => updateComponent(index, { recipe_variant_id: event.target.value || null })}
                        className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                      >
                        <option value="">Base recipe</option>
                        {componentVariants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`component_units_${index}`}>Pieces</Label>
                      <Input
                        id={`component_units_${index}`}
                        name="component_units_per_package"
                        inputMode="decimal"
                        value={component.units_per_package}
                        onChange={(event) => updateComponent(index, { units_per_package: event.target.value })}
                        required
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-11 w-full gap-2 text-red-700 hover:bg-red-50 md:w-auto"
                        disabled={components.length <= 2}
                        onClick={() => setComponents((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                      >
                        <Trash2 size={15} />
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
              <span className="font-semibold">{totalComponentUnits || 0} pcs</span>
              <span className="text-[var(--muted)]"> total per package from assorted components.</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="units_per_package">Pieces per package</Label>
          <Input
            id="units_per_package"
            name="units_per_package"
            inputMode="decimal"
            value={productType === "assorted" ? String(totalComponentUnits || "") : singleUnitsPerPackage}
            readOnly={productType === "assorted"}
            onChange={(event) => setSingleUnitsPerPackage(event.target.value)}
            required
          />
          <p className="text-xs text-[var(--muted)]">
            {productType === "assorted" ? "Auto-total from assorted contents." : "Example: 6 pieces inside 1 tub."}
          </p>
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
