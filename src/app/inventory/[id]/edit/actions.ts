"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentBusiness, parseNumber } from "@/lib/inventory/utils";
import { inventoryUnitValues } from "@/lib/inventory/units";

function fail(itemId: string, message: string): never {
  redirect(`/inventory/${itemId}/edit?error=${encodeURIComponent(message)}`);
}

export async function updateInventoryItem(itemId: string, formData: FormData) {
  const { supabase, businessId } = await getCurrentBusiness();

  if (!businessId) {
    fail(itemId, "No business is linked to this account yet.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const brandName = String(formData.get("brand_name") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim();
  const inventoryType = String(formData.get("inventory_type") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const defaultPackageSizeRaw = String(formData.get("default_package_size") ?? "").trim();
  const defaultPackageSize = defaultPackageSizeRaw === "" ? null : parseNumber(defaultPackageSizeRaw);
  const lowStockRaw = String(formData.get("low_stock_threshold") ?? "").trim();
  const lowStockThreshold = lowStockRaw === "" ? null : parseNumber(lowStockRaw);
  const lowStockPackRaw = String(formData.get("low_stock_pack_threshold") ?? "").trim();
  const lowStockPackThreshold = lowStockPackRaw === "" ? null : parseNumber(lowStockPackRaw);
  const gramsPerCupRaw = String(formData.get("recipe_density_grams_per_cup") ?? "").trim();
  const gramsPerCup = gramsPerCupRaw === "" ? null : parseNumber(gramsPerCupRaw);
  const recipeMeasurementNote = String(formData.get("recipe_measurement_note") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name || !inventoryType || !unit || Number.isNaN(defaultPackageSize) || Number.isNaN(lowStockThreshold) || Number.isNaN(lowStockPackThreshold) || Number.isNaN(gramsPerCup)) {
    fail(itemId, "Enter valid item details before saving.");
  }

  if (!["raw_material", "packaging", "finished_product", "supply"].includes(inventoryType)) {
    fail(itemId, "Choose a valid inventory type.");
  }

  if (!inventoryUnitValues.includes(unit as (typeof inventoryUnitValues)[number])) {
    fail(itemId, "Choose a valid stock unit.");
  }

  if (barcode) {
    const { data: existingBarcodeItem } = await supabase
      .from("inventory_items")
      .select("id, name")
      .eq("business_id", businessId)
      .eq("barcode", barcode)
      .neq("id", itemId)
      .maybeSingle();

    if (existingBarcodeItem) {
      fail(itemId, `Barcode already belongs to ${existingBarcodeItem.name}.`);
    }
  }

  const { error } = await supabase
    .from("inventory_items")
    .update({
      name,
      brand_name: brandName || null,
      barcode: barcode || null,
      inventory_type: inventoryType,
      unit,
      default_package_unit: unit,
      default_package_size: defaultPackageSize,
      low_stock_threshold: lowStockThreshold,
      low_stock_pack_threshold: lowStockPackThreshold,
      recipe_density_grams_per_cup: gramsPerCup,
      recipe_measurement_note: recipeMeasurementNote || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("business_id", businessId);

  if (error) {
    fail(itemId, error.message || "We could not update this item.");
  }

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  redirect(`/inventory/${itemId}?success=${encodeURIComponent("Item details updated.")}`);
}
