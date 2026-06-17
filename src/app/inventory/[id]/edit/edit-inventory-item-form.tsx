"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inventoryUnitOptions } from "@/lib/inventory/units";
import { inventoryTypeOptions } from "../../new/inventory-options";
import { updateInventoryItem } from "./actions";

type Item = {
  id: string;
  name: string;
  brand_name: string | null;
  barcode: string | null;
  inventory_type: string;
  unit: string;
  default_package_size: string | number | null;
  low_stock_threshold: string | number | null;
  low_stock_pack_threshold: string | number | null;
  recipe_density_grams_per_cup: string | number | null;
  recipe_measurement_note: string | null;
  notes: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 gap-2" disabled={pending}>
      <Save size={16} />
      {pending ? "Saving..." : "Save changes"}
    </Button>
  );
}

export function EditInventoryItemForm({ item }: { item: Item }) {
  const action = updateInventoryItem.bind(null, item.id);

  return (
    <form action={action} className="space-y-5">
      <section className="grid gap-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="name">Item name</Label>
          <Input id="name" name="name" defaultValue={item.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand_name">Brand</Label>
          <Input id="brand_name" name="brand_name" defaultValue={item.brand_name ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="barcode">Barcode</Label>
          <Input id="barcode" name="barcode" defaultValue={item.barcode ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inventory_type">Item type</Label>
          <select
            id="inventory_type"
            name="inventory_type"
            required
            defaultValue={item.inventory_type}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            {inventoryTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">Stock unit</Label>
          <select
            id="unit"
            name="unit"
            required
            defaultValue={item.unit}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            {inventoryUnitOptions.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="default_package_size">Size per package</Label>
          <Input id="default_package_size" name="default_package_size" type="number" step="0.01" min="0" defaultValue={item.default_package_size ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="low_stock_threshold">Low stock threshold</Label>
          <Input id="low_stock_threshold" name="low_stock_threshold" type="number" step="0.01" min="0" defaultValue={item.low_stock_threshold ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="low_stock_pack_threshold">Low stock pack threshold</Label>
          <Input id="low_stock_pack_threshold" name="low_stock_pack_threshold" type="number" step="1" min="0" defaultValue={item.low_stock_pack_threshold ?? ""} />
          <p className="text-xs text-[var(--muted)]">Preferred for reorder alerts. Counts sealed + open packs.</p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="recipe_density_grams_per_cup">Recipe conversion: grams per cup</Label>
          <Input
            id="recipe_density_grams_per_cup"
            name="recipe_density_grams_per_cup"
            type="number"
            step="0.01"
            min="0"
            defaultValue={item.recipe_density_grams_per_cup ?? ""}
            placeholder="Example: flour 120, white sugar 200"
          />
          <p className="text-xs text-[var(--muted)]">
            Optional. Use this only for dry ingredients when recipes use cup, tbsp, or tsp but inventory is in g/kg.
          </p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="recipe_measurement_note">Recipe measurement note</Label>
          <Input
            id="recipe_measurement_note"
            name="recipe_measurement_note"
            defaultValue={item.recipe_measurement_note ?? ""}
            placeholder="Example: Weighed with leveled cup"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={item.notes ?? ""}
            className="min-h-[110px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          />
        </div>
      </section>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={`/inventory/${item.id}`} className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
          Cancel
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}
