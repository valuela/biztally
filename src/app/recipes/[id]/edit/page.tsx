import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentBusiness } from "@/lib/inventory/utils";
import { updateRecipe } from "../../actions";
import { RecipeForm, type RecipeFormInitialValue } from "../../recipe-form";

export default async function EditRecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string | string[] }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const { supabase, user, businessId, currency } = await getCurrentBusiness();

  if (!businessId) notFound();

  const [{ data: recipe }, { data: inventoryItems }] = await Promise.all([
    supabase
      .from("recipes")
      .select(
        "id, name, sku, description, batch_yield, yield_unit, selling_price, packaging_cost, labor_cost, overhead_cost, target_margin_percent, notes, recipe_ingredients(id, inventory_item_id, input_quantity, input_unit, quantity, unit, notes)"
      )
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase
      .from("inventory_items")
      .select("id, name, brand_name, unit, cost_per_unit, inventory_type, recipe_density_grams_per_cup, recipe_measurement_note")
      .eq("business_id", businessId)
      .in("inventory_type", ["raw_material", "packaging", "supply"])
      .order("name", { ascending: true }),
  ]);

  if (!recipe) notFound();

  const error = Array.isArray(resolvedSearchParams?.error) ? resolvedSearchParams?.error[0] : resolvedSearchParams?.error;
  const action = updateRecipe.bind(null, id);

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Edit recipe"
        subtitle={`Update costing, yield, and ingredients for ${recipe.name}.`}
        action={
          <Link
            href={`/recipes/${id}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-alt)]"
          >
            <ArrowLeft size={16} />
            Back to recipe
          </Link>
        }
      />

      {error ? (
        <Card className="mt-6 border-red-200 bg-red-50 shadow-none">
          <CardContent className="p-4">
            <FormAlert>{error}</FormAlert>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6">
        <RecipeForm
          inventoryItems={inventoryItems ?? []}
          currency={currency}
          action={action}
          initialRecipe={recipe as unknown as RecipeFormInitialValue}
          submitLabel="Save changes"
          cancelHref={`/recipes/${id}`}
        />
      </div>
    </AppShell>
  );
}
