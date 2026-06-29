"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentBusiness, parseNumber } from "@/lib/inventory/utils";
import { calculateRecipeCost } from "@/lib/recipes/costing";
import { convertRecipeQuantity } from "@/lib/recipes/units";

function fail(message: string): never {
  redirect(`/recipes/new?error=${encodeURIComponent(message)}`);
}

function failEdit(recipeId: string, message: string): never {
  redirect(`/recipes/${recipeId}/edit?error=${encodeURIComponent(message)}`);
}

function failVariant(recipeId: string, message: string): never {
  redirect(`/recipes/${recipeId}?error=${encodeURIComponent(message)}`);
}

export async function createRecipe(formData: FormData) {
  const { supabase, user, businessId } = await getCurrentBusiness();

  if (!businessId) {
    fail("No business is linked to this account yet.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const yieldUnit = String(formData.get("yield_unit") ?? "").trim() || "pcs";
  const notes = String(formData.get("notes") ?? "").trim();
  const batchYield = parseNumber(formData.get("batch_yield"));
  const sellingPriceRaw = String(formData.get("selling_price") ?? "").trim();
  const sellingPrice = sellingPriceRaw ? parseNumber(sellingPriceRaw) : null;
  const packagingCost = parseNumber(formData.get("packaging_cost"));
  const laborCost = parseNumber(formData.get("labor_cost"));
  const overheadCost = parseNumber(formData.get("overhead_cost"));
  const targetMarginRaw = String(formData.get("target_margin_percent") ?? "").trim();
  const targetMarginPercent = targetMarginRaw ? parseNumber(targetMarginRaw) : 40;

  if (!name) fail("Recipe name is required.");
  if (!Number.isFinite(batchYield) || batchYield <= 0) fail("Batch yield must be greater than zero.");
  if (sellingPrice != null && (!Number.isFinite(sellingPrice) || sellingPrice < 0)) fail("Selling price must be zero or higher.");
  if (!Number.isFinite(targetMarginPercent) || targetMarginPercent <= 0 || targetMarginPercent >= 100) {
    fail("Target margin must be between 1 and 99.");
  }

  const ingredientIds = formData.getAll("ingredient_inventory_item_id").map((value) => String(value).trim());
  const ingredientNames = formData.getAll("ingredient_name").map((value) => String(value).trim());
  const inputQuantities = formData.getAll("ingredient_quantity").map((value) => parseNumber(value));
  const inputUnits = formData.getAll("ingredient_unit").map((value) => String(value ?? "").trim());
  const notesList = formData.getAll("ingredient_notes").map((value) => String(value ?? "").trim());

  const recipeIngredients = ingredientIds
    .map((inventoryItemId, index) => ({
      inventoryItemId,
      ingredientName: ingredientNames[index] || `Ingredient ${index + 1}`,
      lineNumber: index + 1,
      inputQuantity: inputQuantities[index],
      inputUnit: inputUnits[index],
      notes: notesList[index] || null,
    }))
    .filter((ingredient) => ingredient.inventoryItemId && Number.isFinite(ingredient.inputQuantity) && ingredient.inputQuantity > 0);

  if (recipeIngredients.length === 0) {
    fail("Add at least one ingredient.");
  }

  const { data: inventoryItems, error: inventoryError } = await supabase
    .from("inventory_items")
    .select("id, unit, cost_per_unit, recipe_density_grams_per_cup")
    .eq("business_id", businessId)
    .in(
      "id",
      recipeIngredients.map((ingredient) => ingredient.inventoryItemId)
    );

  if (inventoryError) fail(inventoryError.message || "Could not validate recipe ingredients.");

  const inventoryItemById = new Map((inventoryItems ?? []).map((item) => [item.id, item]));
  const missingIngredients = recipeIngredients.filter((ingredient) => !inventoryItemById.has(ingredient.inventoryItemId));
  if (missingIngredients.length > 0) {
    fail(
      `Could not find: ${missingIngredients
        .map((ingredient) => `${ingredient.ingredientName} (line ${ingredient.lineNumber})`)
        .join(", ")}. Re-select ${missingIngredients.length === 1 ? "this ingredient" : "these ingredients"} and try again.`
    );
  }

  const convertedIngredients = recipeIngredients.map((ingredient) => {
    const item = inventoryItemById.get(ingredient.inventoryItemId);
    const conversion = convertRecipeQuantity(ingredient.inputQuantity, ingredient.inputUnit || item?.unit || "", item?.unit || "", {
      gramsPerCup: item?.recipe_density_grams_per_cup,
    });
    if (conversion.error) {
      fail(`${item?.unit ? itemUnitLabel(item?.unit) : "Ingredient"} conversion error: ${conversion.error}`);
    }
    return {
      ...ingredient,
      convertedQuantity: conversion.quantity,
      inventoryUnit: item?.unit ?? "unit",
    };
  });

  const ingredientCost = convertedIngredients.reduce((total, ingredient) => {
    const item = inventoryItemById.get(ingredient.inventoryItemId);
    return total + ingredient.convertedQuantity * (Number(item?.cost_per_unit) || 0);
  }, 0);
  const safePackagingCost = Number.isFinite(packagingCost) ? packagingCost : 0;
  const safeLaborCost = Number.isFinite(laborCost) ? laborCost : 0;
  const safeOverheadCost = Number.isFinite(overheadCost) ? overheadCost : 0;
  const calculatedCost = calculateRecipeCost({
    batchYield,
    sellingPrice: sellingPrice ?? 0,
    packagingCost: safePackagingCost,
    laborCost: safeLaborCost,
    overheadCost: safeOverheadCost,
    ingredientCost,
    targetMarginPercent,
  });
  const finalSellingPrice = sellingPrice ?? Number(calculatedCost.recommendedPrice.toFixed(2));

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      business_id: businessId,
      name,
      sku: sku || null,
      description: description || null,
      batch_yield: batchYield,
      yield_unit: yieldUnit,
      selling_price: finalSellingPrice,
      packaging_cost: safePackagingCost,
      labor_cost: safeLaborCost,
      overhead_cost: safeOverheadCost,
      target_margin_percent: targetMarginPercent,
      notes: notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (recipeError || !recipe) {
    fail(recipeError?.message || "Could not save this recipe.");
  }

  const ingredientRows = convertedIngredients.map((ingredient, index) => ({
    business_id: businessId,
    recipe_id: recipe.id,
    inventory_item_id: ingredient.inventoryItemId,
    quantity: ingredient.convertedQuantity,
    unit: ingredient.inventoryUnit,
    input_quantity: ingredient.inputQuantity,
    input_unit: ingredient.inputUnit || ingredient.inventoryUnit,
    sort_order: index,
    notes: ingredient.notes,
  }));

  const { error: ingredientError } = await supabase.from("recipe_ingredients").insert(ingredientRows);

  if (ingredientError) {
    await supabase.from("recipes").delete().eq("id", recipe.id).eq("business_id", businessId);
    fail(ingredientError.message || "Could not save recipe ingredients.");
  }

  revalidatePath("/recipes");
  redirect(`/recipes/${recipe.id}?success=${encodeURIComponent(`${name} recipe was created.`)}`);
}

function itemUnitLabel(unit: string) {
  return `Inventory unit ${unit}`;
}

export async function updateRecipe(recipeId: string, formData: FormData) {
  const { supabase, businessId } = await getCurrentBusiness();
  const failCurrent = (message: string): never => failEdit(recipeId, message);

  if (!businessId) {
    failCurrent("No business is linked to this account yet.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const yieldUnit = String(formData.get("yield_unit") ?? "").trim() || "pcs";
  const notes = String(formData.get("notes") ?? "").trim();
  const batchYield = parseNumber(formData.get("batch_yield"));
  const sellingPriceRaw = String(formData.get("selling_price") ?? "").trim();
  const sellingPrice = sellingPriceRaw ? parseNumber(sellingPriceRaw) : null;
  const packagingCost = parseNumber(formData.get("packaging_cost"));
  const laborCost = parseNumber(formData.get("labor_cost"));
  const overheadCost = parseNumber(formData.get("overhead_cost"));
  const targetMarginRaw = String(formData.get("target_margin_percent") ?? "").trim();
  const targetMarginPercent = targetMarginRaw ? parseNumber(targetMarginRaw) : 40;

  if (!name) failCurrent("Recipe name is required.");
  if (!Number.isFinite(batchYield) || batchYield <= 0) failCurrent("Batch yield must be greater than zero.");
  if (sellingPrice != null && (!Number.isFinite(sellingPrice) || sellingPrice < 0)) failCurrent("Selling price must be zero or higher.");
  if (!Number.isFinite(targetMarginPercent) || targetMarginPercent <= 0 || targetMarginPercent >= 100) {
    failCurrent("Target margin must be between 1 and 99.");
  }

  const { data: existingRecipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", recipeId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!existingRecipe) {
    failCurrent("Recipe was not found.");
  }

  const { data: existingIngredientRows, error: existingIngredientError } = await supabase
    .from("recipe_ingredients")
    .select("id")
    .eq("recipe_id", recipeId)
    .eq("business_id", businessId);

  if (existingIngredientError) {
    failCurrent(existingIngredientError.message || "Could not load current recipe ingredients.");
  }

  const ingredientIds = formData.getAll("ingredient_inventory_item_id").map((value) => String(value).trim());
  const inputQuantities = formData.getAll("ingredient_quantity").map((value) => parseNumber(value));
  const inputUnits = formData.getAll("ingredient_unit").map((value) => String(value ?? "").trim());
  const notesList = formData.getAll("ingredient_notes").map((value) => String(value ?? "").trim());

  const recipeIngredients = ingredientIds
    .map((inventoryItemId, index) => ({
      inventoryItemId,
      inputQuantity: inputQuantities[index],
      inputUnit: inputUnits[index],
      notes: notesList[index] || null,
    }))
    .filter((ingredient) => ingredient.inventoryItemId && Number.isFinite(ingredient.inputQuantity) && ingredient.inputQuantity > 0);

  if (recipeIngredients.length === 0) {
    failCurrent("Add at least one ingredient.");
  }

  const { data: inventoryItems, error: inventoryError } = await supabase
    .from("inventory_items")
    .select("id, unit, cost_per_unit, recipe_density_grams_per_cup")
    .eq("business_id", businessId)
    .in(
      "id",
      recipeIngredients.map((ingredient) => ingredient.inventoryItemId)
    );

  if (inventoryError) failCurrent(inventoryError.message || "Could not validate recipe ingredients.");

  const inventoryItemById = new Map((inventoryItems ?? []).map((item) => [item.id, item]));
  if (recipeIngredients.some((ingredient) => !inventoryItemById.has(ingredient.inventoryItemId))) {
    failCurrent("One or more selected ingredients could not be found.");
  }

  const convertedIngredients = recipeIngredients.map((ingredient) => {
    const item = inventoryItemById.get(ingredient.inventoryItemId);
    const conversion = convertRecipeQuantity(ingredient.inputQuantity, ingredient.inputUnit || item?.unit || "", item?.unit || "", {
      gramsPerCup: item?.recipe_density_grams_per_cup,
    });
    if (conversion.error) {
      failCurrent(`${item?.unit ? itemUnitLabel(item.unit) : "Ingredient"} conversion error: ${conversion.error}`);
    }
    return {
      ...ingredient,
      convertedQuantity: conversion.quantity,
      inventoryUnit: item?.unit ?? "unit",
    };
  });

  const ingredientCost = convertedIngredients.reduce((total, ingredient) => {
    const item = inventoryItemById.get(ingredient.inventoryItemId);
    return total + ingredient.convertedQuantity * (Number(item?.cost_per_unit) || 0);
  }, 0);
  const safePackagingCost = Number.isFinite(packagingCost) ? packagingCost : 0;
  const safeLaborCost = Number.isFinite(laborCost) ? laborCost : 0;
  const safeOverheadCost = Number.isFinite(overheadCost) ? overheadCost : 0;
  const calculatedCost = calculateRecipeCost({
    batchYield,
    sellingPrice: sellingPrice ?? 0,
    packagingCost: safePackagingCost,
    laborCost: safeLaborCost,
    overheadCost: safeOverheadCost,
    ingredientCost,
    targetMarginPercent,
  });
  const finalSellingPrice = sellingPrice ?? Number(calculatedCost.recommendedPrice.toFixed(2));

  const { error: updateError } = await supabase
    .from("recipes")
    .update({
      name,
      sku: sku || null,
      description: description || null,
      batch_yield: batchYield,
      yield_unit: yieldUnit,
      selling_price: finalSellingPrice,
      packaging_cost: safePackagingCost,
      labor_cost: safeLaborCost,
      overhead_cost: safeOverheadCost,
      target_margin_percent: targetMarginPercent,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recipeId)
    .eq("business_id", businessId);

  if (updateError) {
    failCurrent(updateError.message || "Could not update this recipe.");
  }

  const ingredientRows = convertedIngredients.map((ingredient, index) => ({
    business_id: businessId,
    recipe_id: recipeId,
    inventory_item_id: ingredient.inventoryItemId,
    quantity: ingredient.convertedQuantity,
    unit: ingredient.inventoryUnit,
    input_quantity: ingredient.inputQuantity,
    input_unit: ingredient.inputUnit || ingredient.inventoryUnit,
    sort_order: index,
    notes: ingredient.notes,
  }));

  const { data: insertedIngredientRows, error: ingredientError } = await supabase.from("recipe_ingredients").insert(ingredientRows).select("id");

  if (ingredientError) {
    failCurrent(ingredientError.message || "Could not save recipe ingredients.");
  }

  const previousIngredientIds = (existingIngredientRows ?? []).map((ingredient) => ingredient.id);
  if (previousIngredientIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("recipe_ingredients")
      .delete()
      .eq("business_id", businessId)
      .in("id", previousIngredientIds);

    if (deleteError) {
      const insertedIds = (insertedIngredientRows ?? []).map((ingredient) => ingredient.id);
      if (insertedIds.length > 0) {
        await supabase.from("recipe_ingredients").delete().eq("business_id", businessId).in("id", insertedIds);
      }
      failCurrent(deleteError.message || "Could not replace recipe ingredients. Existing ingredients were preserved.");
    }
  }

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
  redirect(`/recipes/${recipeId}?success=${encodeURIComponent(`${name} recipe was updated.`)}`);
}

export async function createRecipeVariant(recipeId: string, formData: FormData) {
  const { supabase, businessId } = await getCurrentBusiness();
  const failCurrent = (message: string): never => failVariant(recipeId, message);

  if (!businessId) {
    failCurrent("No business is linked to this account yet.");
  }

  const name = String(formData.get("variant_name") ?? "").trim();
  const sku = String(formData.get("variant_sku") ?? "").trim();
  const sellingPriceRaw = String(formData.get("variant_selling_price") ?? "").trim();
  const sellingPrice = sellingPriceRaw ? parseNumber(sellingPriceRaw) : 0;
  const notes = String(formData.get("variant_notes") ?? "").trim();

  if (!name) failCurrent("Variant name is required.");
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) failCurrent("Variant selling price must be zero or higher.");

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", recipeId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!recipe) {
    failCurrent("Recipe was not found.");
  }

  const ingredientIds = formData.getAll("variant_inventory_item_id").map((value) => String(value).trim());
  const inputQuantities = formData.getAll("variant_quantity").map((value) => parseNumber(value));
  const inputUnits = formData.getAll("variant_unit").map((value) => String(value ?? "").trim());
  const usageBases = formData.getAll("variant_usage_basis").map((value) => String(value ?? "").trim());
  const notesList = formData.getAll("variant_ingredient_notes").map((value) => String(value ?? "").trim());

  const variantIngredients = ingredientIds
    .map((inventoryItemId, index) => ({
      inventoryItemId,
      inputQuantity: inputQuantities[index],
      inputUnit: inputUnits[index],
      usageBasis: usageBases[index] === "per_batch" ? "per_batch" : "per_piece",
      notes: notesList[index] || null,
    }))
    .filter((ingredient) => ingredient.inventoryItemId && Number.isFinite(ingredient.inputQuantity) && ingredient.inputQuantity > 0);

  const { data: inventoryItems, error: inventoryError } = variantIngredients.length
    ? await supabase
        .from("inventory_items")
        .select("id, unit, cost_per_unit, recipe_density_grams_per_cup")
        .eq("business_id", businessId)
        .in(
          "id",
          variantIngredients.map((ingredient) => ingredient.inventoryItemId)
        )
    : { data: [], error: null };

  if (inventoryError) failCurrent(inventoryError.message || "Could not validate variant ingredients.");

  const inventoryItemById = new Map((inventoryItems ?? []).map((item) => [item.id, item]));
  if (variantIngredients.some((ingredient) => !inventoryItemById.has(ingredient.inventoryItemId))) {
    failCurrent("One or more selected variant ingredients could not be found.");
  }

  const convertedIngredients = variantIngredients.map((ingredient) => {
    const item = inventoryItemById.get(ingredient.inventoryItemId);
    const conversion = convertRecipeQuantity(ingredient.inputQuantity, ingredient.inputUnit || item?.unit || "", item?.unit || "", {
      gramsPerCup: item?.recipe_density_grams_per_cup,
    });
    if (conversion.error) {
      failCurrent(`${item?.unit ? itemUnitLabel(item.unit) : "Ingredient"} conversion error: ${conversion.error}`);
    }
    return {
      ...ingredient,
      convertedQuantity: conversion.quantity,
      inventoryUnit: item?.unit ?? "unit",
    };
  });

  const { data: variant, error: variantError } = await supabase
    .from("recipe_variants")
    .insert({
      business_id: businessId,
      recipe_id: recipeId,
      name,
      sku: sku || null,
      selling_price: sellingPrice,
      notes: notes || null,
    })
    .select("id")
    .single();

  const variantId = variant?.id;

  if (variantError || !variantId) {
    failCurrent(variantError?.message || "Could not save this recipe variant.");
  }

  if (convertedIngredients.length > 0) {
    const { error: ingredientError } = await supabase.from("recipe_variant_ingredients").insert(
      convertedIngredients.map((ingredient, index) => ({
        business_id: businessId,
        recipe_variant_id: variantId,
        inventory_item_id: ingredient.inventoryItemId,
        input_quantity: ingredient.inputQuantity,
        input_unit: ingredient.inputUnit || ingredient.inventoryUnit,
        quantity: ingredient.convertedQuantity,
        unit: ingredient.inventoryUnit,
        usage_basis: ingredient.usageBasis,
        sort_order: index,
        notes: ingredient.notes,
      }))
    );

    if (ingredientError) {
      await supabase.from("recipe_variants").delete().eq("id", variantId).eq("business_id", businessId);
      failCurrent(ingredientError.message || "Could not save variant ingredients.");
    }
  }

  revalidatePath(`/recipes/${recipeId}`);
  redirect(`/recipes/${recipeId}?success=${encodeURIComponent(`${name} variant was added.`)}`);
}

export async function updateRecipeVariant(recipeId: string, variantId: string, formData: FormData) {
  const { supabase, businessId } = await getCurrentBusiness();
  const failCurrent = (message: string): never => failVariant(recipeId, message);

  if (!businessId) {
    failCurrent("No business is linked to this account yet.");
  }

  const name = String(formData.get("variant_name") ?? "").trim();
  const sku = String(formData.get("variant_sku") ?? "").trim();
  const sellingPriceRaw = String(formData.get("variant_selling_price") ?? "").trim();
  const sellingPrice = sellingPriceRaw ? parseNumber(sellingPriceRaw) : 0;
  const notes = String(formData.get("variant_notes") ?? "").trim();

  if (!name) failCurrent("Variant name is required.");
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) failCurrent("Variant selling price must be zero or higher.");

  const { data: existingVariant } = await supabase
    .from("recipe_variants")
    .select("id")
    .eq("id", variantId)
    .eq("recipe_id", recipeId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!existingVariant) {
    failCurrent("Variant was not found.");
  }

  const { data: existingVariantIngredientRows, error: existingVariantIngredientError } = await supabase
    .from("recipe_variant_ingredients")
    .select("id")
    .eq("recipe_variant_id", variantId)
    .eq("business_id", businessId);

  if (existingVariantIngredientError) {
    failCurrent(existingVariantIngredientError.message || "Could not load current variant ingredients.");
  }

  const ingredientIds = formData.getAll("variant_inventory_item_id").map((value) => String(value).trim());
  const inputQuantities = formData.getAll("variant_quantity").map((value) => parseNumber(value));
  const inputUnits = formData.getAll("variant_unit").map((value) => String(value ?? "").trim());
  const usageBases = formData.getAll("variant_usage_basis").map((value) => String(value ?? "").trim());
  const notesList = formData.getAll("variant_ingredient_notes").map((value) => String(value ?? "").trim());

  const variantIngredients = ingredientIds
    .map((inventoryItemId, index) => ({
      inventoryItemId,
      inputQuantity: inputQuantities[index],
      inputUnit: inputUnits[index],
      usageBasis: usageBases[index] === "per_batch" ? "per_batch" : "per_piece",
      notes: notesList[index] || null,
    }))
    .filter((ingredient) => ingredient.inventoryItemId && Number.isFinite(ingredient.inputQuantity) && ingredient.inputQuantity > 0);

  const { data: inventoryItems, error: inventoryError } = variantIngredients.length
    ? await supabase
        .from("inventory_items")
        .select("id, unit, cost_per_unit, recipe_density_grams_per_cup")
        .eq("business_id", businessId)
        .in(
          "id",
          variantIngredients.map((ingredient) => ingredient.inventoryItemId)
        )
    : { data: [], error: null };

  if (inventoryError) failCurrent(inventoryError.message || "Could not validate variant ingredients.");

  const inventoryItemById = new Map((inventoryItems ?? []).map((item) => [item.id, item]));
  if (variantIngredients.some((ingredient) => !inventoryItemById.has(ingredient.inventoryItemId))) {
    failCurrent("One or more selected variant ingredients could not be found.");
  }

  const convertedIngredients = variantIngredients.map((ingredient) => {
    const item = inventoryItemById.get(ingredient.inventoryItemId);
    const conversion = convertRecipeQuantity(ingredient.inputQuantity, ingredient.inputUnit || item?.unit || "", item?.unit || "", {
      gramsPerCup: item?.recipe_density_grams_per_cup,
    });
    if (conversion.error) {
      failCurrent(`${item?.unit ? itemUnitLabel(item.unit) : "Ingredient"} conversion error: ${conversion.error}`);
    }
    return {
      ...ingredient,
      convertedQuantity: conversion.quantity,
      inventoryUnit: item?.unit ?? "unit",
    };
  });

  const { data: updatedVariant, error: variantError } = await supabase
    .from("recipe_variants")
    .update({
      name,
      sku: sku || null,
      selling_price: sellingPrice,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", variantId)
    .eq("recipe_id", recipeId)
    .eq("business_id", businessId)
    .select("id")
    .maybeSingle();

  if (variantError || !updatedVariant) {
    failCurrent(variantError?.message || "Could not update this recipe variant.");
  }

  let insertedVariantIngredientIds: string[] = [];
  if (convertedIngredients.length > 0) {
    const { data: insertedRows, error: ingredientError } = await supabase
      .from("recipe_variant_ingredients")
      .insert(
        convertedIngredients.map((ingredient, index) => ({
          business_id: businessId,
          recipe_variant_id: variantId,
          inventory_item_id: ingredient.inventoryItemId,
          input_quantity: ingredient.inputQuantity,
          input_unit: ingredient.inputUnit || ingredient.inventoryUnit,
          quantity: ingredient.convertedQuantity,
          unit: ingredient.inventoryUnit,
          usage_basis: ingredient.usageBasis,
          sort_order: index,
          notes: ingredient.notes,
        }))
      )
      .select("id");

    if (ingredientError) {
      failCurrent(ingredientError.message || "Could not save variant ingredients.");
    }
    insertedVariantIngredientIds = (insertedRows ?? []).map((ingredient) => ingredient.id);
  }

  const previousVariantIngredientIds = (existingVariantIngredientRows ?? []).map((ingredient) => ingredient.id);
  if (previousVariantIngredientIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("recipe_variant_ingredients")
      .delete()
      .eq("business_id", businessId)
      .in("id", previousVariantIngredientIds);

    if (deleteError) {
      if (insertedVariantIngredientIds.length > 0) {
        await supabase.from("recipe_variant_ingredients").delete().eq("business_id", businessId).in("id", insertedVariantIngredientIds);
      }
      failCurrent(deleteError.message || "Could not replace variant ingredients. Existing ingredients were preserved.");
    }
  }

  revalidatePath(`/recipes/${recipeId}`);
  redirect(`/recipes/${recipeId}?success=${encodeURIComponent(`${name} variant was updated.`)}`);
}

export async function deleteRecipeVariant(recipeId: string, variantId: string) {
  const { supabase, businessId } = await getCurrentBusiness();

  if (!businessId) {
    failVariant(recipeId, "No business is linked to this account yet.");
  }

  const { error } = await supabase
    .from("recipe_variants")
    .delete()
    .eq("id", variantId)
    .eq("recipe_id", recipeId)
    .eq("business_id", businessId);

  if (error) {
    failVariant(recipeId, error.message || "Could not delete this variant.");
  }

  revalidatePath(`/recipes/${recipeId}`);
  redirect(`/recipes/${recipeId}?success=${encodeURIComponent("Variant deleted.")}`);
}

export async function toggleRecipeVariantStatus(recipeId: string, variantId: string, isActive: boolean) {
  const { supabase, businessId } = await getCurrentBusiness();

  if (!businessId) {
    failVariant(recipeId, "No business is linked to this account yet.");
  }

  const { error } = await supabase
    .from("recipe_variants")
    .update({
      is_active: !isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", variantId)
    .eq("recipe_id", recipeId)
    .eq("business_id", businessId);

  if (error) {
    failVariant(recipeId, error.message || "Could not update this variant status.");
  }

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/products");
  revalidatePath("/production");
  revalidatePath("/sales");
  redirect(`/recipes/${recipeId}?success=${encodeURIComponent(`Variant ${isActive ? "archived" : "reactivated"}.`)}`);
}
