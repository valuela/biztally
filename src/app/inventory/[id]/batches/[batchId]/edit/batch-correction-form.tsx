"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { correctInventoryBatch } from "./actions";

type Batch = {
  id: string;
  inventory_item_id: string;
  batch_code: string | null;
  supplier_name: string | null;
  purchase_price: string | number | null;
  cost_per_unit: string | number;
  packages_received: string | number | null;
  sealed_packs_remaining: string | number | null;
  open_packs: string | number;
  emptied_packs: string | number;
  package_size: string | number | null;
  expiration_date: string | null;
  correction_note: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 gap-2" disabled={pending}>
      <Save size={16} />
      {pending ? "Saving..." : "Save correction"}
    </Button>
  );
}

export function BatchCorrectionForm({ batch }: { batch: Batch }) {
  const action = correctInventoryBatch.bind(null, batch.inventory_item_id, batch.id);

  return (
    <form action={action} className="space-y-5">
      <section className="grid gap-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="sealed_packs_remaining">Sealed packs</Label>
          <Input id="sealed_packs_remaining" name="sealed_packs_remaining" type="number" step="1" min="0" defaultValue={batch.sealed_packs_remaining ?? 0} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="open_packs">Open packs</Label>
          <Input id="open_packs" name="open_packs" type="number" step="1" min="0" defaultValue={batch.open_packs} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emptied_packs">Empty packs</Label>
          <Input id="emptied_packs" name="emptied_packs" type="number" step="1" min="0" defaultValue={batch.emptied_packs} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="package_size">Package size</Label>
          <Input id="package_size" name="package_size" type="number" step="0.01" min="0.01" defaultValue={batch.package_size ?? ""} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost_per_unit">Cost per unit</Label>
          <Input id="cost_per_unit" name="cost_per_unit" type="number" step="0.01" min="0" defaultValue={batch.cost_per_unit} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchase_price">Purchase price</Label>
          <Input id="purchase_price" name="purchase_price" type="number" step="0.01" min="0" defaultValue={batch.purchase_price ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiration_date">Expiration date</Label>
          <Input id="expiration_date" name="expiration_date" type="date" defaultValue={batch.expiration_date ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="batch_code">Receipt or batch code</Label>
          <Input id="batch_code" name="batch_code" defaultValue={batch.batch_code ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier_name">Vendor name</Label>
          <Input id="supplier_name" name="supplier_name" defaultValue={batch.supplier_name ?? ""} />
        </div>
        <div className="space-y-2 md:col-span-3">
          <Label htmlFor="correction_note">Correction note</Label>
          <textarea
            id="correction_note"
            name="correction_note"
            rows={3}
            defaultValue={batch.correction_note ?? ""}
            className="min-h-[96px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            placeholder="Explain what changed, such as recount, wrong expiry, or wrong pack count."
          />
        </div>
      </section>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={`/inventory/${batch.inventory_item_id}`} className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
          Cancel
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}
