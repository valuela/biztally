"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentBusiness, parseNumber } from "@/lib/inventory/utils";

function fail(message: string): never {
  redirect(`/products/new?error=${encodeURIComponent(message)}`);
}

function failEdit(productId: string, message: string): never {
  redirect(`/products/${productId}/edit?error=${encodeURIComponent(message)}`);
}

async function parseProductForm(
  supabase: Awaited<ReturnType<typeof getCurrentBusiness>>["supabase"],
  businessId: string,
  formData: FormData,
  failCurrent: (message: string) => never
) {
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const recipeId = String(formData.get("recipe_id") ?? "").trim();
  const variantIdRaw = String(formData.get("recipe_variant_id") ?? "").trim();
  const unitsPerPackage = parseNumber(formData.get("units_per_package"));
  const packageLabel = String(formData.get("package_label") ?? "").trim() || "tub";
  const sellingPrice = parseNumber(formData.get("selling_price"));
  const packagingCost = parseNumber(formData.get("packaging_cost"));
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) failCurrent("Product name is required.");
  if (!recipeId) failCurrent("Choose a recipe.");
  if (!Number.isFinite(unitsPerPackage) || unitsPerPackage <= 0) failCurrent("Units per package must be greater than zero.");
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) failCurrent("Selling price must be zero or higher.");
  if (!Number.isFinite(packagingCost) || packagingCost < 0) failCurrent("Packaging cost must be zero or higher.");

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("business_id", businessId)
    .eq("id", recipeId)
    .maybeSingle();

  if (!recipe) failCurrent("Recipe was not found.");

  if (variantIdRaw) {
    const { data: variant } = await supabase
      .from("recipe_variants")
      .select("id")
      .eq("business_id", businessId)
      .eq("recipe_id", recipeId)
      .eq("id", variantIdRaw)
      .maybeSingle();

    if (!variant) failCurrent("Variant was not found.");
  }

  return {
    recipe_id: recipeId,
    recipe_variant_id: variantIdRaw || null,
    name,
    sku: sku || null,
    units_per_package: unitsPerPackage,
    package_label: packageLabel,
    selling_price: sellingPrice,
    packaging_cost: packagingCost,
    notes: notes || null,
  };
}

export async function createSellableProduct(formData: FormData) {
  const { supabase, user, businessId } = await getCurrentBusiness();

  if (!businessId) fail("No business is linked to this account yet.");

  const payload = await parseProductForm(supabase, businessId, formData, fail);

  const { error } = await supabase.from("sellable_products").insert({
    business_id: businessId,
    ...payload,
    created_by: user.id,
  });

  if (error) fail(error.message || "Could not save product.");

  revalidatePath("/products");
  redirect(`/products?success=${encodeURIComponent(`${payload.name} was created.`)}`);
}

export async function updateSellableProduct(productId: string, formData: FormData) {
  const { supabase, businessId } = await getCurrentBusiness();
  const failCurrent = (message: string): never => failEdit(productId, message);

  if (!businessId) failCurrent("No business is linked to this account yet.");

  const { data: existingProduct } = await supabase
    .from("sellable_products")
    .select("id")
    .eq("id", productId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!existingProduct) failCurrent("Product was not found.");

  const payload = await parseProductForm(supabase, businessId, formData, failCurrent);

  const { error } = await supabase
    .from("sellable_products")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("business_id", businessId);

  if (error) failCurrent(error.message || "Could not update product.");

  revalidatePath("/products");
  revalidatePath(`/products/${productId}/edit`);
  redirect(`/products?success=${encodeURIComponent(`${payload.name} was updated.`)}`);
}

export async function deleteSellableProduct(productId: string) {
  const { supabase, businessId } = await getCurrentBusiness();

  if (!businessId) {
    redirect(`/products?error=${encodeURIComponent("No business is linked to this account yet.")}`);
  }

  const { error } = await supabase.from("sellable_products").delete().eq("id", productId).eq("business_id", businessId);

  if (error) {
    redirect(`/products?error=${encodeURIComponent(error.message || "Could not delete product.")}`);
  }

  revalidatePath("/products");
  redirect(`/products?success=${encodeURIComponent("Product deleted.")}`);
}
