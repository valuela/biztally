"use client";

import Link from "next/link";
import { Barcode, Sparkles } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CostFields } from "./cost-fields";
import { createInventoryItem } from "./actions";
import { inventoryTypeOptions } from "./inventory-options";

type VendorOption = {
  id: string;
  name: string;
};

function SaveItemButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="gap-2" disabled={pending}>
      <Sparkles size={16} />
      {pending ? "Saving item..." : "Save item"}
    </Button>
  );
}

export function InventoryItemForm({
  currency,
  vendors,
}: {
  currency: string;
  vendors: VendorOption[];
}) {
  const [stockUnit, setStockUnit] = useState("");

  return (
    <form action={createInventoryItem} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="name">Item name</Label>
          <Input id="name" name="name" placeholder="All-purpose flour" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="brand_name">Brand name</Label>
          <Input id="brand_name" name="brand_name" placeholder="Magnolia" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vendor_id">Bought from</Label>
          <select
            id="vendor_id"
            name="vendor_id"
            className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            defaultValue=""
          >
            <option value="">Select vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="batch_code">Batch or receipt code</Label>
          <Input id="batch_code" name="batch_code" placeholder="Receipt #, lot #, or delivery code" />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="image_file">Item image</Label>
          <Input
            id="image_file"
            name="image_file"
            type="file"
            accept="image/*"
            className="h-auto px-3 py-2 file:mr-4 file:rounded-full file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[var(--primary-hover)]"
          />
          <p className="text-xs text-[var(--muted)]">Upload a product or ingredient image. We store it in Supabase Storage.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="barcode">Barcode</Label>
          <div className="relative">
            <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input id="barcode" name="barcode" className="pl-9" placeholder="1234567890123" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inventory_type">Item type</Label>
          <select
            id="inventory_type"
            name="inventory_type"
            required
            className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            defaultValue=""
          >
            <option value="" disabled>
              Select type
            </option>
            {inventoryTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit">Stock unit</Label>
          <Input id="unit" name="unit" placeholder="kg, g, ml, pcs" value={stockUnit} onChange={(event) => setStockUnit(event.target.value)} required />
        </div>

        <CostFields currency={currency} stockUnit={stockUnit} />

        <div className="space-y-2">
          <Label htmlFor="low_stock_threshold">Low stock threshold</Label>
          <Input id="low_stock_threshold" name="low_stock_threshold" type="number" step="0.01" min="0" placeholder="Optional" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expiration_date">Expiration date</Label>
          <Input id="expiration_date" name="expiration_date" type="date" />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            className="min-h-[110px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            placeholder="Supplier details, recipe notes, or handling instructions"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/inventory"
          className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
        >
          Cancel
        </Link>
        <SaveItemButton />
      </div>
    </form>
  );
}
