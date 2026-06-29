import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calculator, ChefHat, Factory, Pencil, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getCurrentBusiness, formatMoney, formatStock, toNumber } from "@/lib/inventory/utils";
import { calculateRecipeCost } from "@/lib/recipes/costing";
import { DeleteVariantButton } from "../delete-variant-button";
import { RecipeVariantModal } from "../recipe-variant-modal";
import { VariantStatusButton } from "../variant-status-button";

type RecipeDetail = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  batch_yield: string | number;
  yield_unit: string;
  selling_price: string | number;
  packaging_cost: string | number;
  labor_cost: string | number;
  overhead_cost: string | number;
  target_margin_percent: string | number | null;
  notes: string | null;
  is_active: boolean;
  recipe_ingredients: {
    id: string;
    quantity: string | number;
    unit: string;
    input_quantity: string | number | null;
    input_unit: string | null;
    notes: string | null;
    inventory_items:
      | {
          name: string;
          brand_name: string | null;
          unit: string;
          cost_per_unit: string | number;
        }
      | {
          name: string;
          brand_name: string | null;
          unit: string;
          cost_per_unit: string | number;
        }[]
      | null;
  }[];
};

type VariantRow = {
  id: string;
  name: string;
  sku: string | null;
  selling_price: string | number;
  notes: string | null;
  is_active: boolean;
};

