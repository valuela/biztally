import Link from "next/link";
import { ChefHat, Plus, ReceiptText, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getCurrentBusiness, formatMoney, formatStock, toNumber } from "@/lib/inventory/utils";
import { calculateRecipeCost } from "@/lib/recipes/costing";

type RecipeIngredientRow = {
  recipe_id: string;
  inventory_item_id: string;
  quantity: string | number;
};

type RecipeRow = {
  id: string;
  name: string;
  sku: string | null;
  batch_yield: string | number;
  yield_unit: string;
  selling_price: string | number;
  packaging_cost: string | number;
  labor_cost: string | number;
  overhead_cost: string | number;
  is_active: boolean;
  updated_at: string;
};

export default async function RecipesPage() {
  const { supabase, user, businessId, currency } = await getCurrentBusiness();

  const [{ data, error: recipesError }, { data: ingredientRows, error: ingredientsError }, { data: inventoryRows, error: inventoryError }] =
    businessId
      ? await Promise.all([
          supabase
            .from("recipes")
            .select("id, name, sku, batch_yield, yield_unit, selling_price, packaging_cost, labor_cost, overhead_cost, is_active, updated_at")
            .eq("business_id", businessId)
            .order("updated_at", { ascending: false }),
          supabase
            .from("recipe_ingredients")
            .select("recipe_id, inventory_item_id, quantity")
            .eq("business_id", businessId),
          supabase
            .from("inventory_items")
            .select("id, cost_per_unit")
            .eq("business_id", businessId),
        ])
      : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

  const loadError = recipesError ?? ingredientsError ?? inventoryError;

  const recipes = (data ?? []) as unknown as RecipeRow[];
  const ingredients = (ingredientRows ?? []) as RecipeIngredientRow[];
  const costByInventoryItemId = new Map((inventoryRows ?? []).map((item) => [item.id, toNumber(item.cost_per_unit)]));
  const ingredientsByRecipeId = ingredients.reduce<Record<string, RecipeIngredientRow[]>>((grouped, ingredient) => {
    grouped[ingredient.recipe_id] = grouped[ingredient.recipe_id] ?? [];
    grouped[ingredient.recipe_id].push(ingredient);
    return grouped;
  }, {});

  const costedRecipes = recipes.map((recipe) => {
    const ingredientCost = (ingredientsByRecipeId[recipe.id] ?? []).reduce(
      (total, ingredient) => total + toNumber(ingredient.quantity) * (costByInventoryItemId.get(ingredient.inventory_item_id) ?? 0),
      0
    );
    const cost = calculateRecipeCost({
      batchYield: toNumber(recipe.batch_yield),
      sellingPrice: toNumber(recipe.selling_price),
      packagingCost: toNumber(recipe.packaging_cost),
      laborCost: toNumber(recipe.labor_cost),
      overheadCost: toNumber(recipe.overhead_cost),
      ingredientCost,
      targetMarginPercent: 40,
    });

    return { recipe, ingredientCost, cost };
  });

  const averageMargin =
    costedRecipes.length > 0
      ? costedRecipes.reduce((total, item) => total + item.cost.marginPercent, 0) / costedRecipes.length
      : 0;
  const profitableRecipes = costedRecipes.filter((item) => item.cost.profitPerUnit > 0).length;
  const highestCostRecipe = [...costedRecipes].sort((a, b) => b.cost.costPerUnit - a.cost.costPerUnit)[0];

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Recipes"
        subtitle="Turn inventory costs into product pricing decisions."
        action={
          <Link
            href="/recipes/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
          >
            <Plus size={16} />
            New recipe
          </Link>
        }
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Recipes" value={recipes.length.toString()} meta="Costed products" />
        <StatCard label="Average margin" value={`${averageMargin.toFixed(1)}%`} meta="Based on selling price" />
        <StatCard
          label="Highest cost"
          value={highestCostRecipe ? formatMoney(highestCostRecipe.cost.costPerUnit, currency) : formatMoney(0, currency)}
          meta={highestCostRecipe?.recipe.name ?? "No recipe yet"}
        />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Product costing</CardTitle>
            <p className="text-sm text-[var(--muted)]">Review cost per unit, profit, and margin for each recipe.</p>
          </CardHeader>
          <CardContent>
            {loadError ? (
              <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Could not load recipes: {loadError.message}
              </div>
            ) : costedRecipes.length > 0 ? (
              <div className="space-y-3">
                {costedRecipes.map(({ recipe, ingredientCost, cost }) => (
                  <Link
                    key={recipe.id}
                    href={`/recipes/${recipe.id}`}
                    className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-alt)] md:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(110px,1fr))]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                          <ChefHat size={17} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--foreground)]">{recipe.name}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {recipe.sku ?? "No SKU"} · {formatStock(toNumber(recipe.batch_yield))} {recipe.yield_unit} per batch
                          </p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--muted)]">Ingredient cost</p>
                      <p className="mt-1 font-semibold">{formatMoney(ingredientCost, currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--muted)]">Cost / unit</p>
                      <p className="mt-1 font-semibold">{formatMoney(cost.costPerUnit, currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--muted)]">Profit / unit</p>
                      <p className="mt-1 font-semibold">{formatMoney(cost.profitPerUnit, currency)}</p>
                    </div>
                    <div className="flex items-start justify-between gap-3 md:block">
                      <div>
                        <p className="text-xs text-[var(--muted)]">Margin</p>
                        <p className="mt-1 font-semibold">{cost.marginPercent.toFixed(1)}%</p>
                      </div>
                      <Badge className={recipe.is_active ? "bg-emerald-50 text-emerald-700" : "bg-[var(--surface-alt)] text-[var(--muted)]"}>
                        {recipe.is_active ? "Active" : "Archived"}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-6">
                <p className="font-semibold">No recipes yet</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Create your first recipe to calculate cost per piece and recommended pricing.</p>
                <Link
                  href="/recipes/new"
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
                >
                  Create recipe
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Costing checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "Keep ingredient costs updated from inventory receiving.",
                "Add packaging, labor, and overhead per batch.",
                "Review margin before changing selling price.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                  <ReceiptText size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                  <p className="text-sm text-[var(--foreground)]">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profit signal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                  <TrendingUp size={18} />
                </span>
                <div>
                  <p className="text-2xl font-bold">{profitableRecipes}/{recipes.length}</p>
                  <p className="text-sm text-[var(--muted)]">Recipes are profitable at current price.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
