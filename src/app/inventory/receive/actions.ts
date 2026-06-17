"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function parseNumber(value: FormDataEntryValue | null) {
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function fail(message: string): never {
  redirect(`/inventory/receive?error=${encodeURIComponent(message)}`);
}

export async function receiveInventoryStock(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    fail("Please sign in again to continue.");
  }

  const [{ data: profile }, { data: ownedBusiness }] = await Promise.all([
    supabase.from("user_profiles").select("business_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle(),
  ]);

  const businessId = profile?.business_id ?? ownedBusiness?.id ?? null;

  if (!businessId) {
    fail("No business is linked to this account yet.");
  }

  const itemId = String(formData.get("inventory_item_id") ?? "").trim();
  const vendorId = String(formData.get("vendor_id") ?? "").trim();
  const batchCode = String(formData.get("batch_code") ?? "").trim();
  const packagesReceivedRaw = String(formData.get("packages_received") ?? "").trim();
  const packagesReceived = packagesReceivedRaw === "" ? null : parseNumber(packagesReceivedRaw);
  const packageSizeRaw = String(formData.get("package_size") ?? "").trim();
  const packageSize = packageSizeRaw === "" ? null : parseNumber(packageSizeRaw);
  const quantityReceived = parseNumber(formData.get("quantity_on_hand"));
  const costPerUnit = parseNumber(formData.get("cost_per_unit"));
  const purchasePriceRaw = String(formData.get("purchase_price") ?? "").trim();
  const purchasePrice = purchasePriceRaw === "" ? null : parseNumber(purchasePriceRaw);
  const expirationDateRaw = String(formData.get("expiration_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!itemId || Number.isNaN(quantityReceived) || quantityReceived <= 0 || Number.isNaN(costPerUnit)) {
    fail("Choose an item and enter a valid received quantity.");
  }

  if (Number.isNaN(packagesReceived) || Number.isNaN(packageSize) || Number.isNaN(purchasePrice)) {
    fail("Enter valid numbers for package details and purchase price.");
  }

  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("id, name, unit, quantity_on_hand, default_package_size, default_package_unit")
    .eq("id", itemId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (itemError || !item) {
    fail("Choose a valid inventory item.");
  }

  let vendorName: string | null = null;
  if (vendorId) {
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, name")
      .eq("id", vendorId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (vendorError || !vendor) {
      fail("Choose a valid vendor.");
    }

    vendorName = vendor.name;
  }

  const previousQuantity = parseNumber(item.quantity_on_hand);
  const newQuantity = previousQuantity + quantityReceived;
  const shouldSetDefaultPackage = item.default_package_size == null && packageSize != null && packageSize > 0;

  const { data: batch, error: batchError } = await supabase
    .from("inventory_batches")
    .insert({
      business_id: businessId,
      inventory_item_id: item.id,
      batch_code: batchCode || null,
      vendor_id: vendorId || null,
      supplier_name: vendorName,
      purchase_price: purchasePrice,
      cost_per_unit: costPerUnit,
      packages_received: packagesReceived,
      sealed_packs_remaining: packagesReceived,
      open_packs: 0,
      emptied_packs: 0,
      package_size: packageSize,
      package_unit: item.unit,
      quantity_received: quantityReceived,
      quantity_remaining: quantityReceived,
      expiration_date: expirationDateRaw || null,
      received_at: new Date().toISOString().slice(0, 10),
      notes: notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    fail(batchError?.message || "We could not receive this stock batch.");
  }

  const { error: itemUpdateError } = await supabase
    .from("inventory_items")
    .update({
      quantity_on_hand: newQuantity,
      cost_per_unit: costPerUnit,
      ...(shouldSetDefaultPackage
        ? {
            default_package_size: packageSize,
            default_package_unit: item.unit,
          }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  if (itemUpdateError) {
    await supabase.from("inventory_batches").delete().eq("id", batch.id);
    fail(itemUpdateError.message || "Batch was saved, but item stock could not be updated.");
  }

  const { error: movementError } = await supabase.from("inventory_movements").insert({
    business_id: businessId,
    inventory_item_id: item.id,
    movement_type: "stock_in",
    quantity: quantityReceived,
    previous_quantity: previousQuantity,
    new_quantity: newQuantity,
    reason: "Received stock",
    reference_type: "inventory_batch",
    reference_id: batch.id,
    created_by: user.id,
  });

  if (movementError) {
    await supabase.from("inventory_batches").delete().eq("id", batch.id);
    fail(movementError.message || "Batch was saved, but movement could not be recorded.");
  }

  revalidatePath("/inventory");
  redirect(`/inventory?success=${encodeURIComponent(`${item.name} stock was updated.`)}`);
}
