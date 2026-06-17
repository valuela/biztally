"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentBusiness, parseNumber, toNumber } from "@/lib/inventory/utils";
import { calculateRecipeCost } from "@/lib/recipes/costing";

function fail(message: string): never {
  redirect(`/sales/new?error=${encodeURIComponent(message)}`);
}

type ProductRow = {
  id: string;
  name: string;
  recipe_id: string;
  recipe_variant_id: string | null;
  units_per_package: string | number;
  package_label: string;
  selling_price: string | number;
  packaging_cost: string | number;
  recipes: {
    batch_yield: string | number;
    selling_price: string | number;
    packaging_cost: string | number;
    labor_cost: string | number;
    overhead_cost: string | number;
    target_margin_percent: string | number | null;
  } | null;
  recipe_variants: {
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

type ProductionItemRow = {
  recipe_id: string;
  recipe_variant_id: string | null;
  quantity_produced: string | number;
};

type SaleItemRow = {
  sellable_product_id: string;
  quantity_sold: string | number;
};

async function getProductSnapshot(
  supabase: Awaited<ReturnType<typeof getCurrentBusiness>>["supabase"],
  businessId: string,
  productId: string
) {
  const [{ data: product }, { data: ingredientRows }, { data: variantIngredientRows }, { data: inventoryRows }, { data: productionRows }, { data: saleRows }] =
    await Promise.all([
      supabase
        .from("sellable_products")
        .select(
          "id, name, recipe_id, recipe_variant_id, units_per_package, package_label, selling_price, packaging_cost, recipes(batch_yield, selling_price, packaging_cost, labor_cost, overhead_cost, target_margin_percent), recipe_variants(selling_price)"
        )
        .eq("business_id", businessId)
        .eq("id", productId)
        .maybeSingle(),
      supabase.from("recipe_ingredients").select("recipe_id, inventory_item_id, quantity").eq("business_id", businessId),
      supabase.from("recipe_variant_ingredients").select("recipe_variant_id, inventory_item_id, quantity, usage_basis").eq("business_id", businessId),
      supabase.from("inventory_items").select("id, cost_per_unit").eq("business_id", businessId),
      supabase.from("production_run_items").select("recipe_id, recipe_variant_id, quantity_produced").eq("business_id", businessId),
      supabase.from("sale_items").select("sellable_product_id, quantity_sold").eq("business_id", businessId),
    ]);

  if (!product) return null;

  const row = product as unknown as ProductRow;
  const recipe = row.recipes;
  const costByInventoryId = new Map((inventoryRows ?? []).map((item) => [item.id, toNumber(item.cost_per_unit)]));
  const baseIngredientCost = ((ingredientRows ?? []) as RecipeIngredientRow[])
    .filter((ingredient) => ingredient.recipe_id === row.recipe_id)
    .reduce((total, ingredient) => total + toNumber(ingredient.quantity) * (costByInventoryId.get(ingredient.inventory_item_id) ?? 0), 0);
  const extraIngredientCost = row.recipe_variant_id
    ? ((variantIngredientRows ?? []) as VariantIngredientRow[])
        .filter((ingredient) => ingredient.recipe_variant_id === row.recipe_variant_id)
        .reduce((total, ingredient) => {
          const multiplier = ingredient.usage_basis === "per_piece" ? toNumber(recipe?.batch_yield) : 1;
          return total + toNumber(ingredient.quantity) * multiplier * (costByInventoryId.get(ingredient.inventory_item_id) ?? 0);
        }, 0)
    : 0;
  const recipeCost = calculateRecipeCost({
    batchYield: toNumber(recipe?.batch_yield),
    sellingPrice: toNumber(row.recipe_variants?.selling_price) || toNumber(recipe?.selling_price),
    packagingCost: toNumber(recipe?.packaging_cost),
    laborCost: toNumber(recipe?.labor_cost),
    overheadCost: toNumber(recipe?.overhead_cost),
    ingredientCost: baseIngredientCost + extraIngredientCost,
    targetMarginPercent: toNumber(recipe?.target_margin_percent) || 40,
  });
  const costPerPackage = recipeCost.costPerUnit * toNumber(row.units_per_package) + toNumber(row.packaging_cost);
  const producedUnits = ((productionRows ?? []) as ProductionItemRow[])
    .filter((item) => item.recipe_id === row.recipe_id && (item.recipe_variant_id ?? null) === (row.recipe_variant_id ?? null))
    .reduce((total, item) => total + toNumber(item.quantity_produced), 0);
  const producedPackages = toNumber(row.units_per_package) > 0 ? producedUnits / toNumber(row.units_per_package) : 0;
  const soldPackages = ((saleRows ?? []) as SaleItemRow[])
    .filter((item) => item.sellable_product_id === row.id)
    .reduce((total, item) => total + toNumber(item.quantity_sold), 0);

  return {
    product: row,
    costPerPackage,
    availablePackages: Math.max(0, producedPackages - soldPackages),
  };
}

export async function createSale(formData: FormData) {
  const { supabase, user, businessId } = await getCurrentBusiness();

  if (!businessId) fail("No business is linked to this account yet.");

  const productId = String(formData.get("sellable_product_id") ?? "").trim();
  const saleDate = String(formData.get("sale_date") ?? "").trim();
  const quantitySold = parseNumber(formData.get("quantity_sold"));
  const sellingPriceRaw = String(formData.get("selling_price_per_package") ?? "").trim();
  const sellingPricePerPackage = sellingPriceRaw ? parseNumber(sellingPriceRaw) : null;
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const paymentMethod = String(formData.get("payment_method") ?? "").trim() || "cash";
  const status = String(formData.get("status") ?? "").trim() || "paid";
  const notes = String(formData.get("notes") ?? "").trim();

  if (!productId) fail("Choose a product.");
  if (!Number.isFinite(quantitySold) || quantitySold <= 0) fail("Quantity sold must be greater than zero.");

  const snapshot = await getProductSnapshot(supabase, businessId, productId);
  if (!snapshot) fail("Product was not found.");
  if (quantitySold > snapshot.availablePackages) {
    fail(`Not enough production available. Available: ${snapshot.availablePackages.toFixed(2)} ${snapshot.product.package_label}.`);
  }

  const finalSellingPrice = sellingPricePerPackage ?? toNumber(snapshot.product.selling_price);
  if (!Number.isFinite(finalSellingPrice) || finalSellingPrice < 0) fail("Selling price must be zero or higher.");

  const totalRevenue = finalSellingPrice * quantitySold;
  const totalCost = snapshot.costPerPackage * quantitySold;
  const totalProfit = totalRevenue - totalCost;

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      business_id: businessId,
      sale_date: saleDate || new Date().toISOString().slice(0, 10),
      customer_name: customerName || null,
      payment_method: paymentMethod,
      status,
      notes: notes || null,
      total_revenue: Number(totalRevenue.toFixed(2)),
      total_cost: Number(totalCost.toFixed(2)),
      total_profit: Number(totalProfit.toFixed(2)),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (saleError || !sale) fail(saleError?.message || "Could not save sale.");

  const { error: itemError } = await supabase.from("sale_items").insert({
    business_id: businessId,
    sale_id: sale.id,
    sellable_product_id: snapshot.product.id,
    product_name: snapshot.product.name,
    quantity_sold: quantitySold,
    package_label: snapshot.product.package_label,
    units_per_package: toNumber(snapshot.product.units_per_package),
    units_sold: quantitySold * toNumber(snapshot.product.units_per_package),
    selling_price_per_package: Number(finalSellingPrice.toFixed(2)),
    cost_per_package: Number(snapshot.costPerPackage.toFixed(2)),
    total_revenue: Number(totalRevenue.toFixed(2)),
    total_cost: Number(totalCost.toFixed(2)),
    total_profit: Number(totalProfit.toFixed(2)),
  });

  if (itemError) {
    await supabase.from("sales").delete().eq("id", sale.id).eq("business_id", businessId);
    fail(itemError.message || "Could not save sale item.");
  }

  revalidatePath("/sales");
  redirect(`/sales?success=${encodeURIComponent("Sale recorded.")}`);
}
