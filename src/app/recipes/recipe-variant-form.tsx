"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { convertRecipeQuantity, recipeUnitOptions } from "@/lib/recipes/units";
import { createRecipeVariant } from "./actions";

type InventoryOption = {
  id: string;
  name: string;
  brand_name: string | null;
  unit: string;
  cost_per_unit: string | number;
  recipe_density_grams_per_cup: string | number | null;
};

type VariantRow = {
  key: string;
  inventoryItemId: string;
  quantity: string;
  unit: string;
  usageBasis: "per_batch" | "per_piece";
  notes: string;
};

export type RecipeVariantFormInitialValue = {
  name: string;
  sku: string | null;
  selling_price: string | number;
  notes: string | null;
  ingredients: {
    id: string;
    inventory_item_id: string;
    input_quantity: string | number | null;
    input_unit: string | null;
    quantity: string | number;
    unit: string;
    usage_basis: "per_batch" | "per_piece";
    notes: string | null;
  }[];
};

function toNumber(value: string | number | null | undefined) {
  if (value == null || value === "") return 0;
  return typeof value === "number" ? value : Number.parseFloat(value) || 0;
}

function formatStock(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function formatMoney(value: string | number | null | undefined, currency = "PHP") {
  const amount = toNumber(value);
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `P${amount.toFixed(2)}`;
  }
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 gap-2" disabled={pending}>
      <Save size={16} />
      {pending ? "Saving variant..." : label}
    </Button>
  );
}

export function RecipeVariantForm({
  recipeId,
  inventoryItems,
  currency,
  action,
  initialVariant,
  submitLabel = "Add variant",
}: {
  recipeId: string;
  inventoryItems: InventoryOption[];
  currency: string;
  action?: (formData: FormData) => void | Promise<void>;
  initialVariant?: RecipeVariantFormInitialValue;
  submitLabel?: string;
}) {
  const [rows, setRows] = useState<VariantRow[]>([
    ...(initialVariant?.ingredients.length
      ? initialVariant.ingredients.map((ingredient) => ({
          key: ingredient.id,
          inventoryItemId: ingredient.inventory_item_id,
          quantity: String(ingredient.input_quantity ?? ingredient.quantity ?? ""),
          unit: ingredient.input_unit ?? ingredient.unit ?? "g",
          usageBasis: ingredient.usage_basis,
          notes: ingredient.notes ?? "",
        }))
      : [{ key: crypto.randomUUID(), inventoryItemId: "", quantity: "", unit: "g", usageBasis: "per_piece" as const, notes: "" }]),
  ]);
  const itemById = useMemo(() => new Map(inventoryItems.map((item) => [item.id, item])), [inventoryItems]);
  const formAction = action ?? createRecipeVariant.bind(null, recipeId);

  function updateRow(key: string, patch: Partial<VariantRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { key: crypto.randomUUID(), inventoryItemId: "", quantity: "", unit: "g", usageBasis: "per_piece", notes: "" }]);
  }

  function removeRow(key: string) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="variant_name">Variant name</Label>
          <Input id="variant_name" name="variant_name" placeholder="Cheese puto" defaultValue={initialVariant?.name ?? ""} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="variant_sku">SKU</Label>
          <Input id="variant_sku" name="variant_sku" placeholder="PUTO-CHEESE" defaultValue={initialVariant?.sku ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="variant_selling_price">Selling price per piece</Label>
          <Input id="variant_selling_price" name="variant_selling_price" inputMode="decimal" placeholder="Optional" defaultValue={initialVariant?.selling_price ?? ""} />
        </div>
      </div>

      <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Variant toppings / extras</p>
            <p className="text-xs text-[var(--muted)]">Add only ingredients that make this variant different from the base recipe.</p>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium hover:bg-[var(--surface-alt)]"
          >
            <Plus size={15} />
            Add topping
          </button>
        </div>

        {rows.map((row) => {
          const item = itemById.get(row.inventoryItemId);
          const conversion = item
            ? convertRecipeQuantity(toNumber(row.quantity), row.unit, item.unit, {
                gramsPerCup: item.recipe_density_grams_per_cup,
              })
            : null;
          const lineCost = conversion && !conversion.error ? conversion.quantity * toNumber(item?.cost_per_unit) : 0;

          return (
            <div key={row.key} className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3 md:grid-cols-[minmax(0,1fr)_100px_100px_130px_minmax(0,1fr)_40px]">
              <div className="space-y-2">
                <Label>Item</Label>
                <select
                  name="variant_inventory_item_id"
                  className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  value={row.inventoryItemId}
                  onChange={(event) => {
                    const selected = itemById.get(event.target.value);
                    updateRow(row.key, { inventoryItemId: event.target.value, unit: selected?.unit ?? row.unit });
                  }}
                >
                  <option value="">Select item</option>
                  {inventoryItems.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                      {option.brand_name ? ` - ${option.brand_name}` : ""} ({option.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Qty</Label>
                <Input name="variant_quantity" inputMode="decimal" value={row.quantity} onChange={(event) => updateRow(row.key, { quantity: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <select
                  name="variant_unit"
                  className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  value={row.unit}
                  onChange={(event) => updateRow(row.key, { unit: event.target.value })}
                >
                  {recipeUnitOptions.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Basis</Label>
                <select
                  name="variant_usage_basis"
                  className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  value={row.usageBasis}
                  onChange={(event) => updateRow(row.key, { usageBasis: event.target.value as "per_batch" | "per_piece" })}
                >
                  <option value="per_piece">Per piece</option>
                  <option value="per_batch">Per batch</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Input name="variant_ingredient_notes" value={row.notes} onChange={(event) => updateRow(row.key, { notes: event.target.value })} />
                <p className="text-xs text-[var(--muted)]">
                  {item && conversion && !conversion.error
                    ? `${formatStock(toNumber(row.quantity))} ${row.unit} ${row.usageBasis === "per_piece" ? "per piece" : "per batch"} = ${formatStock(conversion.quantity)} ${item.unit}; ${formatMoney(lineCost, currency)}${row.usageBasis === "per_piece" ? " each" : ""}`
                    : item && conversion?.error
                      ? conversion.error
                      : "Optional topping line"}
                </p>
              </div>
              <div className="flex items-start pt-7">
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--danger)]"
                  aria-label="Remove topping"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label htmlFor="variant_notes">Variant notes</Label>
        <textarea
          id="variant_notes"
          name="variant_notes"
          rows={3}
          defaultValue={initialVariant?.notes ?? ""}
          className="min-h-[88px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          placeholder="Example: cheese slice on top before steaming"
        />
      </div>

      <div className="flex justify-end">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
