"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentBusiness, parseNumber, toNumber } from "@/lib/inventory/utils";
import { calculateRecipeCost } from "@/lib/recipes/costing";

function fail(message: string, returnPath = "/sales/new"): never {
  redirect(`${returnPath}?error=${encodeURIComponent(message)}`);
}

type ProductRow = {
  id: string;
  name: string;
  product_type: string;
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
  selling_price: string | number;
  packaging_cost: string | number;
  labor_cost: string | number;
  overhead_cost: string | number;
  target_margin_percent: string | number | null;
};

type VariantRow = {
  id: string;
  selling_price: string | number;
  is_active: boolean;
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
  sale_id: string;
  sellable_product_id: string;
  quantity_sold: string | number;
  units_sold: string | number;
};

type SaleLineInput = {
  productId: string;
  quantitySold: number;
  sellingPricePerPackage: number;
};

async function getProductSnapshot(
  supabase: Awaited<ReturnType<typeof getCurrentBusiness>>["supabase"],
  businessId: string,
  productId: string,
  excludedSaleId?: string
) {
  const [{ data: product }, { data: productPoolRows }, { data: ingredientRows }, { data: variantIngredientRows }, { data: inventoryRows }, { data: productionRows }, { data: saleRows }] =
    await Promise.all([
      supabase
        .from("sellable_products")
        .select(
          "id, name, product_type, recipe_id, recipe_variant_id, units_per_package, package_label, selling_price, packaging_cost, recipes(batch_yield, selling_price, packaging_cost, labor_cost, overhead_cost, target_margin_percent), recipe_variants(selling_price), sellable_product_components(sellable_product_id, recipe_id, recipe_variant_id, units_per_package)"
        )
        .eq("business_id", businessId)
        .eq("id", productId)
        .maybeSingle(),
      supabase.from("sellable_products").select("id, recipe_id, recipe_variant_id, units_per_package, sellable_product_components(sellable_product_id, recipe_id, recipe_variant_id, units_per_package)").eq("business_id", businessId),
      supabase.from("recipe_ingredients").select("recipe_id, inventory_item_id, quantity").eq("business_id", businessId),
      supabase.from("recipe_variant_ingredients").select("recipe_variant_id, inventory_item_id, quantity, usage_basis").eq("business_id", businessId),
      supabase.from("inventory_items").select("id, cost_per_unit").eq("business_id", businessId),
      supabase.from("production_run_items").select("recipe_id, recipe_variant_id, quantity_produced").eq("business_id", businessId),
      supabase.from("sale_items").select("sale_id, sellable_product_id, quantity_sold, units_sold").eq("business_id", businessId),
    ]);

  if (!product) return null;

  const row = product as unknown as ProductRow;
  const components =
    "sellable_product_components" in row && Array.isArray(row.sellable_product_components) && row.sellable_product_components.length > 0
      ? (row.sellable_product_components as ProductComponentRow[])
      : [{ sellable_product_id: row.id, recipe_id: row.recipe_id, recipe_variant_id: row.recipe_variant_id, units_per_package: row.units_per_package }];
  const costByInventoryId = new Map((inventoryRows ?? []).map((item) => [item.id, toNumber(item.cost_per_unit)]));
  const recipeIds = Array.from(new Set(components.map((component) => component.recipe_id)));
  const variantIds = Array.from(new Set(components.map((component) => component.recipe_variant_id).filter((value): value is string => Boolean(value))));
  const [{ data: componentRecipes }, { data: componentVariants }] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, batch_yield, selling_price, packaging_cost, labor_cost, overhead_cost, target_margin_percent")
      .eq("business_id", businessId)
      .in("id", recipeIds),
    variantIds.length > 0
      ? supabase.from("recipe_variants").select("id, selling_price, is_active").eq("business_id", businessId).in("id", variantIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const recipeById = new Map(((componentRecipes ?? []) as RecipeRow[]).map((recipe) => [recipe.id, recipe]));
  const variantById = new Map(((componentVariants ?? []) as VariantRow[]).map((variant) => [variant.id, variant]));
  if (components.some((component) => component.recipe_variant_id && variantById.get(component.recipe_variant_id)?.is_active !== true)) {
    return null;
  }

  const costPerPackage =
    components.reduce((total, component) => {
      const recipe = recipeById.get(component.recipe_id);
      const variant = component.recipe_variant_id ? variantById.get(component.recipe_variant_id) : null;
      const baseIngredientCost = ((ingredientRows ?? []) as RecipeIngredientRow[])
        .filter((ingredient) => ingredient.recipe_id === component.recipe_id)
        .reduce((ingredientTotal, ingredient) => ingredientTotal + toNumber(ingredient.quantity) * (costByInventoryId.get(ingredient.inventory_item_id) ?? 0), 0);
      const extraIngredientCost = component.recipe_variant_id
        ? ((variantIngredientRows ?? []) as VariantIngredientRow[])
            .filter((ingredient) => ingredient.recipe_variant_id === component.recipe_variant_id)
            .reduce((ingredientTotal, ingredient) => {
              const multiplier = ingredient.usage_basis === "per_piece" ? toNumber(recipe?.batch_yield) : 1;
              return ingredientTotal + toNumber(ingredient.quantity) * multiplier * (costByInventoryId.get(ingredient.inventory_item_id) ?? 0);
            }, 0)
        : 0;
      const recipeCost = calculateRecipeCost({
        batchYield: toNumber(recipe?.batch_yield),
        sellingPrice: toNumber(variant?.selling_price) || toNumber(recipe?.selling_price),
        packagingCost: toNumber(recipe?.packaging_cost),
        laborCost: toNumber(recipe?.labor_cost),
        overheadCost: toNumber(recipe?.overhead_cost),
        ingredientCost: baseIngredientCost + extraIngredientCost,
        targetMarginPercent: toNumber(recipe?.target_margin_percent) || 40,
      });
      return total + recipeCost.costPerUnit * toNumber(component.units_per_package);
    }, 0) + toNumber(row.packaging_cost);

  const availableByComponent = components.map((component) => {
    const producedUnits = ((productionRows ?? []) as ProductionItemRow[])
      .filter((item) => item.recipe_id === component.recipe_id && (item.recipe_variant_id ?? null) === (component.recipe_variant_id ?? null))
      .reduce((total, item) => total + toNumber(item.quantity_produced), 0);
    const soldUnits = ((saleRows ?? []) as SaleItemRow[]).reduce((total, saleItem) => {
      if (excludedSaleId && saleItem.sale_id === excludedSaleId) return total;
      const soldProduct = ((productPoolRows ?? []) as (Pick<ProductRow, "id" | "recipe_id" | "recipe_variant_id" | "units_per_package"> & { sellable_product_components?: ProductComponentRow[] })[]).find(
        (item) => item.id === saleItem.sellable_product_id
      );
      if (!soldProduct) return total;
      const soldComponents =
        soldProduct.sellable_product_components && soldProduct.sellable_product_components.length > 0
          ? soldProduct.sellable_product_components
          : [{ sellable_product_id: soldProduct.id, recipe_id: soldProduct.recipe_id, recipe_variant_id: soldProduct.recipe_variant_id, units_per_package: soldProduct.units_per_package }];
      return (
        total +
        soldComponents
          .filter((soldComponent) => soldComponent.recipe_id === component.recipe_id && (soldComponent.recipe_variant_id ?? null) === (component.recipe_variant_id ?? null))
          .reduce((componentTotal, soldComponent) => componentTotal + toNumber(saleItem.units_sold) / Math.max(1, toNumber(soldProduct.units_per_package)) * toNumber(soldComponent.units_per_package), 0)
      );
    }, 0);
    const remainingUnits = Math.max(0, producedUnits - soldUnits);
    return toNumber(component.units_per_package) > 0 ? remainingUnits / toNumber(component.units_per_package) : 0;
  });

  return {
    product: row,
    components,
    costPerPackage,
    availablePackages: availableByComponent.length > 0 ? Math.min(...availableByComponent) : 0,
    componentAvailability: components.map((component) => {
      const producedUnits = ((productionRows ?? []) as ProductionItemRow[])
        .filter((item) => item.recipe_id === component.recipe_id && (item.recipe_variant_id ?? null) === (component.recipe_variant_id ?? null))
        .reduce((total, item) => total + toNumber(item.quantity_produced), 0);
      const soldUnits = ((saleRows ?? []) as SaleItemRow[]).reduce((total, saleItem) => {
        if (excludedSaleId && saleItem.sale_id === excludedSaleId) return total;
        const soldProduct = ((productPoolRows ?? []) as (Pick<ProductRow, "id" | "recipe_id" | "recipe_variant_id" | "units_per_package"> & { sellable_product_components?: ProductComponentRow[] })[]).find(
          (item) => item.id === saleItem.sellable_product_id
        );
        if (!soldProduct) return total;
        const soldComponents =
          soldProduct.sellable_product_components && soldProduct.sellable_product_components.length > 0
            ? soldProduct.sellable_product_components
            : [{ sellable_product_id: soldProduct.id, recipe_id: soldProduct.recipe_id, recipe_variant_id: soldProduct.recipe_variant_id, units_per_package: soldProduct.units_per_package }];
        return (
          total +
          soldComponents
            .filter((soldComponent) => soldComponent.recipe_id === component.recipe_id && (soldComponent.recipe_variant_id ?? null) === (component.recipe_variant_id ?? null))
            .reduce((componentTotal, soldComponent) => componentTotal + toNumber(saleItem.quantity_sold) * toNumber(soldComponent.units_per_package), 0)
        );
      }, 0);

      return {
        recipeId: component.recipe_id,
        variantId: component.recipe_variant_id ?? null,
        unitsPerPackage: toNumber(component.units_per_package),
        remainingUnits: Math.max(0, producedUnits - soldUnits),
      };
    }),
  };
}

function parseSaleLines(formData: FormData, returnPath: string) {
  const productIds = formData.getAll("sellable_product_id").map((value) => String(value).trim());
  const quantities = formData.getAll("quantity_sold").map((value) => parseNumber(value));
  const sellingPrices = formData.getAll("selling_price_per_package").map((value) => parseNumber(value));
  const lines = productIds
    .map((productId, index) => ({
      productId,
      quantitySold: quantities[index],
      sellingPricePerPackage: sellingPrices[index],
    }))
    .filter((line) => line.productId);

  if (lines.length === 0) fail("Add at least one product.", returnPath);

  for (const line of lines) {
    if (!Number.isFinite(line.quantitySold) || line.quantitySold <= 0) fail("Quantity sold must be greater than zero.", returnPath);
    if (!Number.isFinite(line.sellingPricePerPackage) || line.sellingPricePerPackage < 0) fail("Selling price must be zero or higher.", returnPath);
  }

  return lines as SaleLineInput[];
}

async function buildSaleValues(
  supabase: Awaited<ReturnType<typeof getCurrentBusiness>>["supabase"],
  businessId: string,
  lines: SaleLineInput[],
  returnPath: string,
  excludedSaleId?: string
) {
  const snapshots = await Promise.all(lines.map((line) => getProductSnapshot(supabase, businessId, line.productId, excludedSaleId)));
  const componentDemand = new Map<string, { demand: number; remaining: number; label: string }>();

  const itemValues = snapshots.map((snapshot, index) => {
    const line = lines[index];
    if (!snapshot) fail("One or more products could not be found or are inactive.", returnPath);

    if (line.quantitySold > snapshot.availablePackages) {
      fail(`Not enough production available for ${snapshot.product.name}. Available: ${snapshot.availablePackages.toFixed(2)} ${snapshot.product.package_label}.`, returnPath);
    }

    for (const component of snapshot.componentAvailability) {
      const key = `${component.recipeId}:${component.variantId ?? "base"}`;
      const existing = componentDemand.get(key) ?? {
        demand: 0,
        remaining: component.remainingUnits,
        label: snapshot.product.name,
      };
      existing.demand += line.quantitySold * component.unitsPerPackage;
      existing.remaining = Math.min(existing.remaining, component.remainingUnits);
      componentDemand.set(key, existing);
    }

    const totalRevenue = line.sellingPricePerPackage * line.quantitySold;
    const totalCost = snapshot.costPerPackage * line.quantitySold;

    return {
      business_id: businessId,
      sellable_product_id: snapshot.product.id,
      product_name: snapshot.product.name,
      quantity_sold: line.quantitySold,
      package_label: snapshot.product.package_label,
      units_per_package: toNumber(snapshot.product.units_per_package),
      units_sold: line.quantitySold * toNumber(snapshot.product.units_per_package),
      selling_price_per_package: Number(line.sellingPricePerPackage.toFixed(2)),
      cost_per_package: Number(snapshot.costPerPackage.toFixed(2)),
      total_revenue: Number(totalRevenue.toFixed(2)),
      total_cost: Number(totalCost.toFixed(2)),
      total_profit: Number((totalRevenue - totalCost).toFixed(2)),
    };
  });

  for (const component of componentDemand.values()) {
    if (component.demand > component.remaining) {
      fail(`Not enough shared production available for this order. ${component.label} needs ${component.demand.toFixed(2)} pcs, available ${component.remaining.toFixed(2)} pcs.`, returnPath);
    }
  }

  const totalRevenue = itemValues.reduce((total, item) => total + item.total_revenue, 0);
  const totalCost = itemValues.reduce((total, item) => total + item.total_cost, 0);

  return {
    saleTotals: {
      total_revenue: Number(totalRevenue.toFixed(2)),
      total_cost: Number(totalCost.toFixed(2)),
      total_profit: Number((totalRevenue - totalCost).toFixed(2)),
    },
    itemValues,
  };
}

export async function updateSale(saleId: string, formData: FormData) {
  const { supabase, businessId } = await getCurrentBusiness();
  const returnPath = `/sales/${saleId}/edit`;

  if (!businessId) fail("No business is linked to this account yet.", returnPath);

  const saleDate = String(formData.get("sale_date") ?? "").trim();
  const lines = parseSaleLines(formData, returnPath);
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const paymentMethod = String(formData.get("payment_method") ?? "").trim() || "cash";
  const status = String(formData.get("status") ?? "").trim() || "paid";
  const notes = String(formData.get("notes") ?? "").trim();

  const { data: existingSale } = await supabase.from("sales").select("id").eq("id", saleId).eq("business_id", businessId).maybeSingle();
  if (!existingSale) fail("Sale was not found.", returnPath);

  const saleSnapshot = await buildSaleValues(supabase, businessId, lines, returnPath, saleId);
  const saleValues = {
    sale_date: saleDate || new Date().toISOString().slice(0, 10),
    customer_name: customerName || null,
    payment_method: paymentMethod,
    status,
    notes: notes || null,
    ...saleSnapshot.saleTotals,
  };

  const { error: deleteItemsError } = await supabase.from("sale_items").delete().eq("sale_id", saleId).eq("business_id", businessId);
  if (deleteItemsError) fail(deleteItemsError.message || "Could not replace sale items.", returnPath);

  const { error: itemError } = await supabase.from("sale_items").insert(saleSnapshot.itemValues.map((item) => ({ ...item, sale_id: saleId })));
  if (itemError) fail(itemError.message || "Could not update sale items.", returnPath);

  const { error: saleError } = await supabase.from("sales").update(saleValues).eq("id", saleId).eq("business_id", businessId);
  if (saleError) fail(saleError.message || "Could not update sale.", returnPath);

  revalidatePath("/sales");
  redirect(`/sales?success=${encodeURIComponent("Sale updated.")}`);
}

export async function deleteSale(saleId: string) {
  const { supabase, businessId } = await getCurrentBusiness();
  if (!businessId) fail("No business is linked to this account yet.", "/sales");

  const { error } = await supabase.from("sales").delete().eq("id", saleId).eq("business_id", businessId);
  if (error) fail(error.message || "Could not delete sale.", "/sales");

  revalidatePath("/sales");
  redirect(`/sales?success=${encodeURIComponent("Sale deleted.")}`);
}

export async function createSale(formData: FormData) {
  const { supabase, user, businessId } = await getCurrentBusiness();

  if (!businessId) fail("No business is linked to this account yet.");

  const saleDate = String(formData.get("sale_date") ?? "").trim();
  const lines = parseSaleLines(formData, "/sales/new");
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const paymentMethod = String(formData.get("payment_method") ?? "").trim() || "cash";
  const status = String(formData.get("status") ?? "").trim() || "paid";
  const notes = String(formData.get("notes") ?? "").trim();

  const saleSnapshot = await buildSaleValues(supabase, businessId, lines, "/sales/new");

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      business_id: businessId,
      sale_date: saleDate || new Date().toISOString().slice(0, 10),
      customer_name: customerName || null,
      payment_method: paymentMethod,
      status,
      notes: notes || null,
      ...saleSnapshot.saleTotals,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (saleError || !sale) fail(saleError?.message || "Could not save sale.");

  const { error: itemError } = await supabase.from("sale_items").insert(saleSnapshot.itemValues.map((item) => ({ ...item, sale_id: sale.id })));

  if (itemError) {
    await supabase.from("sales").delete().eq("id", sale.id).eq("business_id", businessId);
    fail(itemError.message || "Could not save sale item.");
  }

  revalidatePath("/sales");
  redirect(`/sales?success=${encodeURIComponent("Sale recorded.")}`);
}
