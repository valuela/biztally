"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

function formatStock(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

type ShoppingItem = {
  id: string;
  name: string;
  brandName: string | null;
  unit: string;
  vendor: string;
  suggestedPacks: number;
  packageSize: number;
  urgency: string;
};

export function ShoppingChecklist({ groupedItems }: { groupedItems: Record<string, ShoppingItem[]> }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allItems = useMemo(() => Object.values(groupedItems).flat(), [groupedItems]);
  const completed = allItems.filter((item) => checked[item.id]).length;

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Shopping progress</p>
            <p className="text-xs text-[var(--muted)]">Checked items stay local on this device for now.</p>
          </div>
          <Badge>{completed}/{allItems.length}</Badge>
        </div>
      </div>

      {Object.entries(groupedItems).map(([vendor, items]) => (
        <section key={vendor} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] p-4">
            <p className="font-semibold text-[var(--foreground)]">{vendor}</p>
            <p className="text-xs text-[var(--muted)]">{items.length} item(s)</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {items.map((item) => (
              <label key={item.id} className="flex cursor-pointer items-start gap-3 p-4">
                <input
                  type="checkbox"
                  checked={Boolean(checked[item.id])}
                  onChange={(event) => setChecked((current) => ({ ...current, [item.id]: event.target.checked }))}
                  className="mt-1 h-5 w-5 rounded border-[var(--border)]"
                />
                <span className="min-w-0 flex-1">
                  <span className={checked[item.id] ? "font-medium text-[var(--muted)] line-through" : "font-medium text-[var(--foreground)]"}>
                    {item.name}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {item.brandName ?? "No brand"} · {formatStock(item.suggestedPacks)} pack(s)
                    {item.packageSize ? ` · ${formatStock(item.packageSize)} ${item.unit} each` : ""}
                  </span>
                </span>
                <Badge>{item.urgency}</Badge>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
