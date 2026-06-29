import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Clock3,
  Filter,
  Layers3,
  Package2,
  PackagePlus,
  ScanBarcode,
  Search,
  Sparkles,
  Wheat,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatCompactMoney } from "@/lib/inventory/utils";

type InventoryType = "raw_material" | "packaging" | "finished_product" | "supply";
type InventoryStatus = "In stock" | "Low stock" | "Out of stock";
type InventoryFilter = "all" | "products" | "ingredients" | "low-stock";

type InventoryRow = {
  id: string;
  name: string;
  barcode: string | null;
  image_url: string | null;
  brand_name: string | null;
  inventory_type: InventoryType;
  unit: string;
  default_package_size: string | number | null;
  default_package_unit: string | null;
  quantity_on_hand: string | number;
  cost_per_unit: string | number;
  low_stock_threshold: string | number | null;
  low_stock_pack_threshold: string | number | null;
  expiration_date: string | null;
  notes: string | null;
  updated_at: string;
};

type InventoryBatchRow = {
  id: string;
  inventory_item_id: string;
  batch_code: string | null;
  supplier_name: string | null;
  purchase_price: string | number | null;
  cost_per_unit: string | number;
  quantity_received: string | number;
  quantity_remaining: string | number;
  sealed_packs_remaining: string | number | null;
  open_packs: string | number;
  emptied_packs: string | number;
  expiration_date: string | null;
  received_at: string;
};

type InventoryMovementRow = {
  id: string;
  movement_type: string;
  quantity: string | number;
  reason: string | null;
  created_at: string;
};

const typeMeta: Record<
  InventoryType,
  {
    label: string;
    icon: typeof Package2;
  }
> = {
  raw_material: {
    label: "Ingredient",
    icon: Wheat,
  },
  packaging: {
    label: "Packaging",
    icon: Layers3,
  },
  finished_product: {
    label: "Finished product",
    icon: Package2,
  },
  supply: {
    label: "Supply",
    icon: Boxes,
  },
};

function toNumber(value: string | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number.parseFloat(value) || 0;
}

function formatStock(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatMoney(value: string | number, currency = "PHP") {
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

function formatPhilippineDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const today = new Date();
  const target = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(target.getTime())) return null;
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((target.getTime() - todayMidnight.getTime()) / 86_400_000);
}

function getStatus(item: InventoryRow, stock = toNumber(item.quantity_on_hand), packs?: { sealed: number; open: number }): InventoryStatus {
  const onHand = stock;
  const packThreshold = toNumber(item.low_stock_pack_threshold);
  if (packThreshold > 0 && packs && packs.sealed + packs.open <= packThreshold) return "Low stock";

  const threshold = toNumber(item.low_stock_threshold);

  if (onHand <= 0) return "Out of stock";
  if (threshold > 0 && onHand <= threshold) return "Low stock";
  return "In stock";
}

function toneForStock(status: InventoryStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "In stock") return "success";
  if (status === "Low stock") return "warning";
  if (status === "Out of stock") return "danger";
  return "neutral";
}

function progressForItem(item: InventoryRow, stock = toNumber(item.quantity_on_hand)) {
  const onHand = stock;
  const threshold = toNumber(item.low_stock_threshold);
  const target = threshold > 0 ? threshold * 2 : Math.max(onHand, 1);
  return Math.max(0, Math.min(100, (onHand / target) * 100));
}

function movementLabel(movementType: string) {
  switch (movementType) {
    case "stock_in":
      return "Stock in";
    case "stock_out":
      return "Stock out";
    case "adjustment":
      return "Adjustment";
    case "waste":
      return "Waste";
    case "sale_usage":
      return "Sale usage";
    default:
      return movementType;
  }
}

function normalizeInventoryFilter(value: string | string[] | undefined): InventoryFilter {
  const filter = Array.isArray(value) ? value[0] : value;

  if (filter === "products" || filter === "ingredients" || filter === "low-stock") {
    return filter;
  }

  return "all";
}

