"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentBusiness, parseNumber, toNumber, MovementType } from "@/lib/inventory/utils";

function fail(itemId: string, message: string): never {
  redirect(`/inventory/${itemId}/use?error=${encodeURIComponent(message)}`);
}

export async function useInventoryStock(itemId: string, formData: FormData) {
  const { supabase, user, businessId } = await getCurrentBusiness();

  if (!businessId) {
    fail(itemId, "No business is linked to this account yet.");
  }

  const packsEmptied = parseNumber(formData.get("packs_emptied"));
  const movementType = String(formData.get("movement_type") ?? "sale_usage").trim() as MovementType;
  const reason = String(formData.get("reason") ?? "").trim();

  if (!Number.isFinite(packsEmptied) || packsEmptied <= 0) {
    fail(itemId, "Enter the number of whole packs that became empty.");
  }

  if (!["stock_out", "adjustment", "waste", "sale_usage"].includes(movementType)) {
    fail(itemId, "Choose a valid stock usage reason.");
  }

  const { data: item } = await supabase
    .from("inventory_items")
    .select("id, name, unit, quantity_on_hand, default_package_size, default_package_unit")
    .eq("id", itemId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!item) {
    fail(itemId, "Choose a valid inventory item.");
  }

  const packageSize = toNumber(item.default_package_size);
  if (packageSize <= 0) {
    fail(itemId, "Set this item's package size before deducting stock by pack.");
  }

  const quantity = packsEmptied * packageSize;
  const previousQuantity = toNumber(item.quantity_on_hand);
  if (quantity > previousQuantity) {
    fail(itemId, `Only ${previousQuantity} ${item.unit} is available. That is less than ${packsEmptied} pack(s).`);
  }

  const { data: batches, error: batchError } = await supabase
    .from("inventory_batches")
    .select("id, quantity_remaining, open_packs, emptied_packs, expiration_date, received_at")
    .eq("business_id", businessId)
    .eq("inventory_item_id", itemId)
    .gt("quantity_remaining", 0)
    .gt("open_packs", 0)
    .order("expiration_date", { ascending: true, nullsFirst: false })
    .order("received_at", { ascending: true });

  if (batchError || !batches) {
    fail(itemId, batchError?.message || "We could not read item batches.");
  }

  const openPacksAvailable = batches.reduce((total, batch) => total + toNumber(batch.open_packs), 0);
  if (packsEmptied > openPacksAvailable) {
    fail(itemId, `Only ${openPacksAvailable} open pack(s) are available. Open a pack before marking it empty.`);
  }

  let remainingPacksToEmpty = packsEmptied;
  const updates: Array<{ id: string; nextQuantity: number; nextOpenPacks: number; nextEmptiedPacks: number }> = [];

  for (const batch of batches) {
    if (remainingPacksToEmpty <= 0) break;
    const batchRemaining = toNumber(batch.quantity_remaining);
    const batchOpenPacks = toNumber(batch.open_packs);
    const batchEmptiedPacks = toNumber(batch.emptied_packs);
    const packsFromBatch = Math.min(batchOpenPacks, remainingPacksToEmpty);
    const quantityFromBatch = packsFromBatch * packageSize;

    if (quantityFromBatch > batchRemaining) {
      fail(itemId, "This batch has inconsistent pack quantity data. Open the item detail page and review the batch before deducting.");
    }

    updates.push({
      id: batch.id,
      nextQuantity: batchRemaining - quantityFromBatch,
      nextOpenPacks: batchOpenPacks - packsFromBatch,
      nextEmptiedPacks: batchEmptiedPacks + packsFromBatch,
    });
    remainingPacksToEmpty -= packsFromBatch;
  }

  if (remainingPacksToEmpty > 0) {
    fail(itemId, "Open pack counts do not match item stock. Open or adjust packs first.");
  }

  for (const update of updates) {
    const { error } = await supabase
      .from("inventory_batches")
      .update({
        quantity_remaining: update.nextQuantity,
        open_packs: update.nextOpenPacks,
        emptied_packs: update.nextEmptiedPacks,
        updated_at: new Date().toISOString(),
      })
      .eq("id", update.id)
      .eq("business_id", businessId);

    if (error) {
      fail(itemId, error.message || "We could not deduct this batch.");
    }
  }

  const newQuantity = previousQuantity - quantity;
  const { error: itemError } = await supabase
    .from("inventory_items")
    .update({ quantity_on_hand: newQuantity, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("business_id", businessId);

  if (itemError) {
    fail(itemId, itemError.message || "We could not update item stock.");
  }

  const { error: movementError } = await supabase.from("inventory_movements").insert({
    business_id: businessId,
    inventory_item_id: itemId,
    movement_type: movementType,
    quantity,
    previous_quantity: previousQuantity,
    new_quantity: newQuantity,
    reason: reason || `${packsEmptied} empty pack(s) deducted by FIFO`,
    reference_type: "fifo_usage",
    created_by: user.id,
  });

  if (movementError) {
    fail(itemId, movementError.message || "Stock was deducted, but movement history could not be recorded.");
  }

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  redirect(`/inventory/${itemId}?success=${encodeURIComponent(`${packsEmptied} empty pack(s) deducted from ${item.name}.`)}`);
}
