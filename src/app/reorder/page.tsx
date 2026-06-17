import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { buildReorderItems, formatReorderCost } from "@/lib/inventory/reorder";
import { formatPhilippineDate, formatStock, getCurrentBusiness } from "@/lib/inventory/utils";

function toneForUrgency(urgency: string): "success" | "warning" | "danger" | "neutral" {
  if (urgency === "Out of stock") return "danger";
  if (urgency === "Low packs") return "warning";
  return "neutral";
}

export default async function ReorderPage() {
  const { supabase, user, businessId, businessName, currency } = await getCurrentBusiness();
  const [{ data: items }, { data: batches }] = businessId
    ? await Promise.all([
        supabase
          .from("inventory_items")
          .select("id, name, brand_name, unit, default_package_size, low_stock_pack_threshold, low_stock_threshold")
          .eq("business_id", businessId)
          .order("name", { ascending: true }),
        supabase
          .from("inventory_batches")
          .select("inventory_item_id, supplier_name, purchase_price, sealed_packs_remaining, open_packs, quantity_remaining, expiration_date, received_at")
          .eq("business_id", businessId)
          .order("expiration_date", { ascending: true, nullsFirst: false }),
      ])
    : [{ data: [] }, { data: [] }];

  const reorderItems = buildReorderItems(items ?? [], batches ?? []);
  const outOfStock = reorderItems.filter((item) => item.urgency === "Out of stock").length;
  const lowPacks = reorderItems.filter((item) => item.urgency === "Low packs").length;
  const expiring = reorderItems.filter((item) => item.urgency === "Expiring soon").length;

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Reorder list"
        subtitle={`Suggested buying priorities for ${businessName}.`}
        action={
          <Link href="/shopping-list" className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]">
            <ShoppingCart size={16} />
            Shopping list
          </Link>
        }
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-[var(--muted)]">Out of stock</p><p className="mt-1 text-2xl font-bold">{outOfStock}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-[var(--muted)]">Low packs</p><p className="mt-1 text-2xl font-bold">{lowPacks}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-[var(--muted)]">Expiring soon</p><p className="mt-1 text-2xl font-bold">{expiring}</p></CardContent></Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What to buy next</CardTitle>
            <p className="text-sm text-[var(--muted)]">Based on pack thresholds, open/sealed packs, and batches expiring within 14 days.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {reorderItems.length > 0 ? (
              reorderItems.map((item) => (
                <div key={item.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/inventory/${item.id}`} className="font-semibold text-[var(--foreground)] hover:underline">
                          {item.name}
                        </Link>
                        <StatusBadge label={item.urgency} tone={toneForUrgency(item.urgency)} />
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted)]">{item.brandName ?? "No brand"} · {item.vendor}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">{item.reason}</p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-lg font-bold">{formatStock(item.suggestedPacks)} pack(s)</p>
                      <p className="text-xs text-[var(--muted)]">{item.packageSize ? `${formatStock(item.packageSize)} ${item.unit} each` : "Package size not set"}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                    <Badge>{formatStock(item.sealedPacks)} sealed</Badge>
                    <Badge>{formatStock(item.openPacks)} open</Badge>
                    <Badge>{formatReorderCost(item, currency)}</Badge>
                    {item.nextExpiry ? <Badge>Expires {formatPhilippineDate(item.nextExpiry)}</Badge> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] p-4 text-sm text-[var(--muted)]">
                No reorder suggestions right now.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
