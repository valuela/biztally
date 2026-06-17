"use client";

import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recountInventoryItem } from "./actions";

function toNumber(value: string | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number.parseFloat(value) || 0;
}

function formatStock(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatPhilippineDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

type Batch = {
  id: string;
  batch_code: string | null;
  supplier_name: string | null;
  sealed_packs_remaining: string | number | null;
  open_packs: string | number;
  emptied_packs: string | number;
  package_size: string | number | null;
  package_unit: string | null;
  expiration_date: string | null;
  received_at: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 gap-2" disabled={pending}>
      <ClipboardCheck size={16} />
      {pending ? "Saving recount..." : "Save recount"}
    </Button>
  );
}

export function PhysicalRecountForm({ itemId, batches }: { itemId: string; batches: Batch[] }) {
  const action = recountInventoryItem.bind(null, itemId);

  return (
    <form action={action} className="space-y-5">
      <section className="space-y-3">
        {batches.map((batch) => (
          <div key={batch.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-4">
            <input type="hidden" name="batch_id" value={batch.id} />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-[var(--foreground)]">
                  {batch.batch_code || `Batch ${batch.id.slice(0, 8)}`}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {batch.supplier_name ?? "Vendor not set"} · Received {formatPhilippineDate(batch.received_at)}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Package: {batch.package_size ? `${formatStock(toNumber(batch.package_size))} ${batch.package_unit ?? "unit"}` : "Not set"} · Expires {formatPhilippineDate(batch.expiration_date)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`sealed_${batch.id}`}>Sealed</Label>
                <Input id={`sealed_${batch.id}`} name={`sealed_${batch.id}`} type="number" step="1" min="0" inputMode="numeric" defaultValue={batch.sealed_packs_remaining ?? 0} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`open_${batch.id}`}>Open</Label>
                <Input id={`open_${batch.id}`} name={`open_${batch.id}`} type="number" step="1" min="0" inputMode="numeric" defaultValue={batch.open_packs} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`empty_${batch.id}`}>Empty</Label>
                <Input id={`empty_${batch.id}`} name={`empty_${batch.id}`} type="number" step="1" min="0" inputMode="numeric" defaultValue={batch.emptied_packs} required />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="space-y-2">
          <Label htmlFor="recount_note">Recount note</Label>
          <textarea
            id="recount_note"
            name="recount_note"
            rows={3}
            className="min-h-[96px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            placeholder="Example: Weekly shelf count, corrected after checking storage."
          />
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href={`/inventory/${itemId}`} className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
            Cancel
          </Link>
          <SubmitButton />
        </div>
      </div>
    </form>
  );
}
