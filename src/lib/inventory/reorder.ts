import { daysUntil, formatMoney, formatStock, toNumber } from "@/lib/inventory/utils";

export type ReorderItem = {
  id: string;
  name: string;
  brandName: string | null;
  unit: string;
  vendor: string;
  sealedPacks: number;
  openPacks: number;
  packThreshold: number;
  suggestedPacks: number;
  packageSize: number;
  latestPurchasePrice: string | number | null;
  nextExpiry: string | null;
  urgency: "Out of stock" | "Low packs" | "Expiring soon";
  reason: string;
};

type ItemRow = {
  id: string;
  name: string;
  brand_name: string | null;
  unit: string;
  default_package_size: string | number | null;
  low_stock_pack_threshold: string | number | null;
  low_stock_threshold: string | number | null;
};

type BatchRow = {
  inventory_item_id: string;
  supplier_name: string | null;
  purchase_price: string | number | null;
  sealed_packs_remaining: string | number | null;
  open_packs: string | number;
  quantity_remaining: string | number;
  expiration_date: string | null;
  received_at: string;
};

export function buildReorderItems(items: ItemRow[], batches: BatchRow[]) {
  const batchesByItem = batches.reduce<Record<string, BatchRow[]>>((grouped, batch) => {
    grouped[batch.inventory_item_id] = grouped[batch.inventory_item_id] ?? [];
    grouped[batch.inventory_item_id].push(batch);
    return grouped;
  }, {});

  return items
    .map((item): ReorderItem | null => {
      const itemBatches = batchesByItem[item.id] ?? [];
      const activeBatches = itemBatches.filter((batch) => toNumber(batch.quantity_remaining) > 0);
      const sealedPacks = activeBatches.reduce((total, batch) => total + toNumber(batch.sealed_packs_remaining), 0);
      const openPacks = activeBatches.reduce((total, batch) => total + toNumber(batch.open_packs), 0);
      const currentPacks = sealedPacks + openPacks;
      const packageSize = toNumber(item.default_package_size);
      const unitThreshold = toNumber(item.low_stock_threshold);
      const packThreshold = toNumber(item.low_stock_pack_threshold) || (packageSize > 0 && unitThreshold > 0 ? Math.ceil(unitThreshold / packageSize) : 1);
      const nextExpiryBatch = activeBatches.find((batch) => batch.expiration_date);
      const daysToExpiry = daysUntil(nextExpiryBatch?.expiration_date);
      const expiringSoon = daysToExpiry != null && daysToExpiry >= 0 && daysToExpiry <= 14;
      const latestBatch = [...itemBatches].sort((a, b) => b.received_at.localeCompare(a.received_at))[0] ?? null;
      const suggestedPacks = Math.max(0, Math.ceil(packThreshold * 2 - currentPacks));

      if (currentPacks > packThreshold && !expiringSoon) {
        return null;
      }

      const urgency = currentPacks <= 0 ? "Out of stock" : currentPacks <= packThreshold ? "Low packs" : "Expiring soon";
      const reason =
        urgency === "Expiring soon"
          ? `Next batch expires in ${daysToExpiry} day(s).`
          : `${formatStock(currentPacks)} pack(s) left. Target is ${formatStock(packThreshold * 2)} pack(s).`;

      return {
        id: item.id,
        name: item.name,
        brandName: item.brand_name,
        unit: item.unit,
        vendor: latestBatch?.supplier_name || "Unassigned store",
        sealedPacks,
        openPacks,
        packThreshold,
        suggestedPacks: suggestedPacks || (urgency === "Expiring soon" ? 1 : 0),
        packageSize,
        latestPurchasePrice: latestBatch?.purchase_price ?? null,
        nextExpiry: nextExpiryBatch?.expiration_date ?? null,
        urgency,
        reason,
      };
    })
    .filter((item): item is ReorderItem => item != null)
    .sort((a, b) => {
      const priority = { "Out of stock": 0, "Low packs": 1, "Expiring soon": 2 };
      return priority[a.urgency] - priority[b.urgency] || a.name.localeCompare(b.name);
    });
}

export function groupReorderItemsByVendor(items: ReorderItem[]) {
  return items.reduce<Record<string, ReorderItem[]>>((grouped, item) => {
    grouped[item.vendor] = grouped[item.vendor] ?? [];
    grouped[item.vendor].push(item);
    return grouped;
  }, {});
}

export function formatReorderCost(item: ReorderItem, currency: string) {
  return item.latestPurchasePrice == null ? "No price yet" : formatMoney(item.latestPurchasePrice, currency);
}