function matchesInventorySearch(item: InventoryRow, batches: InventoryBatchRow[], query: string) {
  if (!query) return true;

  const searchText = [
    item.name,
    item.brand_name,
    item.barcode,
    item.notes,
    item.unit,
    item.default_package_unit,
    typeMeta[item.inventory_type].label,
    ...batches.map((batch) => batch.supplier_name),
    ...batches.map((batch) => batch.batch_code),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchText.includes(query.toLowerCase());
}

function filterButtonHref(filter: InventoryFilter, query: string) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `/inventory?${search}` : "/inventory";
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const activeFilter = normalizeInventoryFilter(params.filter);
  const searchQuery = typeof params.q === "string" ? params.q.trim() : "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: ownedBusiness }] = await Promise.all([
    supabase.from("user_profiles").select("id, user_id, business_id, full_name, role").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("businesses")
      .select("id, business_name, business_type, currency, owner_id")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  const businessId = profile?.business_id ?? ownedBusiness?.id ?? null;
  const businessName = ownedBusiness?.business_name ?? "BizTally business";
  const businessCurrency = ownedBusiness?.currency ?? "PHP";

  let items: InventoryRow[] = [];
  let batches: InventoryBatchRow[] = [];
  let recentMovements: InventoryMovementRow[] = [];

  if (businessId) {
    const [{ data: inventoryRows }, { data: batchRows }, { data: movementRows }] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, name, barcode, image_url, brand_name, inventory_type, unit, default_package_size, default_package_unit, quantity_on_hand, cost_per_unit, low_stock_threshold, low_stock_pack_threshold, expiration_date, notes, updated_at")
        .eq("business_id", businessId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("inventory_batches")
        .select("id, inventory_item_id, batch_code, supplier_name, purchase_price, cost_per_unit, quantity_received, quantity_remaining, sealed_packs_remaining, open_packs, emptied_packs, expiration_date, received_at")
        .eq("business_id", businessId)
        .order("expiration_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("inventory_movements")
        .select("id, movement_type, quantity, reason, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    items = inventoryRows ?? [];
    batches = batchRows ?? [];
    recentMovements = movementRows ?? [];
  }

  const batchesByItem = batches.reduce<Record<string, InventoryBatchRow[]>>((grouped, batch) => {
    grouped[batch.inventory_item_id] = grouped[batch.inventory_item_id] ?? [];
    grouped[batch.inventory_item_id].push(batch);
    return grouped;
  }, {});

  function itemBatches(itemId: string) {
    return batchesByItem[itemId] ?? [];
  }

  function stockOnHand(item: InventoryRow) {
    const itemStock = itemBatches(item.id).reduce((total, batch) => total + toNumber(batch.quantity_remaining), 0);
    return itemStock > 0 ? itemStock : toNumber(item.quantity_on_hand);
  }

  function latestBatch(item: InventoryRow) {
    return [...itemBatches(item.id)].sort((a, b) => b.received_at.localeCompare(a.received_at))[0] ?? null;
  }

  function nextExpiringBatch(item: InventoryRow) {
    return itemBatches(item.id).find((batch) => toNumber(batch.quantity_remaining) > 0 && batch.expiration_date) ?? null;
  }

  function packState(item: InventoryRow) {
    const itemBatchRows = itemBatches(item.id);
    return {
      sealed: itemBatchRows.reduce((total, batch) => total + toNumber(batch.sealed_packs_remaining), 0),
      open: itemBatchRows.reduce((total, batch) => total + toNumber(batch.open_packs), 0),
    };
  }

  const totalItems = items.length;
  const lowStockItems = items.filter((item) => getStatus(item, stockOnHand(item), packState(item)) !== "In stock").length;
  const barcodeReady = items.filter((item) => Boolean(item.barcode)).length;
  const ingredients = items.filter((item) => item.inventory_type === "raw_material").length;
  const inventoryValue = batches.reduce((total, batch) => total + toNumber(batch.quantity_remaining) * toNumber(batch.cost_per_unit), 0);
  const expiringSoon = batches.filter((batch) => {
    const days = daysUntil(batch.expiration_date);
    return toNumber(batch.quantity_remaining) > 0 && days != null && days >= 0 && days <= 30;
  }).length;

  const lowStockQueue = items
    .filter((item) => getStatus(item, stockOnHand(item), packState(item)) !== "In stock")
    .slice(0, 3)
    .map((item) => ({
      name: item.name,
      qty: `${formatStock(stockOnHand(item))} ${item.unit}`,
      urgency: getStatus(item, stockOnHand(item), packState(item)) === "Out of stock" ? "Critical" : "High",
    }));

  const visibleItems = items.filter((item) => {
    const stock = stockOnHand(item);
    const packs = packState(item);
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "products" && item.inventory_type === "finished_product") ||
      (activeFilter === "ingredients" && item.inventory_type === "raw_material") ||
      (activeFilter === "low-stock" && getStatus(item, stock, packs) !== "In stock");

    return matchesFilter && matchesInventorySearch(item, itemBatches(item.id), searchQuery);
  });

  const filters: Array<{ key: InventoryFilter; label: string; icon?: typeof Filter }> = [
    { key: "all", label: "All items", icon: Filter },
    { key: "products", label: "Products" },
    { key: "ingredients", label: "Ingredients" },
    { key: "low-stock", label: "Low stock" },
  ];

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Inventory"
        subtitle={
          businessId
            ? `Tracking items for ${businessName}.`
            : "No business is linked to this account yet. Add a business_id in user_profiles and refresh."
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="gap-2">
              <ScanBarcode size={16} />
              Scan barcode
            </Button>
            <Link
              href="/inventory/receive"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
            >
              <PackagePlus size={16} />
              Receive stock
            </Link>
            <Link
              href="/inventory/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white transition-colors hover:!bg-[var(--primary-hover)]"
            >
              <Sparkles size={16} />
              Add item
            </Link>
          </div>
        }
      />

      {!businessId ? (
        <Card className="mt-6 border-dashed bg-[var(--surface-alt)] shadow-none">
          <CardContent className="flex flex-col items-start gap-3 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-base font-semibold">Business link missing</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Link this user to a business in Supabase first. After that, the inventory table will load automatically.
              </p>
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
              `user_profiles.business_id` is null
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="mt-4 md:hidden">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Inventory snapshot</CardTitle>
            <p className="text-xs text-[var(--muted)]">Tap into items below for batch-level details.</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-x-3 gap-y-4">
              <div>
                <p className="text-xs text-[var(--muted)]">Items</p>
                <p className="mt-1 text-lg font-bold">{totalItems}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Low</p>
                <p className="mt-1 text-lg font-bold">{lowStockItems}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Expiry</p>
                <p className="mt-1 text-lg font-bold">{expiringSoon}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Barcodes</p>
                <p className="mt-1 text-sm font-semibold">{totalItems > 0 ? Math.round((barcodeReady / totalItems) * 100) : 0}%</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Ingredients</p>
                <p className="mt-1 text-sm font-semibold">{ingredients}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[var(--muted)]">Value</p>
                <p className="mt-1 truncate text-sm font-semibold">{formatMoney(inventoryValue, businessCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 hidden gap-4 md:grid md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total items" value={totalItems.toString()} meta="Products, ingredients, and packaging" />
        <StatCard label="Low stock" value={lowStockItems.toString()} meta="Needs reorder attention" />
        <StatCard label="Barcode ready" value={barcodeReady.toString()} meta="Items with a barcode value" />
        <StatCard label="Ingredients" value={ingredients.toString()} meta="Raw materials used in production" />
        <StatCard label="Inventory value" value={formatCompactMoney(inventoryValue, businessCurrency)} meta="Remaining batch value" />
        <StatCard label="Expiring soon" value={expiringSoon.toString()} meta="Batches within 30 days" />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="text-lg">Items</CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">Search, filter, and review stock levels.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <Clock3 size={14} />
                Last synced {items.length > 0 ? "a few moments ago" : "not yet"}
              </div>
            </div>

            <form action="/inventory" className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <input type="hidden" name="filter" value={activeFilter} />
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  className="pl-9"
                  name="q"
                  placeholder="Search item, brand, supplier, barcode"
                  defaultValue={searchQuery}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {filters.map((filter) => {
                  const Icon = filter.icon;
                  const isActive = activeFilter === filter.key;

                  return (
                    <Link
                      key={filter.key}
                      href={filterButtonHref(filter.key, searchQuery)}
                      className={cn(
                        "inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                        isActive
                          ? "border-[var(--primary)] bg-[var(--surface)] text-[var(--primary)]"
                          : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                      )}
                    >
                      {Icon ? <Icon size={14} /> : null}
                      {filter.label}
                    </Link>
                  );
                })}
              </div>
            </form>
          </CardHeader>

          <CardContent>
            {visibleItems.length > 0 ? (
              <>
                <div className="hidden overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] md:block">
                  <Table className="min-w-[1080px]">
                    <THead>
                      <TR>
                        <TH>Item</TH>
                        <TH>Type</TH>
                        <TH>Stock</TH>
                        <TH>Cost</TH>
                        <TH>Supplier</TH>
                        <TH>Status</TH>
                        <TH>Updated</TH>
                        <TH>Actions</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {visibleItems.map((item) => {
                        const stock = stockOnHand(item);
                        const packs = packState(item);
                        const status = getStatus(item, stock, packs);
                        const meta = typeMeta[item.inventory_type];
                        const Icon = meta.icon;
                        const progress = progressForItem(item, stock);
                        const latest = latestBatch(item);
                        const nextExpiry = nextExpiringBatch(item);

                        return (
                          <TR key={item.id}>
                            <TD>
                              <div className="flex items-start gap-3">
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)] text-[var(--foreground)]">
                                  {item.image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={item.image_url}
                                      alt={item.name}
                                      className="h-10 w-10 rounded-[var(--radius-sm)] object-cover"
                                    />
                                  ) : (
                                    <Icon size={18} />
                                  )}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-medium text-[var(--foreground)]">{item.name}</p>
                                  <p className="mt-1 text-xs text-[var(--muted)]">
                                    {item.brand_name ? `Brand ${item.brand_name}` : "No brand yet"}
                                  </p>
                                  <p className="mt-1 text-xs text-[var(--muted)]">
                                    {item.barcode ? `Barcode ${item.barcode}` : "No barcode yet"}
                                  </p>
                                  <p className="mt-1 text-xs text-[var(--muted)]">
                                    {item.default_package_size
                                      ? `${formatStock(toNumber(item.default_package_size))} ${item.default_package_unit ?? item.unit} per pack`
                                      : "Package size not set"}
                                  </p>
                                  <p className="mt-1 text-xs text-[var(--muted)]">
                                    {formatStock(packs.sealed)} sealed / {formatStock(packs.open)} open
                                  </p>
                                  {packs.open > 1 ? <p className="mt-1 text-xs text-amber-600">Finish open packs first</p> : null}
                                  <div className="mt-2 h-1.5 w-40 rounded-full bg-[var(--surface-alt)]">
                                    <div
                                      className={cn(
                                        "h-1.5 rounded-full",
                                        status === "In stock"
                                          ? "bg-[var(--primary)]"
                                          : status === "Low stock"
                                            ? "bg-amber-500"
                                            : "bg-red-500"
                                      )}
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </TD>
                            <TD>
                              <Badge className="bg-[var(--surface-alt)] text-[var(--foreground)]">{meta.label}</Badge>
                            </TD>
                            <TD>
                              <div>
                                <p className="font-medium">
                                  {formatStock(stock)} {item.unit}
                                </p>
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                  Min {formatStock(toNumber(item.low_stock_threshold))} {item.unit}
                                </p>
                              </div>
                            </TD>
                            <TD>
                              <div>
                                <p className="font-medium">{formatMoney(item.cost_per_unit, businessCurrency)}</p>
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                  Bought {latest?.purchase_price != null ? formatMoney(latest.purchase_price, businessCurrency) : "not set"}
                                </p>
                              </div>
                            </TD>
                            <TD className="max-w-[180px] truncate text-sm text-[var(--muted)]">
                              <div>
                                <p className="truncate">{latest?.supplier_name ?? "No supplier yet"}</p>
                                <p className="mt-1 text-xs">
                                  {nextExpiry?.expiration_date ? `Expires ${nextExpiry.expiration_date}` : "No expiry tracked"}
                                </p>
                              </div>
                            </TD>
                            <TD>
                              <StatusBadge label={status} tone={toneForStock(status)} />
                            </TD>
                            <TD>
                              <div className="text-sm text-[var(--muted)]">{formatPhilippineDateTime(item.updated_at)}</div>
                            </TD>
                            <TD>
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={`/inventory/${item.id}`}
                                  className="inline-flex h-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                                >
                                  View
                                </Link>
                                <Link
                                  href={`/inventory/${item.id}/edit`}
                                  className="inline-flex h-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                                >
                                  Edit
                                </Link>
                                <Link
                                  href={`/inventory/${item.id}/use`}
                                  className="inline-flex h-8 items-center justify-center rounded-full border border-[var(--border)] !bg-[var(--primary)] px-3 text-xs font-medium !text-white hover:!bg-[var(--primary-hover)]"
                                >
                                  Use
                                </Link>
                              </div>
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </div>

                <div className="space-y-3 md:hidden">
                  {visibleItems.map((item) => {
                    const stock = stockOnHand(item);
                    const packs = packState(item);
                    const status = getStatus(item, stock, packs);
                    const meta = typeMeta[item.inventory_type];
                    const Icon = meta.icon;
                    const progress = progressForItem(item, stock);
                    const latest = latestBatch(item);
                    const nextExpiry = nextExpiringBatch(item);

                    return (
                      <Card key={item.id} className="shadow-none">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-3">
                                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                                  {item.image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={item.image_url}
                                      alt={item.name}
                                      className="h-10 w-10 rounded-[var(--radius-sm)] object-cover"
                                    />
                                  ) : (
                                    <Icon size={18} />
                                  )}
                                </span>
                              <div className="min-w-0">
                                <p className="font-medium text-[var(--foreground)]">{item.name}</p>
                                <p className="mt-1 text-xs text-[var(--muted)]">{meta.label} - {item.unit}</p>
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                  {item.brand_name ? `Brand ${item.brand_name}` : "No brand yet"}
                                </p>
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                  {item.barcode ? `Barcode ${item.barcode}` : "No barcode yet"}
                                </p>
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                  {item.default_package_size
                                    ? `${formatStock(toNumber(item.default_package_size))} ${item.default_package_unit ?? item.unit} per pack`
                                    : "Package size not set"}
                                </p>
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                  {formatStock(packs.sealed)} sealed / {formatStock(packs.open)} open
                                </p>
                                {packs.open > 1 ? <p className="mt-1 text-xs text-amber-600">Finish open packs first</p> : null}
                              </div>
                            </div>
                            <StatusBadge label={status} tone={toneForStock(status)} />
                          </div>

                          <div className="mt-4 h-1.5 w-full rounded-full bg-[var(--surface-alt)]">
                            <div
                              className={cn(
                                "h-1.5 rounded-full",
                                status === "In stock"
                                  ? "bg-[var(--primary)]"
                                  : status === "Low stock"
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                              )}
                              style={{ width: `${progress}%` }}
                            />
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-[var(--muted)]">Stock</p>
                              <p className="font-medium">
                                {formatStock(stock)} {item.unit}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--muted)]">Cost</p>
                              <p className="font-medium">{formatMoney(item.cost_per_unit, businessCurrency)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--muted)]">Bought from</p>
                              <p className="truncate font-medium">{latest?.supplier_name ?? "Not set"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--muted)]">Purchase price</p>
                              <p className="font-medium">
                                {latest?.purchase_price != null ? formatMoney(latest.purchase_price, businessCurrency) : "Not set"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--muted)]">Next expiry</p>
                              <p className="font-medium">{nextExpiry?.expiration_date ?? "Not tracked"}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex gap-2">
                            <Link
                              href={`/inventory/${item.id}`}
                              className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                            >
                              View
                            </Link>
                            <Link
                              href={`/inventory/${item.id}/edit`}
                              className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                            >
                              Edit
                            </Link>
                            <Link
                              href={`/inventory/${item.id}/use`}
                              className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-[var(--border)] !bg-[var(--primary)] px-3 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
                            >
                              Use
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            ) : (
              <Card className="border-dashed bg-[var(--surface-alt)] shadow-none">
                <CardContent className="flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-base font-semibold">{items.length > 0 ? "No matching items" : "No inventory yet"}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {items.length > 0
                        ? "Try another search term or switch back to All items."
                        : "Add your first product or ingredient, then scan barcodes when you receive stock."}
                    </p>
                  </div>
                  {items.length > 0 ? (
                    <Link
                      href="/inventory"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
                    >
                      Clear filters
                    </Link>
                  ) : (
                    <Link
                      href="/inventory/new"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white transition-colors hover:!bg-[var(--primary-hover)]"
                    >
                      <ScanBarcode size={16} />
                      Add first item
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Barcode flow</CardTitle>
              <p className="text-sm text-[var(--muted)]">The flow we should connect to the scanner next.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                    <ScanBarcode size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-medium">1. Scan barcode</p>
                    <p className="text-sm text-[var(--muted)]">Capture products or ingredients from camera or scanner input.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                    <Sparkles size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-medium">2. Match item</p>
                    <p className="text-sm text-[var(--muted)]">Find the existing item or create a new one from the scan result.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                    <Boxes size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-medium">3. Save stock update</p>
                    <p className="text-sm text-[var(--muted)]">Write the quantity, unit cost, and notes back to Supabase.</p>
                  </div>
                </div>
              </div>
              <Button variant="secondary" className="w-full gap-2">
                <ScanBarcode size={16} />
                Open scanner
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reorder queue</CardTitle>
              <p className="text-sm text-[var(--muted)]">Items that need attention first.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {lowStockQueue.length > 0 ? (
                lowStockQueue.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.name}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                        {item.urgency === "Critical" ? (
                          <ArrowDownRight size={12} className="text-red-600" />
                        ) : (
                          <ArrowUpRight size={12} className="text-amber-600" />
                        )}
                        {item.urgency}
                      </div>
                    </div>
                    <Badge className="bg-[var(--surface-alt)] text-[var(--foreground)]">{item.qty}</Badge>
                  </div>
                ))
              ) : (
                <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] p-3 text-sm text-[var(--muted)]">
                  No low-stock items right now.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Inventory health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">Barcode coverage</span>
                  <span className="font-medium">{totalItems > 0 ? Math.round((barcodeReady / totalItems) * 100) : 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-alt)]">
                  <div className="h-2 rounded-full bg-[var(--primary)]" style={{ width: `${totalItems > 0 ? (barcodeReady / totalItems) * 100 : 0}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">Low stock items</span>
                  <span className="font-medium">{lowStockItems}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-alt)]">
                  <div className="h-2 rounded-full bg-amber-500" style={{ width: `${totalItems > 0 ? (lowStockItems / totalItems) * 100 : 0}%` }} />
                </div>
              </div>

              <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium">What to build next</p>
                    <p className="text-sm text-[var(--muted)]">
                      Review expiring batches, deduct used stock with FIFO, or add missing barcodes from item detail pages.
                    </p>
                  </div>
                </div>
              </div>

              {recentMovements.length > 0 ? (
                <div className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div>
                    <p className="text-sm font-medium">Recent movements</p>
                    <p className="text-xs text-[var(--muted)]">Latest stock activity from Supabase.</p>
                  </div>
                  <div className="space-y-3">
                    {recentMovements.map((movement) => (
                      <div key={movement.id} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">{movementLabel(movement.movement_type)}</p>
                          <p className="text-xs text-[var(--muted)]">{movement.reason ?? "No reason provided"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatStock(toNumber(movement.quantity))}</p>
                          <p className="text-xs text-[var(--muted)]">{formatPhilippineDateTime(movement.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
