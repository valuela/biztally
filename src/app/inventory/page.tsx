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

type InventoryType = "raw_material" | "packaging" | "finished_product" | "supply";
type InventoryStatus = "In stock" | "Low stock" | "Out of stock";

type InventoryRow = {
  id: string;
  name: string;
  barcode: string | null;
  image_url: string | null;
  brand_name: string | null;
  supplier_name: string | null;
  purchase_price: string | number | null;
  inventory_type: InventoryType;
  unit: string;
  quantity_on_hand: string | number;
  cost_per_unit: string | number;
  low_stock_threshold: string | number | null;
  expiration_date: string | null;
  notes: string | null;
  updated_at: string;
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

function getStatus(item: InventoryRow): InventoryStatus {
  const onHand = toNumber(item.quantity_on_hand);
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

function progressForItem(item: InventoryRow) {
  const onHand = toNumber(item.quantity_on_hand);
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

export default async function InventoryPage() {
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
  let recentMovements: InventoryMovementRow[] = [];

  if (businessId) {
    const [{ data: inventoryRows }, { data: movementRows }] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, name, barcode, image_url, brand_name, supplier_name, purchase_price, inventory_type, unit, quantity_on_hand, cost_per_unit, low_stock_threshold, expiration_date, notes, updated_at")
        .eq("business_id", businessId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("inventory_movements")
        .select("id, movement_type, quantity, reason, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    items = inventoryRows ?? [];
    recentMovements = movementRows ?? [];
  }

  const totalItems = items.length;
  const lowStockItems = items.filter((item) => getStatus(item) !== "In stock").length;
  const barcodeReady = items.filter((item) => Boolean(item.barcode)).length;
  const ingredients = items.filter((item) => item.inventory_type === "raw_material").length;

  const lowStockQueue = items
    .filter((item) => getStatus(item) !== "In stock")
    .slice(0, 3)
    .map((item) => ({
      name: item.name,
      qty: `${formatStock(toNumber(item.quantity_on_hand))} ${item.unit}`,
      urgency: getStatus(item) === "Out of stock" ? "Critical" : "High",
    }));

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

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total items" value={totalItems.toString()} meta="Products, ingredients, and packaging" />
        <StatCard label="Low stock" value={lowStockItems.toString()} meta="Needs reorder attention" />
        <StatCard label="Barcode ready" value={barcodeReady.toString()} meta="Items with a barcode value" />
        <StatCard label="Ingredients" value={ingredients.toString()} meta="Raw materials used in production" />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
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

            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <Input className="pl-9" placeholder="Search item, brand, supplier, barcode" />
              </div>

            <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
                >
                  <Filter size={14} />
                  All items
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
                >
                  Products
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
                >
                  Ingredients
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
                >
                  Low stock
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {items.length > 0 ? (
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
                      {items.map((item) => {
                        const status = getStatus(item);
                        const meta = typeMeta[item.inventory_type];
                        const Icon = meta.icon;
                        const progress = progressForItem(item);

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
                                  {formatStock(toNumber(item.quantity_on_hand))} {item.unit}
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
                                  Bought {item.purchase_price != null ? formatMoney(item.purchase_price, businessCurrency) : "not set"}
                                </p>
                              </div>
                            </TD>
                            <TD className="max-w-[180px] truncate text-sm text-[var(--muted)]">
                              {item.supplier_name ?? "No supplier yet"}
                            </TD>
                            <TD>
                              <StatusBadge label={status} tone={toneForStock(status)} />
                            </TD>
                            <TD>
                              <div className="text-sm text-[var(--muted)]">{item.updated_at}</div>
                            </TD>
                            <TD>
                              <div className="flex flex-wrap gap-2">
                                <Button className="h-8 px-3 text-xs">
                                  Edit
                                </Button>
                                {status !== "In stock" ? (
                                  <Button className="h-8 px-3 text-xs">Reorder</Button>
                                ) : (
                                  <Button className="h-8 px-3 text-xs">
                                    View
                                  </Button>
                                )}
                              </div>
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </div>

                <div className="space-y-3 md:hidden">
                  {items.map((item) => {
                    const status = getStatus(item);
                    const meta = typeMeta[item.inventory_type];
                    const Icon = meta.icon;
                    const progress = progressForItem(item);

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
                                {formatStock(toNumber(item.quantity_on_hand))} {item.unit}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--muted)]">Cost</p>
                              <p className="font-medium">{formatMoney(item.cost_per_unit, businessCurrency)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--muted)]">Bought from</p>
                              <p className="truncate font-medium">{item.supplier_name ?? "Not set"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[var(--muted)]">Purchase price</p>
                              <p className="font-medium">
                                {item.purchase_price != null ? formatMoney(item.purchase_price, businessCurrency) : "Not set"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex gap-2">
                            <Button className="h-9 flex-1">
                              Edit
                            </Button>
                            {status !== "In stock" ? (
                              <Button className="h-9 flex-1">Reorder</Button>
                            ) : (
                              <Button className="h-9 flex-1">
                                View
                              </Button>
                            )}
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
                    <p className="text-base font-semibold">No inventory yet</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Add your first product or ingredient, then scan barcodes when you receive stock.
                    </p>
                  </div>
                  <Link
                    href="/inventory/new"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white transition-colors hover:!bg-[var(--primary-hover)]"
                  >
                    <ScanBarcode size={16} />
                    Add first item
                  </Link>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
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
                      Connect item creation and barcode scanning to Supabase mutations after the table view is stable.
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
                          <p className="text-xs text-[var(--muted)]">{movement.created_at}</p>
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
