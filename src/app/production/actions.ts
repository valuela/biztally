"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentBusiness, parseNumber, toNumber } from "@/lib/inventory/utils";
import { calculateRecipeCost } from "@/lib/recipes/costing";

function fail(message: string): never {
  redirect(`/production/new?error=${encodeURIComponent(message)}`);
}

function failEdit(runId: string, message: string): never {
  redirect(`/production/${runId}/edit?error=${encodeURIComponent(message)}`);
}

type RecipeRow = {
  id: string;
  name: string;
  batch_yield: string | number;
  yield_unit: string;
  selling_price: string | number;
  packaging_cost: string | number;
  labor_cost: string | number;
  overhead_cost: string | number;
  target_margin_percent: string | number | null;
};

type RecipeIngredientRow = {
  recipe_id: string;
  inventory_item_id: string;
  quantity: string | number;
};

type RecipeVariantRow = {
  id: string;
  recipe_id: string;
  name: string;
  selling_price: string | number;
};

type VariantIngredientRow = {
  recipe_variant_id: string;
  inventory_item_id: string;
  quantity: string | number;
  usage_basis: "per_batch" | "per_piece";
};

async function buildProductionSnapshot(
  supabase: Awaited<ReturnType<typeof getCurrentBusiness>>["supabase"],
  businessId: string,
  formData: FormData,
  failCurrent: (message: string) => never
) {
  const recipeId = String(formData.get("recipe_id") ?? "").trim();
  const variantIdRaw = String(formData.get("recipe_variant_id") ?? "").trim();
  const variantId = variantIdRaw || null;
  const productionDate = String(formData.get("production_date") ?? "").trim();
  const quantityProduced = parseNumber(formData.get("quantity_produced"));
  const sellingPriceRaw = String(formData.get("selling_price_per_unit") ?? "").trim();
  const manualSellingPrice = sellingPriceRaw ? parseNumber(sellingPriceRaw) : null;
  const notes = String(formData.get("notes") ?? "").trim();

  if (!recipeId) failCurrent("Choose a recipe.");
  if (!Number.isFinite(quantityProduced) || quantityProduced <= 0) failCurrent("Quantity produced must be greater than zero.");
  if (manualSellingPrice != null && (!Number.isFinite(manualSellingPrice) || manualSellingPrice < 0)) {
    failCurrent("Selling price per unit must be zero or higher.");
  }

  const [{ data: recipe }, { data: recipeIngredients }, { data: inventoryItems }, { data: variant }, { data: variantIngredients }] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, name, batch_yield, yield_unit, selling_price, packaging_cost, labor_cost, overhead_cost, target_margin_percent")
      .eq("business_id", businessId)
      .eq("id", recipeId)
      .maybeSingle(),
    supabase
      .from("recipe_ingredients")
      .select("recipe_id, inventory_item_id, quantity")
      .eq("business_id", businessId)
      .eq("recipe_id", recipeId),
    supabase.from("inventory_items").select("id, cost_per_unit").eq("business_id", businessId),
    variantId
      ? supabase
          .from("recipe_variants")
          .select("id, recipe_id, name, selling_price")
          .eq("business_id", businessId)
          .eq("recipe_id", recipeId)
          .eq("id", variantId)
          .eq("is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    variantId
      ? supabase
          .from("recipe_variant_ingredients")
          .select("recipe_variant_id, inventory_item_id, quantity, usage_basis")
          .eq("business_id", businessId)
          .eq("recipe_variant_id", variantId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (!recipe) failCurrent("Recipe was not found.");
  if (variantId && !variant) failCurrent("Variant was not found.");

  const recipeRow = recipe as RecipeRow;
  const variantRow = variant as RecipeVariantRow | null;
  const costByInventoryItemId = new Map((inventoryItems ?? []).map((item) => [item.id, toNumber(item.cost_per_unit)]));
  const baseIngredientCost = ((recipeIngredients ?? []) as RecipeIngredientRow[]).reduce(
    (total, ingredient) => total + toNumber(ingredient.quantity) * (costByInventoryItemId.get(ingredient.inventory_item_id) ?? 0),
    0
  );
  const extraIngredientCost = ((variantIngredients ?? []) as VariantIngredientRow[]).reduce((total, ingredient) => {
    const batchMultiplier = ingredient.usage_basis === "per_piece" ? toNumber(recipeRow.batch_yield) : 1;
    return total + toNumber(ingredient.quantity) * batchMultiplier * (costByInventoryItemId.get(ingredient.inventory_item_id) ?? 0);
  }, 0);

  const defaultSellingPrice = toNumber(variantRow?.selling_price) > 0 ? toNumber(variantRow?.selling_price) : toNumber(recipeRow.selling_price);
  const sellingPricePerUnit = manualSellingPrice ?? defaultSellingPrice;
  const cost = calculateRecipeCost({
    batchYield: toNumber(recipeRow.batch_yield),
    sellingPrice: sellingPricePerUnit,
    packagingCost: toNumber(recipeRow.packaging_cost),
    laborCost: toNumber(recipeRow.labor_cost),
    overheadCost: toNumber(recipeRow.overhead_cost),
    ingredientCost: baseIngredientCost + extraIngredientCost,
    targetMarginPercent: toNumber(recipeRow.target_margin_percent) || 40,
  });

  const totalCost = cost.costPerUnit * quantityProduced;
  const totalRevenue = sellingPricePerUnit * quantityProduced;
  const totalProfit = totalRevenue - totalCost;

  return {
    recipeId,
    run: {
      production_date: productionDate || new Date().toISOString().slice(0, 10),
      status: "completed",
      notes: notes || null,
      total_cost: Number(totalCost.toFixed(2)),
      total_revenue: Number(totalRevenue.toFixed(2)),
      total_profit: Number(totalProfit.toFixed(2)),
    },
    item: {
      business_id: businessId,
      recipe_id: recipeRow.id,
      recipe_variant_id: variantRow?.id ?? null,
      recipe_name: recipeRow.name,
      variant_name: variantRow?.name ?? null,
      quantity_produced: quantityProduced,
      yield_unit: recipeRow.yield_unit,
      cost_per_unit: Number(cost.costPerUnit.toFixed(4)),
      selling_price_per_unit: Number(sellingPricePerUnit.toFixed(4)),
      total_cost: Number(totalCost.toFixed(2)),
      total_revenue: Number(totalRevenue.toFixed(2)),
      total_profit: Number(totalProfit.toFixed(2)),
    },
  };
}

export async function createProductionRun(formData: FormData) {
  const { supabase, user, businessId } = await getCurrentBusiness();

  if (!businessId) {
    fail("No business is linked to this account yet.");
  }

  const snapshot = await buildProductionSnapshot(supabase, businessId, formData, fail);

  const { data: run, error: runError } = await supabase
    .from("production_runs")
    .insert({
      business_id: businessId,
      ...snapshot.run,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (runError || !run) {
    fail(runError?.message || "Could not save production run.");
  }

  const { error: itemError } = await supabase.from("production_run_items").insert({
    ...snapshot.item,
    production_run_id: run.id,
  });

  if (itemError) {
    await supabase.from("production_runs").delete().eq("id", run.id).eq("business_id", businessId);
    fail(itemError.message || "Could not save production item.");
  }

  revalidatePath("/production");
  revalidatePath(`/recipes/${snapshot.recipeId}`);
  redirect(`/production?success=${encodeURIComponent("Production run recorded.")}`);
}

export async function updateProductionRun(runId: string, formData: FormData) {
  const { supabase, businessId } = await getCurrentBusiness();
  const failCurrent = (message: string): never => failEdit(runId, message);

  if (!businessId) {
    failCurrent("No business is linked to this account yet.");
  }

  const { data: existingRun } = await supabase
    .from("production_runs")
    .select("id")
    .eq("id", runId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!existingRun) {
    failCurrent("Production run was not found.");
  }

  const snapshot = await buildProductionSnapshot(supabase, businessId, formData, failCurrent);

  const { error: runError } = await supabase
    .from("production_runs")
    .update({
      ...snapshot.run,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("business_id", businessId);

  if (runError) {
    failCurrent(runError.message || "Could not update production run.");
  }

  const { error: deleteError } = await supabase.from("production_run_items").delete().eq("production_run_id", runId).eq("business_id", businessId);

  if (deleteError) {
    failCurrent(deleteError.message || "Could not replace production item.");
  }

  const { error: itemError } = await supabase.from("production_run_items").insert({
    ...snapshot.item,
    production_run_id: runId,
  });

  if (itemError) {
    failCurrent(itemError.message || "Could not save production item.");
  }

  revalidatePath("/production");
  revalidatePath(`/production/${runId}/edit`);
  revalidatePath(`/recipes/${snapshot.recipeId}`);
  redirect(`/production?success=${encodeURIComponent("Production run updated.")}`);
}

export async function deleteProductionRun(runId: string) {
  const { supabase, businessId } = await getCurrentBusiness();

  if (!businessId) {
    redirect(`/production?error=${encodeURIComponent("No business is linked to this account yet.")}`);
  }

  const { error } = await supabase.from("production_runs").delete().eq("id", runId).eq("business_id", businessId);

  if (error) {
    redirect(`/production?error=${encodeURIComponent(error.message || "Could not delete production run.")}`);
  }

  revalidatePath("/production");
  redirect(`/production?success=${encodeURIComponent("Production run deleted.")}`);
}
