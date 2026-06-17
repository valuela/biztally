"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentBusiness, parseNumber, toNumber } from "@/lib/inventory/utils";

function fail(itemId: string, batchId: string, message: string): never {
  redirect(`/inventory/${itemId}/batches/${batchId}/edit?error=${encodeURIComponent(message)}`);
}

export async function correctInventoryBatch(itemId: string, batchId: string, formData: FormData) {
  const { supabase, user, businessId } = await getCurrentBusiness();

  if (!businessId) {
    fail(itemId, batchId, "No business is linked to this account yet.");
  }

  const sealedPacks = parseNumber(formData.get("sealed_packs_remaining"));
  const openPacks = parseNumber(formData.get("open_packs"));
  const emptiedPacks = parseNumber(formData.get("emptied_packs"));
  const packageSize = parseNumber(formData.get("package_size"));
  const costPerUnit = parseNumber(formData.get("cost_per_unit"));
  const purchasePriceRaw = String(formData.get("purchase_price") ?? "").trim();
  const purchasePrice = purchasePriceRaw === "" ? null : parseNumber(purchasePriceRaw);
  const expirationDate = String(formData.get("expiration_date") ?? "").trim();
  const batchCode = String(formData.get("batch_code") ?? "").trim();
  const supplierName = String(formData.get("supplier_name") ?? "").trim();
  const correctionNote = String(formData.get("correction_note") ?? "").trim();

  if ([sealedPacks, openPacks, emptiedPacks, packageSize, costPerUnit, purchasePrice].some(Number.isNaN)) {
    fail(itemId, batchId, "Enter valid batch correction numbers.");
  }

  if (packageSize <= 0) {
    fail(itemId, batchId, "Package size must be greater than zero.");
  }

  const { data: batch } = await supabase
    .from("inventory_batches")
    .select("id, quantity_remaining")
    .eq("id", batchId)
    .eq("inventory_item_id", itemId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!batch) {
    fail(itemId, batchId, "Batch not found.");
  }

  const previousQuantity = toNumber(batch.quantity_remaining);
  const nextQuantity = (sealedPacks + openPacks) * packageSize;
  const packagesReceived = sealedPacks + openPacks + emptiedPacks;

  const { error: updateError } = await supabase
    .from("inventory_batches")
    .update({
      batch_code: batchCode || null,
      supplier_name: supplierName || null,
      purchase_price: purchasePrice,
      cost_per_unit: costPerUnit,
      packages_received: packagesReceived,
      sealed_packs_remaining: sealedPacks,
      open_packs: openPacks,
      emptied_packs: emptiedPacks,
      package_size: packageSize,
      quantity_received: packagesReceived * packageSize,
      quantity_remaining: nextQuantity,
      expiration_date: expirationDate || null,
      correction_note: correctionNote || null,
      corrected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId)
    .eq("business_id", businessId);

  if (updateError) {
    fail(itemId, batchId, updateError.message || "We could not correct this batch.");
  }

  const { data: totals } = await supabase
    .from("inventory_batches")
    .select("quantity_remaining")
    .eq("inventory_item_id", itemId)
    .eq("business_id", businessId);

  const itemQuantity = (totals ?? []).reduce((sum, row) => sum + toNumber(row.quantity_remaining), 0);
  await supabase
    .from("inventory_items")
    .update({ quantity_on_hand: itemQuantity, cost_per_unit: costPerUnit, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("business_id", businessId);

  await supabase.from("inventory_movements").insert({
    business_id: businessId,
    inventory_item_id: itemId,
    movement_type: "adjustment",
    quantity: nextQuantity - previousQuantity,
    previous_quantity: previousQuantity,
    new_quantity: nextQuantity,
    reason: correctionNote || "Batch correction",
    reference_type: "inventory_batch_correction",
    reference_id: batchId,
    created_by: user.id,
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  redirect(`/inventory/${itemId}?success=${encodeURIComponent("Batch corrected.")}`);
}
