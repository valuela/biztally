"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inventoryUnitValues } from "@/lib/inventory/units";
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
  const vendorId = String(formData.get("vendor_id") ?? "").trim();
  const batchCode = String(formData.get("batch_code") ?? "").trim();
  const imageFile = formData.get("image_file");
  const packagesReceivedRaw = String(formData.get("packages_received") ?? "").trim();
  const packagesReceived = packagesReceivedRaw === "" ? null : parseNumber(packagesReceivedRaw);
  const packageSizeRaw = String(formData.get("package_size") ?? "").trim();
  const packageSize = packageSizeRaw === "" ? null : parseNumber(packageSizeRaw);
  const submittedQuantityOnHand = parseNumber(formData.get("quantity_on_hand"));
  const submittedCostPerUnit = parseNumber(formData.get("cost_per_unit"));
  const purchasePriceRaw = String(formData.get("purchase_price") ?? "").trim();
  const purchasePrice = purchasePriceRaw === "" ? null : parseNumber(purchasePriceRaw);
  const lowStockThresholdRaw = String(formData.get("low_stock_threshold") ?? "").trim();
  const lowStockThreshold = lowStockThresholdRaw === "" ? null : parseNumber(lowStockThresholdRaw);
  const expirationDateRaw = String(formData.get("expiration_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name || !inventoryType || !unit || Number.isNaN(submittedQuantityOnHand) || Number.isNaN(submittedCostPerUnit)) {
    fail("Fill in the required fields before saving.");
  }

  if (Number.isNaN(packagesReceived) || Number.isNaN(packageSize) || Number.isNaN(purchasePrice) || Number.isNaN(lowStockThreshold)) {
    fail("Enter valid numbers for package details, purchase price, and low stock threshold.");
  }

  if (packagesReceived != null && packagesReceived <= 0) {
    fail("Packages bought must be greater than zero.");
  }

  if (packageSize != null && packageSize <= 0) {
    fail("Size per package must be greater than zero.");
  }

  const quantityOnHand = packagesReceived != null && packageSize != null ? packagesReceived * packageSize : submittedQuantityOnHand;
  const costPerUnit = purchasePrice != null && quantityOnHand > 0 ? purchasePrice / quantityOnHand : submittedCostPerUnit;

  if (!["raw_material", "packaging", "finished_product", "supply"].includes(inventoryType)) {
    fail("Choose a valid inventory type.");
  }

  if (!inventoryUnitValues.includes(unit as (typeof inventoryUnitValues)[number])) {
    fail("Choose a valid stock unit.");
  }

  if (barcode) {
    const { data: existingBarcodeItem } = await supabase
      .from("inventory_items")
      .select("id, name")
      .eq("business_id", businessId)
      .eq("barcode", barcode)
      .maybeSingle();

    if (existingBarcodeItem) {
      fail(`Barcode already belongs to ${existingBarcodeItem.name}. Receive stock for that item instead.`);
    }
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
      supplier_name: null,
      purchase_price: null,
      inventory_type: inventoryType,
      unit,
      default_package_size: packageSize,
      default_package_unit: unit,
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
        package_unit: unit,
        quantity_received: quantityOnHand,
        quantity_remaining: quantityOnHand,
        expiration_date: expirationDateRaw || null,
        received_at: new Date().toISOString().slice(0, 10),
        notes: notes || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      await supabase.from("inventory_items").delete().eq("id", item.id);
      fail(batchError?.message || "Saved the item, but the initial stock batch failed.");
    }

    const { error: movementError } = await supabase.from("inventory_movements").insert({
      business_id: businessId,
      inventory_item_id: item.id,
      movement_type: "stock_in",
      quantity: quantityOnHand,
      previous_quantity: 0,
      new_quantity: quantityOnHand,
      reason: "Initial stock",
      reference_type: "inventory_batch",
      reference_id: batch.id,
      created_by: user.id,
    });

    if (movementError) {
      await supabase.from("inventory_items").delete().eq("id", item.id);
      fail(movementError.message || "Saved the item, but the stock movement failed.");
    }
  }

  revalidatePath("/inventory");
  redirect(`/inventory?success=${encodeURIComponent(`${name} was added to inventory.`)}`);
}