type VariantIngredientRow = {
  id: string;
  recipe_variant_id: string;
  inventory_item_id: string;
  input_quantity: string | number | null;
  input_unit: string | null;
  quantity: string | number;
  unit: string;
  usage_basis: "per_batch" | "per_piece";
  notes: string | null;
};

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, businessId, currency } = await getCurrentBusiness();

  if (!businessId) notFound();

  const [{ data: recipe }, { data: inventoryItems }, { data: variants }, { data: variantIngredients }] = await Promise.all([
    supabase
      .from("recipes")
      .select(
        "id, name, sku, description, batch_yield, yield_unit, selling_price, packaging_cost, labor_cost, overhead_cost, target_margin_percent, notes, is_active, recipe_ingredients(id, quantity, unit, input_quantity, input_unit, notes, inventory_items(name, brand_name, unit, cost_per_unit))"
      )
      .eq("business_id", businessId)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("inventory_items")
      .select("id, name, brand_name, unit, cost_per_unit, inventory_type, recipe_density_grams_per_cup")
      .eq("business_id", businessId)
      .in("inventory_type", ["raw_material", "packaging", "supply"])
      .order("name", { ascending: true }),
    supabase
      .from("recipe_variants")
      .select("id, name, sku, selling_price, notes, is_active")
      .eq("business_id", businessId)
      .eq("recipe_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("recipe_variant_ingredients")
      .select("id, recipe_variant_id, inventory_item_id, input_quantity, input_unit, quantity, unit, usage_basis, notes")
      .eq("business_id", businessId),
  ]);

  if (!recipe) notFound();

  const detail = recipe as unknown as RecipeDetail;
  const ingredientLines = detail.recipe_ingredients.map((ingredient) => {
    const item = Array.isArray(ingredient.inventory_items) ? ingredient.inventory_items[0] : ingredient.inventory_items;
    const lineCost = toNumber(ingredient.quantity) * toNumber(item?.cost_per_unit);
    return { ingredient, item, lineCost };
  });
  const ingredientCost = ingredientLines.reduce((total, line) => total + line.lineCost, 0);
  const inventoryCostById = new Map((inventoryItems ?? []).map((item) => [item.id, toNumber(item.cost_per_unit)]));
  const inventoryLabelById = new Map((inventoryItems ?? []).map((item) => [item.id, `${item.name}${item.brand_name ? ` - ${item.brand_name}` : ""}`]));
  const variantIngredientsById = ((variantIngredients ?? []) as VariantIngredientRow[]).reduce<Record<string, VariantIngredientRow[]>>(
    (grouped, ingredient) => {
      grouped[ingredient.recipe_variant_id] = grouped[ingredient.recipe_variant_id] ?? [];
      grouped[ingredient.recipe_variant_id].push(ingredient);
      return grouped;
    },
    {}
  );
  const cost = calculateRecipeCost({
    batchYield: toNumber(detail.batch_yield),
    sellingPrice: toNumber(detail.selling_price),
    packagingCost: toNumber(detail.packaging_cost),
    laborCost: toNumber(detail.labor_cost),
    overheadCost: toNumber(detail.overhead_cost),
    ingredientCost,
    targetMarginPercent: toNumber(detail.target_margin_percent) || 40,
  });
  const targetMargins = [30, 40, 50];
  const currentYield = toNumber(detail.batch_yield);
  const yieldScenarios = Array.from(new Set([currentYield, Math.max(1, currentYield - 2), currentYield + 2])).sort((a, b) => a - b);
  const currentPrice = toNumber(detail.selling_price);
  const recommendedProfitPerUnit = cost.recommendedPrice - cost.costPerUnit;
  const priceGap = cost.recommendedPrice - currentPrice;
  const pricingStatus =
    currentPrice <= 0
      ? "No price set"
      : priceGap > 1
        ? "Below target"
        : priceGap < -1
          ? "Above target"
          : "On target";
  const variantRows = (variants ?? []) as VariantRow[];
  const activeVariants = variantRows.filter((variant) => variant.is_active);
  const archivedVariants = variantRows.filter((variant) => !variant.is_active);

  function renderVariantCard(variant: VariantRow) {
    const extras = variantIngredientsById[variant.id] ?? [];
    const extraCost = extras.reduce(
      (total, ingredient) => {
        const batchMultiplier = ingredient.usage_basis === "per_piece" ? toNumber(detail.batch_yield) : 1;
        return total + toNumber(ingredient.quantity) * batchMultiplier * (inventoryCostById.get(ingredient.inventory_item_id) ?? 0);
      },
      0
    );
    const variantCost = calculateRecipeCost({
      batchYield: toNumber(detail.batch_yield),
      sellingPrice: toNumber(variant.selling_price),
      packagingCost: toNumber(detail.packaging_cost),
      laborCost: toNumber(detail.labor_cost),
      overheadCost: toNumber(detail.overhead_cost),
      ingredientCost: ingredientCost + extraCost,
      targetMarginPercent: cost.targetMarginPercent,
    });
    const variantSellingPrice = toNumber(variant.selling_price);
    const hasVariantSellingPrice = variantSellingPrice > 0;
    const batchYield = toNumber(detail.batch_yield);
    const batchPlanningPrice = hasVariantSellingPrice ? variantSellingPrice : variantCost.recommendedPrice;
    const profitAtRecommendedPrice = variantCost.recommendedPrice - variantCost.costPerUnit;
    const batchRevenue = batchPlanningPrice * batchYield;
    const batchProfit = batchRevenue - variantCost.totalCost;

    return (
      <div key={variant.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold">{variant.name}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{variant.sku ?? "No SKU"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={variant.is_active ? "bg-emerald-50 text-emerald-700" : "bg-[var(--surface-alt)] text-[var(--muted)]"}>
              {variant.is_active ? "Active" : "Archived"}
            </Badge>
            <RecipeVariantModal
              recipeId={id}
              inventoryItems={inventoryItems ?? []}
              currency={currency}
              variantId={variant.id}
              triggerLabel="Edit"
              initialVariant={{
                name: variant.name,
                sku: variant.sku,
                selling_price: variant.selling_price,
                notes: variant.notes,
                ingredients: extras,
              }}
            />
            <VariantStatusButton recipeId={id} variantId={variant.id} variantName={variant.name} isActive={variant.is_active} />
            <DeleteVariantButton recipeId={id} variantId={variant.id} variantName={variant.name} />
          </div>
        </div>

        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-[var(--muted)]">Per piece profit</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Actual profit uses your selling price. If none is set, use the recommended price as the working target.
              </p>
            </div>
            <p className={`text-lg font-semibold ${hasVariantSellingPrice && variantCost.profitPerUnit < 0 ? "text-red-600" : "text-[var(--foreground)]"}`}>
              {hasVariantSellingPrice ? formatMoney(variantCost.profitPerUnit, currency) : formatMoney(profitAtRecommendedPrice, currency)}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <div>
              <p className="text-xs text-[var(--muted)]">Selling / pc</p>
              <p className="mt-1 font-semibold">{hasVariantSellingPrice ? formatMoney(variantSellingPrice, currency) : "Not priced"}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Cost / pc</p>
              <p className="mt-1 font-semibold">{formatMoney(variantCost.costPerUnit, currency)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Profit / pc</p>
              <p className={`mt-1 font-semibold ${hasVariantSellingPrice && variantCost.profitPerUnit < 0 ? "text-red-600" : ""}`}>
                {hasVariantSellingPrice ? formatMoney(variantCost.profitPerUnit, currency) : "Not priced"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Profit at recommended</p>
              <p className="mt-1 font-semibold">{formatMoney(profitAtRecommendedPrice, currency)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Recommended / pc at {formatStock(variantCost.targetMarginPercent)}%</p>
              <p className="mt-1 font-semibold">{formatMoney(variantCost.recommendedPrice, currency)}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-xs text-[var(--muted)]">Batch cost</p>
            <p className="mt-1 font-semibold">{formatMoney(variantCost.totalCost, currency)}</p>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-xs text-[var(--muted)]">{hasVariantSellingPrice ? "Batch revenue" : "Est. batch revenue"}</p>
            <p className="mt-1 font-semibold">{formatMoney(batchRevenue, currency)}</p>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-xs text-[var(--muted)]">{hasVariantSellingPrice ? "Batch profit" : "Est. batch profit"}</p>
            <p className={`mt-1 font-semibold ${batchProfit < 0 ? "text-red-600" : ""}`}>{formatMoney(batchProfit, currency)}</p>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-xs text-[var(--muted)]">Extra topping cost / batch</p>
            <p className="mt-1 font-semibold">{formatMoney(extraCost, currency)}</p>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-xs text-[var(--muted)]">Recipe target margin</p>
            <p className="mt-1 font-semibold">{formatStock(variantCost.targetMarginPercent)}%</p>
          </div>
        </div>

        <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] p-3 text-sm text-[var(--muted)]">
          {hasVariantSellingPrice
            ? `At ${formatMoney(variantSellingPrice, currency)} per piece, this variant earns ${formatMoney(variantCost.profitPerUnit, currency)} per piece or ${formatMoney(batchProfit, currency)} per batch after all tracked costs.`
            : `No selling price is set yet. At the recommended ${formatMoney(variantCost.recommendedPrice, currency)} per piece, estimated profit is ${formatMoney(profitAtRecommendedPrice, currency)} per piece or ${formatMoney(batchProfit, currency)} per batch.`}
        </p>

        {extras.length > 0 ? (
          <div className="mt-4 space-y-2">
            {extras.map((ingredient) => (
              <div key={ingredient.id} className="flex flex-col gap-1 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium">{inventoryLabelById.get(ingredient.inventory_item_id) ?? "Unknown item"}</span>
                <span className="text-[var(--muted)]">
                  {formatStock(toNumber(ingredient.input_quantity ?? ingredient.quantity))} {ingredient.input_unit ?? ingredient.unit}{" "}
                  {ingredient.usage_basis === "per_piece" ? "per piece" : "per batch"} -{" "}
                  {formatMoney(
                    toNumber(ingredient.quantity) *
                      (ingredient.usage_basis === "per_piece" ? toNumber(detail.batch_yield) : 1) *
                      (inventoryCostById.get(ingredient.inventory_item_id) ?? 0),
                    currency
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] p-3 text-sm text-[var(--muted)]">
            No extra ingredients. This variant uses the base recipe cost.
          </p>
        )}
      </div>
    );
  }

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title={detail.name}
        subtitle={`${formatStock(toNumber(detail.batch_yield))} ${detail.yield_unit} per batch · ${detail.sku ?? "No SKU"}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/recipes"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-alt)]"
            >
              <ArrowLeft size={16} />
              Recipes
            </Link>
            <Link
              href={`/production/new?recipeId=${id}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-alt)]"
            >
              <Factory size={16} />
              Record production
            </Link>
            <Link
              href={`/recipes/${id}/edit`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
            >
              <Pencil size={16} />
              Edit recipe
            </Link>
          </div>
        }
      />

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Batch cost" value={formatMoney(cost.totalCost, currency)} meta="All costs included" />
        <StatCard label="Cost / unit" value={formatMoney(cost.costPerUnit, currency)} meta={`Per ${detail.yield_unit}`} />
        <StatCard label="Profit / unit" value={formatMoney(recommendedProfitPerUnit, currency)} meta={`Recommended ${formatMoney(cost.recommendedPrice, currency)}`} />
        <StatCard label="Target margin" value={`${cost.targetMarginPercent.toFixed(0)}%`} meta="Used for recommended price" />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Cost breakdown</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">Ingredient lines use current inventory item cost per unit.</p>
            </div>
            <Badge className={detail.is_active ? "bg-emerald-50 text-emerald-700" : "bg-[var(--surface-alt)] text-[var(--muted)]"}>
              {detail.is_active ? "Active" : "Archived"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {ingredientLines.map(({ ingredient, item, lineCost }) => (
              <div key={ingredient.id} className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-[minmax(0,1fr)_140px_140px]">
                <div className="flex min-w-0 gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                    <ChefHat size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item?.name ?? "Unknown item"}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item?.brand_name ?? "No brand"}</p>
                    {ingredient.notes ? <p className="mt-1 text-xs text-[var(--muted)]">{ingredient.notes}</p> : null}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Quantity</p>
                  <p className="mt-1 font-semibold">
                    {formatStock(toNumber(ingredient.input_quantity ?? ingredient.quantity))} {ingredient.input_unit ?? ingredient.unit}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Costed as {formatStock(toNumber(ingredient.quantity))} {ingredient.unit}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Line cost</p>
                  <p className="mt-1 font-semibold">{formatMoney(lineCost, currency)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch costs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["Ingredients", ingredientCost],
                ["Packaging", detail.packaging_cost],
                ["Labor", detail.labor_cost],
                ["Overhead", detail.overhead_cost],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                  <span className="text-sm text-[var(--muted)]">{label}</span>
                  <span className="font-semibold">{formatMoney(value as string | number, currency)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing note</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--muted)]">
                Recommended price for {cost.targetMarginPercent.toFixed(0)}% margin is{" "}
                <span className="font-semibold text-[var(--foreground)]">{formatMoney(cost.recommendedPrice, currency)}</span>.
              </p>
              {detail.notes ? <p className="mt-3 text-sm text-[var(--muted)]">{detail.notes}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost refresh</CardTitle>
              <p className="text-sm text-[var(--muted)]">Uses the latest inventory costs connected to this recipe.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface)]">
                    <RefreshCw size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{pricingStatus}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Current price is {formatMoney(currentPrice, currency)}. Recommended is{" "}
                      <span className="font-semibold text-[var(--foreground)]">{formatMoney(cost.recommendedPrice, currency)}</span>.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-xs text-[var(--muted)]">Price gap</p>
                  <p className="mt-1 font-semibold">{formatMoney(priceGap, currency)}</p>
                </div>
                <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-xs text-[var(--muted)]">Target margin</p>
                  <p className="mt-1 font-semibold">{cost.targetMarginPercent.toFixed(0)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Pricing scenarios</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">Compare target margins and actual yield before changing your price.</p>
            </div>
            <Badge className="bg-[var(--surface-alt)] text-[var(--foreground)]">
              <Calculator size={13} className="mr-1" />
              Decision guide
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="hidden overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[var(--surface-alt)] text-xs text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Actual yield</th>
                    <th className="px-4 py-3 font-medium">Cost / piece</th>
                    {targetMargins.map((margin) => (
                      <th key={margin} className="px-4 py-3 font-medium">Price at {margin}%</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {yieldScenarios.map((yieldValue) => {
                    const scenarioCost = calculateRecipeCost({
                      batchYield: yieldValue,
                      sellingPrice: currentPrice,
                      packagingCost: toNumber(detail.packaging_cost),
                      laborCost: toNumber(detail.labor_cost),
                      overheadCost: toNumber(detail.overhead_cost),
                      ingredientCost,
                      targetMarginPercent: cost.targetMarginPercent,
                    });

                    return (
                      <tr key={yieldValue} className="border-t border-[var(--border)]">
                        <td className="px-4 py-3 font-semibold">
                          {formatStock(yieldValue)} {detail.yield_unit}
                        </td>
                        <td className="px-4 py-3">{formatMoney(scenarioCost.costPerUnit, currency)}</td>
                        {targetMargins.map((margin) => {
                          const marginCost = calculateRecipeCost({
                            batchYield: yieldValue,
                            sellingPrice: currentPrice,
                            packagingCost: toNumber(detail.packaging_cost),
                            laborCost: toNumber(detail.labor_cost),
                            overheadCost: toNumber(detail.overhead_cost),
                            ingredientCost,
                            targetMarginPercent: margin,
                          });

                          return (
                            <td key={margin} className="px-4 py-3 font-semibold">
                              {formatMoney(marginCost.recommendedPrice, currency)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {yieldScenarios.map((yieldValue) => {
                const scenarioCost = calculateRecipeCost({
                  batchYield: yieldValue,
                  sellingPrice: currentPrice,
                  packagingCost: toNumber(detail.packaging_cost),
                  laborCost: toNumber(detail.labor_cost),
                  overheadCost: toNumber(detail.overhead_cost),
                  ingredientCost,
                  targetMarginPercent: cost.targetMarginPercent,
                });

                return (
                  <div key={yieldValue} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">
                        {formatStock(yieldValue)} {detail.yield_unit}
                      </p>
                      <p className="text-sm text-[var(--muted)]">Cost {formatMoney(scenarioCost.costPerUnit, currency)}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {targetMargins.map((margin) => {
                        const marginCost = calculateRecipeCost({
                          batchYield: yieldValue,
                          sellingPrice: currentPrice,
                          packagingCost: toNumber(detail.packaging_cost),
                          laborCost: toNumber(detail.labor_cost),
                          overheadCost: toNumber(detail.overhead_cost),
                          ingredientCost,
                          targetMarginPercent: margin,
                        });

                        return (
                          <div key={margin} className="rounded-[var(--radius-sm)] bg-[var(--surface-alt)] p-2">
                            <p className="text-xs text-[var(--muted)]">{margin}%</p>
                            <p className="mt-1 text-sm font-semibold">{formatMoney(marginCost.recommendedPrice, currency)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Variants</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">Base recipe cost plus toppings or extras per variant.</p>
            </div>
            <RecipeVariantModal recipeId={id} inventoryItems={inventoryItems ?? []} currency={currency} />
          </CardHeader>
          <CardContent className="space-y-3">
            {variantRows.length > 0 ? (
              <>
                {activeVariants.length > 0 ? (
                  activeVariants.map((variant) => renderVariantCard(variant))
                ) : (
                  <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-5">
                    <p className="font-semibold">No active variants</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Reactivate an archived variant or add a new one to use it in production and products.</p>
                  </div>
                )}

                {archivedVariants.length > 0 ? (
                  <details className="group mt-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-semibold">Archived variants</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{archivedVariants.length} hidden from production, products, and sales dropdowns.</p>
                      </div>
                      <Badge className="bg-[var(--surface)] text-[var(--muted)]">Click to expand</Badge>
                    </summary>
                    <div className="space-y-3 border-t border-[var(--border)] p-4">
                      {archivedVariants.map((variant) => renderVariantCard(variant))}
                    </div>
                  </details>
                ) : null}
              </>
            ) : (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-5">
                <p className="font-semibold">No variants yet</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Add variants like Plain, Cheese, Salted Egg, or Ube without duplicating the base recipe.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
