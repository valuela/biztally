export const recipeUnitOptions = [
  "g",
  "kg",
  "ml",
  "L",
  "tsp",
  "tbsp",
  "cup",
  "pc",
  "pcs",
  "pack",
] as const;

export type RecipeConversionOptions = {
  gramsPerCup?: number | string | null;
};

const weightToGram: Record<string, number> = {
  g: 1,
  kg: 1000,
};

const volumeToMl: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
};

const countToPiece: Record<string, number> = {
  pc: 1,
  pcs: 1,
  pack: 1,
};

function normalizeUnit(unit: string) {
  return unit.trim().toLowerCase();
}

function convertWithinGroup(quantity: number, fromUnit: string, toUnit: string, group: Record<string, number>) {
  const from = group[normalizeUnit(fromUnit)];
  const to = group[normalizeUnit(toUnit)];
  if (!from || !to) return null;
  return (quantity * from) / to;
}

function volumeToCups(quantity: number, fromUnit: string) {
  const from = volumeToMl[normalizeUnit(fromUnit)];
  if (!from) return null;
  return (quantity * from) / volumeToMl.cup;
}

export function convertRecipeQuantity(
  quantity: number,
  fromUnit: string,
  inventoryUnit: string,
  options: RecipeConversionOptions = {}
) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { quantity: 0, error: "Quantity must be greater than zero." };
  }

  const normalizedFrom = normalizeUnit(fromUnit);
  const normalizedInventory = normalizeUnit(inventoryUnit);

  if (normalizedFrom === normalizedInventory) {
    return { quantity, error: null };
  }

  const weight = convertWithinGroup(quantity, normalizedFrom, normalizedInventory, weightToGram);
  if (weight != null) return { quantity: weight, error: null };

  const volume = convertWithinGroup(quantity, normalizedFrom, normalizedInventory, volumeToMl);
  if (volume != null) return { quantity: volume, error: null };

  const gramsPerCup = options.gramsPerCup == null ? 0 : Number(options.gramsPerCup);
  const cups = volumeToCups(quantity, normalizedFrom);
  if (cups != null && gramsPerCup > 0 && weightToGram[normalizedInventory]) {
    const grams = cups * gramsPerCup;
    return { quantity: grams / weightToGram[normalizedInventory], error: null };
  }

  if (cups != null && weightToGram[normalizedInventory]) {
    return {
      quantity: 0,
      error: `Use grams for this dry ingredient, or set its grams-per-cup conversion in inventory first.`,
    };
  }

  const count = convertWithinGroup(quantity, normalizedFrom, normalizedInventory, countToPiece);
  if (count != null) return { quantity: count, error: null };

  return {
    quantity: 0,
    error: `Cannot convert ${fromUnit} to ${inventoryUnit}. Use a ${inventoryUnit} amount for now, or add item-specific conversion later.`,
  };
}
