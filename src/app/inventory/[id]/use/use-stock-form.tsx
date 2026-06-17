"use client";

import Link from "next/link";
import { MinusCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInventoryStock } from "./actions";

type Item = {
  id: string;
  name: string;
  unit: string;
  quantity_on_hand: string | number;
  default_package_size: string | number | null;
  default_package_unit: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 gap-2" disabled={pending}>
      <MinusCircle size={16} />
      {pending ? "Deducting..." : "Deduct stock"}
    </Button>
  );
}

export function UseStockForm({ item }: { item: Item }) {
  const action = useInventoryStock.bind(null, item.id);

  return (
    <form action={action} className="space-y-5">
      <section className="grid gap-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-2">
        <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] p-3 md:col-span-2">
          <p className="text-sm font-medium text-[var(--foreground)]">{item.name}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Current stock: {item.quantity_on_hand} {item.unit}. Deduct stock only when a whole opened pack is empty.
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Pack size: {item.default_package_size ? `${item.default_package_size} ${item.default_package_unit ?? item.unit}` : "not set"}.
            FIFO will deduct nearest-expiry batches first.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="packs_emptied">Empty packs</Label>
          <Input id="packs_emptied" name="packs_emptied" type="number" step="1" min="1" inputMode="numeric" required />
          <p className="text-xs text-[var(--muted)]">Enter whole opened packs only. Use Open pack on the item page before marking it empty.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="movement_type">Reason type</Label>
          <select id="movement_type" name="movement_type" defaultValue="sale_usage" className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
            <option value="sale_usage">Used for production/sale</option>
            <option value="waste">Waste or spoilage</option>
            <option value="stock_out">Stock out</option>
            <option value="adjustment">Manual adjustment</option>
          </select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="reason">Notes</Label>
          <textarea id="reason" name="reason" rows={3} className="min-h-[96px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]" placeholder="Example: Revel Bars production batch #4" />
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
