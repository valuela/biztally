import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Edit3, MinusCircle, PackagePlus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  daysUntil,
  formatCompactMoney,
  formatMoney,
  formatPhilippineDate,
  formatPhilippineDateTime,
  formatStock,
  getCurrentBusiness,
  toNumber,
} from "@/lib/inventory/utils";
import { OpenPackButton } from "./open-pack-button";

function statusFor(stock: number, threshold: number) {
  if (stock <= 0) return "Out of stock";
  if (threshold > 0 && stock <= threshold) return "Low stock";
  return "In stock";
}

function movementLabel(type: string) {
  switch (type) {
    case "stock_in":
      return "Stock in";
    case "stock_out":
      return "Stock out";
    case "adjustment":
      return "Adjustment";
    case "waste":
      return "Waste";
    case "sale_usage":
      return "Used";
    default:
      return type;
  }
}

function formatPackCount(value: number) {
  return `${formatStock(value)} ${value === 1 ? "pack" : "packs"}`;
}

function movementPackCount(quantity: number, packageSize: number) {
  if (packageSize <= 0) return null;
  return Math.abs(quantity) / packageSize;
}

export default async function InventoryItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, businessId, currency } = await getCurrentBusiness();

  if (!businessId) {
    notFound();
  }

  const [{ data: item }, { data: batches }, { data: movements }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, name, barcode, image_url, brand_name, inventory_type, unit, default_package_size, default_package_unit, quantity_on_hand, cost_per_unit, low_stock_threshold, low_stock_pack_threshold, notes, updated_at")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase
      .from("inventory_batches")
      .select("id, batch_code, supplier_name, purchase_price, cost_per_unit, packages_received, sealed_packs_remaining, open_packs, emptied_packs, package_size, package_unit, quantity_received, quantity_remaining, expiration_date, received_at")
      .eq("inventory_item_id", id)
      .eq("business_id", businessId)
      .order("expiration_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("inventory_movements")
      .select("id, movement_type, quantity, previous_quantity, new_quantity, reason, reference_id, created_at")
      .eq("inventory_item_id", id)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (!item) {
    notFound();
  }

  const stock = toNumber(item.quantity_on_hand);
  const threshold = toNumber(item.low_stock_threshold);
  const status = statusFor(stock, threshold);
  const activeBatches = (batches ?? []).filter((batch) => toNumber(batch.quantity_remaining) > 0);
  const nextExpiry = activeBatches.find((batch) => batch.expiration_date);
  const expiringSoon = activeBatches.filter((batch) => {
    const days = daysUntil(batch.expiration_date);
    return days != null && days >= 0 && days <= 30;
  });
  const valuation = activeBatches.reduce((total, batch) => total + toNumber(batch.quantity_remaining) * toNumber(batch.cost_per_unit), 0);
  const averageCost = stock > 0 ? valuation / stock : toNumber(item.cost_per_unit);
  const sealedPacks = activeBatches.reduce((total, batch) => total + toNumber(batch.sealed_packs_remaining), 0);
  const openPacks = activeBatches.reduce((total, batch) => total + toNumber(batch.open_packs), 0);
  const activePacks = sealedPacks + openPacks;
  const emptiedPacks = (batches ?? []).reduce((total, batch) => total + toNumber(batch.emptied_packs), 0);
  const packThreshold = toNumber(item.low_stock_pack_threshold);
  const packStatus = packThreshold > 0 && sealedPacks + openPacks <= packThreshold ? "Low packs" : "Pack stock ok";
  const batchesById = (batches ?? []).reduce<Record<string, { package_size: string | number | null }>>((grouped, batch) => {
    grouped[batch.id] = batch;
    return grouped;
  }, {});

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title={item.name}
        subtitle={item.brand_name ? `${item.brand_name} inventory detail` : "Inventory detail"}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/inventory" className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
              <ArrowLeft size={16} />
              Back
            </Link>
            <Link href={`/inventory/${item.id}/edit`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
              <Edit3 size={16} />
              Edit
            </Link>
            <Link href="/inventory/receive" className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
              <PackagePlus size={16} />
              Receive
            </Link>
            <OpenPackButton itemId={item.id} />
            <Link href={`/inventory/${item.id}/recount`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
              <ClipboardCheck size={16} />
              Recount
            </Link>
            <Link href={`/inventory/${item.id}/use`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]">
              <MinusCircle size={16} />
              Empty pack
            </Link>
          </div>
        }
      />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Current stock" value={formatPackCount(activePacks)} meta={`${formatStock(stock)} ${item.unit} usable quantity`} />
        <StatCard label="Pack state" value={`${formatStock(sealedPacks)} sealed`} meta={`${formatStock(openPacks)} open / ${formatStock(emptiedPacks)} empty`} />
        <StatCard label="Inventory value" value={formatCompactMoney(valuation, currency)} meta={`${formatMoney(valuation, currency)} exact`} />
        <StatCard label="Average cost" value={formatMoney(averageCost, currency)} meta={`Per ${item.unit}`} />
        <StatCard label="Expiring soon" value={expiringSoon.length.toString()} meta="Batches within 30 days" />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Batches</CardTitle>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={status} tone={status === "In stock" ? "success" : status === "Low stock" ? "warning" : "danger"} />
              <StatusBadge label={packStatus} tone={packStatus === "Low packs" ? "warning" : "success"} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Received</TH>
                    <TH>Remaining</TH>
                    <TH>Packs</TH>
                    <TH>Expiry</TH>
                    <TH>Vendor</TH>
                    <TH>Price</TH>
                    <TH>Cost/unit</TH>
                    <TH>Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {(batches ?? []).map((batch) => (
                    <TR key={batch.id}>
                      <TD>{formatPhilippineDate(batch.received_at)}</TD>
                      <TD>{formatStock(toNumber(batch.quantity_remaining))} {item.unit}</TD>
                      <TD>{formatStock(toNumber(batch.sealed_packs_remaining))} sealed / {formatStock(toNumber(batch.open_packs))} open</TD>
                      <TD>
                        <div>
                          <p>{formatPhilippineDate(batch.expiration_date)}</p>
                          {(() => {
                            const days = daysUntil(batch.expiration_date);
                            return days != null && days >= 0 && days <= 30 ? <p className="mt-1 text-xs text-amber-600">Expiring soon</p> : null;
                          })()}
                        </div>
                      </TD>
                      <TD>{batch.supplier_name ?? "Not set"}</TD>
                      <TD>{batch.purchase_price != null ? formatMoney(batch.purchase_price, currency) : "Not set"}</TD>
                      <TD>{formatMoney(batch.cost_per_unit, currency)}</TD>
                      <TD>
                        <Link href={`/inventory/${item.id}/batches/${batch.id}/edit`} className="inline-flex h-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
                          Correct
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <div className="space-y-3 md:hidden">
              {(batches ?? []).map((batch) => (
                <div key={batch.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{formatStock(toNumber(batch.quantity_remaining))} {item.unit}</p>
                    <Badge>{formatMoney(batch.cost_per_unit, currency)} / {item.unit}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Price paid: {batch.purchase_price != null ? formatMoney(batch.purchase_price, currency) : "Not set"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Received {formatPhilippineDate(batch.received_at)}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {formatStock(toNumber(batch.sealed_packs_remaining))} sealed / {formatStock(toNumber(batch.open_packs))} open / {formatStock(toNumber(batch.emptied_packs))} empty
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Expires {formatPhilippineDate(batch.expiration_date)}</p>
                  {(() => {
                    const days = daysUntil(batch.expiration_date);
                    return days != null && days >= 0 && days <= 30 ? <p className="mt-1 text-xs text-amber-600">Expiring soon. Use this batch first.</p> : null;
                  })()}
                  <p className="mt-1 text-xs text-[var(--muted)]">{batch.supplier_name ?? "Vendor not set"}</p>
                  <Link href={`/inventory/${item.id}/batches/${batch.id}/edit`} className="mt-3 inline-flex h-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
                    Correct batch
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Item identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-[var(--muted)]">Barcode</span><span className="font-medium">{item.barcode ?? "Not set"}</span></div>
              <div className="flex justify-between gap-4"><span className="text-[var(--muted)]">Package</span><span className="font-medium">{item.default_package_size ? `${formatStock(toNumber(item.default_package_size))} ${item.default_package_unit ?? item.unit}` : "Not set"}</span></div>
              <div className="flex justify-between gap-4"><span className="text-[var(--muted)]">Pack threshold</span><span className="font-medium">{item.low_stock_pack_threshold ?? "Not set"}</span></div>
              <div className="flex justify-between gap-4"><span className="text-[var(--muted)]">Next expiry</span><span className="font-medium">{formatPhilippineDate(nextExpiry?.expiration_date)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-[var(--muted)]">Updated</span><span className="font-medium">{formatPhilippineDateTime(item.updated_at)}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Movement history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(movements ?? []).map((movement) => {
                const movementQuantity = toNumber(movement.quantity);
                const movementBatch = movement.reference_id ? batchesById[movement.reference_id] : null;
                const packSize = toNumber(movementBatch?.package_size ?? item.default_package_size);
                const packsMoved = movementPackCount(movementQuantity, packSize);

                return (
                  <div key={movement.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{movementLabel(movement.movement_type)}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{movement.reason ?? "No notes"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatStock(movementQuantity)} {item.unit}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {packsMoved != null ? formatPackCount(packsMoved) : "Pack count unavailable"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                      <span>Current total: {formatStock(toNumber(movement.new_quantity))} {item.unit}</span>
                      <span>{formatPhilippineDateTime(movement.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
