"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentBusiness, toNumber } from "@/lib/inventory/utils";

function fail(itemId: string, message: string): never {
  redirect(`/inventory/${itemId}?error=${encodeURIComponent(message)}`);
}

export async function openInventoryPack(itemId: string) {
  const { supabase, user, businessId } = await getCurrentBusiness();

  if (!businessId) {
    fail(itemId, "No business is linked to this account yet.");
  }

  const { data: batch, error } = await supabase
    .from("inventory_batches")
    .select("id, sealed_packs_remaining, open_packs")
    .eq("business_id", businessId)
    .eq("inventory_item_id", itemId)
    .gt("sealed_packs_remaining", 0)
    .order("expiration_date", { ascending: true, nullsFirst: false })
    .order("received_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !batch) {
    fail(itemId, "No sealed packs are available to open.");
  }

  const sealedPacks = toNumber(batch.sealed_packs_remaining);
  const openPacks = toNumber(batch.open_packs);

  const { error: updateError } = await supabase
    .from("inventory_batches")
    .update({
      sealed_packs_remaining: sealedPacks - 1,
      open_packs: openPacks + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batch.id)
    .eq("business_id", businessId);

  if (updateError) {
    fail(itemId, updateError.message || "We could not open this pack.");
  }

  await supabase.from("inventory_movements").insert({
    business_id: businessId,
    inventory_item_id: itemId,
    movement_type: "adjustment",
    quantity: 0,
    previous_quantity: 0,
    new_quantity: 0,
    reason: "Opened 1 pack",
    reference_type: "inventory_batch_open_pack",
    reference_id: batch.id,
    created_by: user.id,
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  redirect(`/inventory/${itemId}?success=${encodeURIComponent("One pack marked as open.")}`);
}
