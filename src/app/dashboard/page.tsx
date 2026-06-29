import Link from "next/link";
import { PackageCheck, Plus, ReceiptText, TrendingUp, Wheat } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  formatCompactMoney,
  formatMoney,
  formatPhilippineDate,
  formatPhilippineDateTime,
  formatStock,
  getCurrentBusiness,
  toNumber,
} from "@/lib/inventory/utils";

type SaleRow = {
  id: string;
  sale_date: string;
  customer_name: string | null;
  payment_method: string;
  status: string;
  total_revenue: string | number;
  total_cost: string | number;
  total_profit: string | number;
  created_at: string;
  sale_items: {
    sellable_product_id: string;
    product_name: string;
    quantity_sold: string | number;
    package_label: string;
    total_revenue: string | number;
    total_profit: string | number;
  }[];
};

type ProductRow = {
  id: string;
  recipe_id: string;
  recipe_variant_id: string | null;
  units_per_package: string | number;
  sellable_product_components?: ProductComponentRow[];
};

type ProductComponentRow = {
  sellable_product_id: string;
  recipe_id: string;
  recipe_variant_id: string | null;
  units_per_package: string | number;
};

type RecipeRow = {
  id: string;
  batch_yield: string | number;
};

type RecipeIngredientRow = {
  recipe_id: string;
  inventory_item_id: string;
  quantity: string | number;
};

type VariantIngredientRow = {
  recipe_variant_id: string;
  inventory_item_id: string;
  quantity: string | number;
  usage_basis: "per_batch" | "per_piece";
};

type InventoryCostRow = {
  id: string;
  cost_per_unit: string | number;
};

type MovementRow = {
  id: string;
  movement_type: string;
  quantity: string | number;
  reason: string | null;
  created_at: string;
};

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
  };
}

function paymentLabel(value: string) {
  switch (value) {
    case "gcash":
      return "GCash";
    case "bank_transfer":
      return "Bank transfer";
    case "cash":
      return "Cash";
    default:
      return value || "Other";
  }
}

function toneForStatus(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "paid") return "success";
  if (status === "partial") return "warning";
  if (status === "unpaid") return "danger";
  return "neutral";
}

function saleSummary(sale: SaleRow) {
  if (sale.sale_items.length === 0) return "No products";
  if (sale.sale_items.length === 1) {
    const item = sale.sale_items[0];
    return `${formatStock(toNumber(item.quantity_sold))} ${item.package_label} - ${item.product_name}`;
  }

  return `${sale.sale_items.length} products`;
}

function getProductComponents(product: ProductRow) {
  return product.sellable_product_components && product.sellable_product_components.length > 0
    ? product.sellable_product_components
    : [
        {
          sellable_product_id: product.id,
          recipe_id: product.recipe_id,
          recipe_variant_id: product.recipe_variant_id,
          units_per_package: product.units_per_package,
        },
      ];
}

