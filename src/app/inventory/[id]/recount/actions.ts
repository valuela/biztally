"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentBusiness, parseNumber, toNumber } from "@/lib/inventory/utils";

function fail(itemId: string, message: string): never {
  redirect(`/inventory/${itemId}/recount?error=${encodeURIComponent(message)}`);
}

export async function recountInventoryItem(itemId: string, formData: FormData) {
  const { supabase, user, businessId } = await getCurrentBusiness();

  if (!businessId) {
    fail(itemId, "No business is linked to this account yet.");
  }

  const batchIds = formData.getAll("batch_id").map((value) => String(value));
  const note = String(formData.get("recount_note") ?? "").trim();

  if (batchIds.length === 0) {
    fail(itemId, "No batches were found to recount.");
  }

  const { data: existingBatches } = await supabase
    .from("inventory_batches")
    .select("id, quantity_remaining, package_size")
    .eq("inventory_item_id", itemId)
    .eq("business_id", businessId)
    .in("id", batchIds);

  if (!existingBatches || existingBatches.length !== batchIds.length) {
    fail(itemId, "One or more batches could not be found.");
  }

  let previousTotal = 0;
  let nextTotal = 0;

  for (const batch of existingBatches) {
    const sealedPacks = parseNumber(formData.get(`sealed_${batch.id}`));
    const openPacks = parseNumber(formData.get(`open_${batch.id}`));
    const emptiedPacks = parseNumber(formData.get(`empty_${batch.id}`));
    const packageSize = toNumber(batch.package_size);

    if ([sealedPacks, openPacks, emptiedPacks].some(Number.isNaN) || packageSize <= 0) {
      fail(itemId, "Enter valid pack counts for every batch.");
    }

    previousTotal += toNumber(batch.quantity_remaining);
    const quantityRemaining = (sealedPacks + openPacks) * packageSize;
    const packagesReceived = sealedPacks + openPacks + emptiedPacks;
    nextTotal += quantityRemaining;

    const { error } = await supabase
      .from("inventory_batches")
      .update({
        packages_received: packagesReceived,
        sealed_packs_remaining: sealedPacks,
        open_packs: openPacks,
        emptied_packs: emptiedPacks,
        quantity_received: packagesReceived * packageSize,
        quantity_remaining: quantityRemaining,
        correction_note: note || "Physical recount",
        corrected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch.id)
      .eq("business_id", businessId);

    if (error) {
      fail(itemId, error.message || "We could not save the recount.");
    }
  }

  const { error: itemError } = await supabase
    .from("inventory_items")
    .update({
      quantity_on_hand: nextTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("business_id", businessId);

  if (itemError) {
    fail(itemId, itemError.message || "We could not update item stock after recount.");
  }

  await supabase.from("inventory_movements").insert({
    business_id: businessId,
    inventory_item_id: itemId,
    movement_type: "adjustment",
    quantity: nextTotal - previousTotal,
    previous_quantity: previousTotal,
    new_quantity: nextTotal,
    reason: note || "Physical recount",
    reference_type: "physical_recount",
    created_by: user.id,
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  redirect(`/inventory/${itemId}?success=${encodeURIComponent("Physical recount saved.")}`);
}
