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
  const productType = String(formData.get("product_type") ?? "single").trim() === "assorted" ? "assorted" : "single";
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
  if (!["single", "assorted"].includes(productType)) failCurrent("Choose a valid product type.");

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("business_id", businessId)
    .eq("id", recipeId)
    .maybeSingle();

  if (!recipe) failCurrent("Recipe was not found.");

  const componentRecipeIds = formData.getAll("component_recipe_id").map((value) => String(value).trim());
  const componentVariantIds = formData.getAll("component_recipe_variant_id").map((value) => String(value).trim());
  const componentUnits = formData.getAll("component_units_per_package").map((value) => parseNumber(value));
  const rawComponents =
    productType === "assorted"
      ? componentRecipeIds
          .map((componentRecipeId, index) => ({
            recipeId: componentRecipeId,
            variantId: componentVariantIds[index] || null,
            unitsPerPackage: componentUnits[index],
            sortOrder: index,
          }))
          .filter((component) => component.recipeId && Number.isFinite(component.unitsPerPackage) && component.unitsPerPackage > 0)
      : [
          {
            recipeId,
            variantId: variantIdRaw || null,
            unitsPerPackage,
            sortOrder: 0,
          },
        ];

  if (productType === "assorted" && rawComponents.length < 2) {
    failCurrent("Assorted products need at least two component rows.");
  }

  const componentTotalUnits = rawComponents.reduce((total, component) => total + component.unitsPerPackage, 0);
  if (Math.abs(componentTotalUnits - unitsPerPackage) > 0.0001) {
    failCurrent("Pieces per package must match the assorted component total.");
  }

  const recipeIdsToValidate = Array.from(new Set(rawComponents.map((component) => component.recipeId)));
  const { data: validRecipes } = await supabase
    .from("recipes")
    .select("id")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .in("id", recipeIdsToValidate);

  if ((validRecipes ?? []).length !== recipeIdsToValidate.length) {
    failCurrent("One or more component recipes could not be found or are inactive.");
  }

  const variantIdsToValidate = Array.from(new Set(rawComponents.map((component) => component.variantId).filter((value): value is string => Boolean(value))));
  if (variantIdsToValidate.length > 0) {
    const { data: variant } = await supabase
      .from("recipe_variants")
      .select("id, recipe_id")
      .eq("business_id", businessId)
      .in("id", variantIdsToValidate)
      .eq("is_active", true)
    ;

    const validVariantById = new Map((variant ?? []).map((row) => [row.id, row.recipe_id]));
    const invalidVariant = rawComponents.find((component) => component.variantId && validVariantById.get(component.variantId) !== component.recipeId);
    if ((variant ?? []).length !== variantIdsToValidate.length || invalidVariant) {
      failCurrent("One or more component variants could not be found, are inactive, or do not belong to the selected recipe.");
    }
  }

  return {
    product_type: productType,
    recipe_id: recipeId,
    recipe_variant_id: variantIdRaw || null,
    name,
    sku: sku || null,
    units_per_package: unitsPerPackage,
    package_label: packageLabel,
    selling_price: sellingPrice,
    packaging_cost: packagingCost,
    notes: notes || null,
    components: rawComponents.map((component) => ({
      recipe_id: component.recipeId,
      recipe_variant_id: component.variantId,
      units_per_package: component.unitsPerPackage,
      sort_order: component.sortOrder,
    })),
  };
}

export async function createSellableProduct(formData: FormData) {
  const { supabase, user, businessId } = await getCurrentBusiness();

  if (!businessId) fail("No business is linked to this account yet.");

  const payload = await parseProductForm(supabase, businessId, formData, fail);

  const { components, ...productPayload } = payload;

  const { data: product, error } = await supabase
    .from("sellable_products")
    .insert({
      business_id: businessId,
      ...productPayload,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !product) fail(error?.message || "Could not save product.");

  const { error: componentError } = await supabase.from("sellable_product_components").insert(
    components.map((component) => ({
      business_id: businessId,
      sellable_product_id: product.id,
      ...component,
    }))
  );

  if (componentError) {
    await supabase.from("sellable_products").delete().eq("id", product.id).eq("business_id", businessId);
    fail(componentError.message || "Could not save product components.");
  }

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
  const { components, ...productPayload } = payload;

  const { error } = await supabase
    .from("sellable_products")
    .update({
      ...productPayload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("business_id", businessId);

  if (error) failCurrent(error.message || "Could not update product.");

  const { error: deleteComponentsError } = await supabase
    .from("sellable_product_components")
    .delete()
    .eq("sellable_product_id", productId)
    .eq("business_id", businessId);

  if (deleteComponentsError) failCurrent(deleteComponentsError.message || "Could not replace product components.");

  const { error: componentError } = await supabase.from("sellable_product_components").insert(
    components.map((component) => ({
      business_id: businessId,
      sellable_product_id: productId,
      ...component,
    }))
  );

  if (componentError) failCurrent(componentError.message || "Could not save product components.");

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