export default async function DashboardPage() {
  const { supabase, user, businessId, businessName, currency } = await getCurrentBusiness();
  const { startDate, endDate, startDateTime, endDateTime } = monthBounds();

  let sales: SaleRow[] = [];
  let usageMovements: MovementRow[] = [];
  let products: ProductRow[] = [];
  let recipes: RecipeRow[] = [];
  let recipeIngredients: RecipeIngredientRow[] = [];
  let variantIngredients: VariantIngredientRow[] = [];
  let inventoryCosts: InventoryCostRow[] = [];

  if (businessId) {
    const [{ data: saleRows }, { data: movementRows }, { data: productRows }, { data: recipeRows }, { data: ingredientRows }, { data: variantIngredientRows }, { data: inventoryRows }] =
      await Promise.all([
      supabase
        .from("sales")
        .select(
          "id, sale_date, customer_name, payment_method, status, total_revenue, total_cost, total_profit, created_at, sale_items(sellable_product_id, product_name, quantity_sold, package_label, total_revenue, total_profit)"
        )
        .eq("business_id", businessId)
        .gte("sale_date", startDate)
        .lt("sale_date", endDate)
        .order("sale_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("inventory_movements")
        .select("id, movement_type, quantity, reason, created_at")
        .eq("business_id", businessId)
        .in("movement_type", ["sale_usage", "stock_out", "waste"])
        .gte("created_at", startDateTime)
        .lt("created_at", endDateTime)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("sellable_products")
        .select("id, recipe_id, recipe_variant_id, units_per_package, sellable_product_components(sellable_product_id, recipe_id, recipe_variant_id, units_per_package)")
        .eq("business_id", businessId),
      supabase.from("recipes").select("id, batch_yield").eq("business_id", businessId),
      supabase.from("recipe_ingredients").select("recipe_id, inventory_item_id, quantity").eq("business_id", businessId),
      supabase.from("recipe_variant_ingredients").select("recipe_variant_id, inventory_item_id, quantity, usage_basis").eq("business_id", businessId),
      supabase.from("inventory_items").select("id, cost_per_unit").eq("business_id", businessId),
    ]);

    sales = (saleRows ?? []) as SaleRow[];
    usageMovements = (movementRows ?? []) as MovementRow[];
    products = (productRows ?? []) as ProductRow[];
    recipes = (recipeRows ?? []) as RecipeRow[];
    recipeIngredients = (ingredientRows ?? []) as RecipeIngredientRow[];
    variantIngredients = (variantIngredientRows ?? []) as VariantIngredientRow[];
    inventoryCosts = (inventoryRows ?? []) as InventoryCostRow[];
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const costByInventoryId = new Map(inventoryCosts.map((item) => [item.id, toNumber(item.cost_per_unit)]));
  const ingredientCostPerPackageByProductId = new Map(
    products.map((product) => {
      const ingredientCostPerPackage = getProductComponents(product).reduce((productTotal, component) => {
        const recipe = recipeById.get(component.recipe_id);
        const batchYield = Math.max(1, toNumber(recipe?.batch_yield));
        const baseIngredientCost = recipeIngredients
          .filter((ingredient) => ingredient.recipe_id === component.recipe_id)
          .reduce((total, ingredient) => total + toNumber(ingredient.quantity) * (costByInventoryId.get(ingredient.inventory_item_id) ?? 0), 0);
        const variantIngredientCost = component.recipe_variant_id
          ? variantIngredients
              .filter((ingredient) => ingredient.recipe_variant_id === component.recipe_variant_id)
              .reduce((total, ingredient) => {
                const multiplier = ingredient.usage_basis === "per_piece" ? batchYield : 1;
                return total + toNumber(ingredient.quantity) * multiplier * (costByInventoryId.get(ingredient.inventory_item_id) ?? 0);
              }, 0)
          : 0;

        return productTotal + ((baseIngredientCost + variantIngredientCost) / batchYield) * toNumber(component.units_per_package);
      }, 0);

      return [product.id, ingredientCostPerPackage] as const;
    })
  );

  const revenueThisMonth = sales.reduce((total, sale) => total + toNumber(sale.total_revenue), 0);
  const productCostThisMonth = sales.reduce((total, sale) => total + toNumber(sale.total_cost), 0);
  const ingredientCostThisMonth = sales.reduce(
    (total, sale) =>
      total +
      sale.sale_items.reduce((lineTotal, item) => {
        const product = productById.get(item.sellable_product_id);
        if (!product) return lineTotal;
        return lineTotal + (ingredientCostPerPackageByProductId.get(product.id) ?? 0) * toNumber(item.quantity_sold);
      }, 0),
    0
  );
  const profitThisMonth = sales.reduce((total, sale) => total + toNumber(sale.total_profit), 0);
  const packagesSold = sales.reduce(
    (total, sale) => total + sale.sale_items.reduce((lineTotal, item) => lineTotal + toNumber(item.quantity_sold), 0),
    0
  );
  const ingredientUnitsUsed = usageMovements.reduce((total, movement) => total + Math.abs(toNumber(movement.quantity)), 0);
  const marginPercent = revenueThisMonth > 0 ? (profitThisMonth / revenueThisMonth) * 100 : 0;
  const recentSales = sales.slice(0, 6);

  const revenueByDate = sales.reduce<Record<string, number>>((grouped, sale) => {
    grouped[sale.sale_date] = (grouped[sale.sale_date] ?? 0) + toNumber(sale.total_revenue);
    return grouped;
  }, {});
  const chartDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return { key, label: new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(date), value: revenueByDate[key] ?? 0 };
  });
  const maxChartValue = Math.max(...chartDays.map((day) => day.value), 1);

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Dashboard"
        subtitle={`Monthly revenue, product cost, and ingredient usage for ${businessName}.`}
        action={
          <Link
            href="/sales/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
          >
            <Plus size={16} />
            Record sale
          </Link>
        }
      />

      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <StatCard compact fitValue label="Revenue" value={formatCompactMoney(revenueThisMonth, currency)} meta="Sales this month" />
        <StatCard compact fitValue label="Product cost" value={formatCompactMoney(productCostThisMonth, currency)} meta="Cost of goods sold" />
        <StatCard compact fitValue label="Ingredient cost" value={formatCompactMoney(ingredientCostThisMonth, currency)} meta="Ingredients only" />
        <StatCard compact fitValue label="Profit" value={formatCompactMoney(profitThisMonth, currency)} meta={`${marginPercent.toFixed(1)}% margin`} />
        <StatCard compact fitValue label="Packages sold" value={formatStock(packagesSold)} meta="Sale lines" />
        <StatCard compact fitValue label="Usage logs" value={usageMovements.length.toString()} meta="Deductions" />
        <StatCard compact fitValue label="Units used" value={formatStock(ingredientUnitsUsed)} meta="Stock movement" />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Revenue and cost</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">This month, based on recorded sales.</p>
            </div>
            <Badge className="w-fit bg-[var(--surface-alt)] text-[var(--foreground)]">
              Profit {formatMoney(profitThisMonth, currency)}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 2xl:grid-cols-[1fr_300px]">
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] p-4">
                <div className="flex h-52 items-end gap-2">
                  {chartDays.map((day) => (
                    <div key={day.key} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-40 w-full items-end rounded-[var(--radius-sm)] bg-[var(--surface)] px-2 py-2">
                        <div
                          className="w-full rounded-full bg-[var(--primary)]"
                          style={{ height: `${Math.max(8, (day.value / maxChartValue) * 100)}%` }}
                          title={formatMoney(day.value, currency)}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--muted)]">{day.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                <div className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                  <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <ReceiptText size={15} />
                    Revenue
                  </div>
                  <p className="mt-2 truncate text-lg font-bold sm:text-xl" title={formatMoney(revenueThisMonth, currency)}>
                    {formatCompactMoney(revenueThisMonth, currency)}
                  </p>
                </div>
                <div className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                  <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <PackageCheck size={15} />
                    Product cost
                  </div>
                  <p className="mt-2 truncate text-lg font-bold sm:text-xl" title={formatMoney(productCostThisMonth, currency)}>
                    {formatCompactMoney(productCostThisMonth, currency)}
                  </p>
                </div>
                <div className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                  <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <Wheat size={15} />
                    Ingredient cost
                  </div>
                  <p className="mt-2 truncate text-lg font-bold sm:text-xl" title={formatMoney(ingredientCostThisMonth, currency)}>
                    {formatCompactMoney(ingredientCostThisMonth, currency)}
                  </p>
                </div>
                <div className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                  <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <TrendingUp size={15} />
                    Net product profit
                  </div>
                  <p className="mt-2 truncate text-lg font-bold sm:text-xl" title={formatMoney(profitThisMonth, currency)}>
                    {formatCompactMoney(profitThisMonth, currency)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingredient usage</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted)]">Latest deductions from production, sales usage, waste, or manual stock out.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {usageMovements.length > 0 ? (
              usageMovements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-start justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                        <Wheat size={15} />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{movement.reason ?? "Stock usage"}</p>
                        <p className="text-xs text-[var(--muted)]">{formatPhilippineDateTime(movement.created_at)}</p>
                      </div>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{formatStock(Math.abs(toNumber(movement.quantity)))}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-4 text-sm text-[var(--muted)]">
                No ingredient usage logged this month yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Recent sales</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">Revenue, product cost, and profit snapshots from the latest orders.</p>
            </div>
            <Link href="/sales" className="text-sm font-medium text-[var(--primary)] hover:underline">
              View sales
            </Link>
          </CardHeader>
          <CardContent>
            {recentSales.length > 0 ? (
              <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
                <Table className="min-w-[860px]">
                  <THead>
                    <TR>
                      <TH>Sale</TH>
                      <TH>Revenue</TH>
                      <TH>Product cost</TH>
                      <TH>Profit</TH>
                      <TH>Payment</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {recentSales.map((sale) => (
                      <TR key={sale.id}>
                        <TD>
                          <div>
                            <p className="font-medium">{saleSummary(sale)}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {formatPhilippineDate(sale.sale_date)} - {sale.customer_name ?? "Walk-in customer"}
                            </p>
                          </div>
                        </TD>
                        <TD>{formatMoney(sale.total_revenue, currency)}</TD>
                        <TD>{formatMoney(sale.total_cost, currency)}</TD>
                        <TD>{formatMoney(sale.total_profit, currency)}</TD>
                        <TD>{paymentLabel(sale.payment_method)}</TD>
                        <TD>
                          <StatusBadge label={sale.status} tone={toneForStatus(sale.status)} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            ) : (
              <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-4 text-sm text-[var(--muted)]">
                No sales recorded this month yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
