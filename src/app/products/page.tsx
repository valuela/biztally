import Link from "next/link";
import { Package2, Pencil, Plus, ShoppingBag, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatMoney, formatStock, getCurrentBusiness, toNumber } from "@/lib/inventory/utils";
import { calculateRecipeCost } from "@/lib/recipes/costing";
import { DeleteProductButton } from "./delete-product-button";

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  recipe_id: string;
  recipe_variant_id: string | null;
  units_per_package: string | number;
  package_label: string;
  selling_price: string | number;
  packaging_cost: string | number;
  is_active: boolean;
  recipes: {
    name: string;
    batch_yield: string | number;
    selling_price: string | number;
    packaging_cost: string | number;
    labor_cost: string | number;
    overhead_cost: string | number;
    target_margin_percent: string | number | null;
  } | null;
  recipe_variants: {
    name: string;
    selling_price: string | number;
  } | null;
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

export default async function ProductsPage() {
  const { supabase, user, businessId, currency } = await getCurrentBusiness();

  const [{ data: productRows, error }, { data: ingredientRows }, { data: variantIngredientRows }, { data: inventoryRows }] = businessId
    ? await Promise.all([
        supabase
          .from("sellable_products")
          .select(
            "id, name, sku, recipe_id, recipe_variant_id, units_per_package, package_label, selling_price, packaging_cost, is_active, recipes(name, batch_yield, selling_price, packaging_cost, labor_cost, overhead_cost, target_margin_percent), recipe_variants(name, selling_price)"
          )
          .eq("business_id", businessId)
          .order("updated_at", { ascending: false }),
        supabase.from("recipe_ingredients").select("recipe_id, inventory_item_id, quantity").eq("business_id", businessId),
        supabase.from("recipe_variant_ingredients").select("recipe_variant_id, inventory_item_id, quantity, usage_basis").eq("business_id", businessId),
        supabase.from("inventory_items").select("id, cost_per_unit").eq("business_id", businessId),
      ])
    : [{ data: [], error: null }, { data: [] }, { data: [] }, { data: [] }];

  const products = (productRows ?? []) as unknown as ProductRow[];
  const costByInventoryId = new Map((inventoryRows ?? []).map((item) => [item.id, toNumber(item.cost_per_unit)]));
  const ingredientsByRecipeId = ((ingredientRows ?? []) as RecipeIngredientRow[]).reduce<Record<string, RecipeIngredientRow[]>>((grouped, ingredient) => {
    grouped[ingredient.recipe_id] = grouped[ingredient.recipe_id] ?? [];
    grouped[ingredient.recipe_id].push(ingredient);
    return grouped;
  }, {});
  const extrasByVariantId = ((variantIngredientRows ?? []) as VariantIngredientRow[]).reduce<Record<string, VariantIngredientRow[]>>((grouped, ingredient) => {
    grouped[ingredient.recipe_variant_id] = grouped[ingredient.recipe_variant_id] ?? [];
    grouped[ingredient.recipe_variant_id].push(ingredient);
    return grouped;
  }, {});

  const costedProducts = products.map((product) => {
    const recipe = product.recipes;
    const baseIngredientCost = (ingredientsByRecipeId[product.recipe_id] ?? []).reduce(
      (total, ingredient) => total + toNumber(ingredient.quantity) * (costByInventoryId.get(ingredient.inventory_item_id) ?? 0),
      0
    );
    const extraIngredientCost = product.recipe_variant_id
      ? (extrasByVariantId[product.recipe_variant_id] ?? []).reduce((total, ingredient) => {
          const multiplier = ingredient.usage_basis === "per_piece" ? toNumber(recipe?.batch_yield) : 1;
          return total + toNumber(ingredient.quantity) * multiplier * (costByInventoryId.get(ingredient.inventory_item_id) ?? 0);
        }, 0)
      : 0;
    const recipeCost = calculateRecipeCost({
      batchYield: toNumber(recipe?.batch_yield),
      sellingPrice: toNumber(product.recipe_variants?.selling_price) || toNumber(recipe?.selling_price),
      packagingCost: toNumber(recipe?.packaging_cost),
      laborCost: toNumber(recipe?.labor_cost),
      overheadCost: toNumber(recipe?.overhead_cost),
      ingredientCost: baseIngredientCost + extraIngredientCost,
      targetMarginPercent: toNumber(recipe?.target_margin_percent) || 40,
    });
    const packageCost = recipeCost.costPerUnit * toNumber(product.units_per_package) + toNumber(product.packaging_cost);
    const packageProfit = toNumber(product.selling_price) - packageCost;
    const packageMargin = toNumber(product.selling_price) > 0 ? (packageProfit / toNumber(product.selling_price)) * 100 : 0;

    return { product, recipeCost, packageCost, packageProfit, packageMargin };
  });

  const totalProducts = products.length;
  const profitableProducts = costedProducts.filter((item) => item.packageProfit > 0).length;
  const averageProfit =
    costedProducts.length > 0 ? costedProducts.reduce((total, item) => total + item.packageProfit, 0) / costedProducts.length : 0;

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Products"
        subtitle="Define sellable packages like tubs, boxes, singles, and bundles."
        action={
          <Link
            href="/products/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
          >
            <Plus size={16} />
            New product
          </Link>
        }
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Products" value={totalProducts.toString()} meta="Sellable formats" />
        <StatCard label="Profitable" value={`${profitableProducts}/${totalProducts}`} meta="At package price" />
        <StatCard label="Avg. package profit" value={formatMoney(averageProfit, currency)} meta="Per sellable package" />
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Sellable packages</CardTitle>
            <p className="text-sm text-[var(--muted)]">Production makes pieces. Products define how those pieces are sold.</p>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Could not load products: {error.message}
              </div>
            ) : costedProducts.length > 0 ? (
              <div className="grid gap-3">
                {costedProducts.map(({ product, packageCost, packageProfit, packageMargin }) => (
                  <div key={product.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                          <ShoppingBag size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-[var(--foreground)]">{product.name}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {formatStock(toNumber(product.units_per_package))} pcs / {product.package_label}
                            {product.recipe_variants?.name ? ` - ${product.recipe_variants.name}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{product.recipes?.name ?? "Recipe missing"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={product.is_active ? "bg-emerald-50 text-emerald-700" : "bg-[var(--surface-alt)] text-[var(--muted)]"}>
                          {product.is_active ? "Active" : "Archived"}
                        </Badge>
                        <Link
                          href={`/products/${product.id}/edit`}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-3 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
                        >
                          <Pencil size={15} />
                          Edit
                        </Link>
                        <DeleteProductButton productId={product.id} />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-5">
                      <div>
                        <p className="text-xs text-[var(--muted)]">Price / {product.package_label}</p>
                        <p className="mt-1 font-semibold">{formatMoney(product.selling_price, currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">Cost / {product.package_label}</p>
                        <p className="mt-1 font-semibold">{formatMoney(packageCost, currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">Profit / {product.package_label}</p>
                        <p className={`mt-1 font-semibold ${packageProfit < 0 ? "text-red-600" : ""}`}>{formatMoney(packageProfit, currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">Margin</p>
                        <p className="mt-1 font-semibold">{packageMargin.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">Extra packaging</p>
                        <p className="mt-1 font-semibold">{formatMoney(product.packaging_cost, currency)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-6">
                <p className="font-semibold">No products yet</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Create a product for formats like 6-piece tubs or 12-piece boxes.</p>
                <Link
                  href="/products/new"
                  className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
                >
                  <Package2 size={16} />
                  Create product
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Example</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
              <TrendingUp size={18} />
            </span>
            <p className="text-sm text-[var(--muted)]">
              For `Puto Tub - 6 pcs`, set pieces per package to `6`, package label to `tub`, and selling price to `125`.
            </p>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
