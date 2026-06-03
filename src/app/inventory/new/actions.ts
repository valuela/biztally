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
  redirect(`/inventory/new?error=${encodeURIComponent(message)}`);
}

export async function createInventoryItem(formData: FormData) {
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

  const name = String(formData.get("name") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim();
  const inventoryType = String(formData.get("inventory_type") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const brandName = String(formData.get("brand_name") ?? "").trim();
  const supplierName = String(formData.get("supplier_name") ?? "").trim();
  const imageFile = formData.get("image_file");
  const quantityOnHand = parseNumber(formData.get("quantity_on_hand"));
  const costPerUnit = parseNumber(formData.get("cost_per_unit"));
  const purchasePriceRaw = String(formData.get("purchase_price") ?? "").trim();
  const purchasePrice = purchasePriceRaw === "" ? null : parseNumber(purchasePriceRaw);
  const lowStockThresholdRaw = String(formData.get("low_stock_threshold") ?? "").trim();
  const lowStockThreshold = lowStockThresholdRaw === "" ? null : parseNumber(lowStockThresholdRaw);
  const expirationDateRaw = String(formData.get("expiration_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name || !inventoryType || !unit || Number.isNaN(quantityOnHand) || Number.isNaN(costPerUnit)) {
    fail("Fill in the required fields before saving.");
  }

  if (Number.isNaN(purchasePrice) || Number.isNaN(lowStockThreshold)) {
    fail("Enter valid numbers for purchase price and low stock threshold.");
  }

  if (!["raw_material", "packaging", "finished_product", "supply"].includes(inventoryType)) {
    fail("Choose a valid inventory type.");
  }

  let imageUrl: string | null = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const imagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const uploaded = await supabase.storage.from("inventory-images").upload(imagePath, new Uint8Array(await imageFile.arrayBuffer()), {
      contentType: imageFile.type || "application/octet-stream",
      upsert: true,
    });

    if (uploaded.error) {
      fail(uploaded.error.message || "We could not upload the image.");
    }

    const { data: publicUrl } = supabase.storage.from("inventory-images").getPublicUrl(uploaded.data.path);
    imageUrl = publicUrl.publicUrl;
  }

  const { data: item, error: insertError } = await supabase
    .from("inventory_items")
    .insert({
      business_id: businessId,
      name,
      barcode: barcode || null,
      image_url: imageUrl,
      brand_name: brandName || null,
      supplier_name: supplierName || null,
      purchase_price: purchasePrice,
      inventory_type: inventoryType,
      unit,
      quantity_on_hand: quantityOnHand,
      cost_per_unit: costPerUnit,
      low_stock_threshold: lowStockThreshold,
      expiration_date: expirationDateRaw || null,
      notes: notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !item) {
    if (imageUrl) {
      const path = imageUrl.split("/storage/v1/object/public/inventory-images/")[1];
      if (path) {
        await supabase.storage.from("inventory-images").remove([path]);
      }
    }
    fail(insertError?.message ?? "We could not save the inventory item.");
  }

  if (quantityOnHand > 0) {
    const { error: movementError } = await supabase.from("inventory_movements").insert({
      business_id: businessId,
      inventory_item_id: item.id,
      movement_type: "stock_in",
      quantity: quantityOnHand,
      previous_quantity: 0,
      new_quantity: quantityOnHand,
      reason: "Initial stock",
      reference_type: "inventory_item",
      reference_id: item.id,
      created_by: user.id,
    });

    if (movementError) {
      fail(movementError.message || "Saved the item, but the stock movement failed.");
    }
  }

  revalidatePath("/inventory");
  redirect("/inventory");
}
