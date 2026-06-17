export type RecipeCostInput = {
  batchYield: number;
  sellingPrice: number;
  packagingCost: number;
  laborCost: number;
  overheadCost: number;
  ingredientCost: number;
  targetMarginPercent?: number;
};

export function calculateRecipeCost(input: RecipeCostInput) {
  const batchYield = input.batchYield > 0 ? input.batchYield : 1;
  const targetMarginPercent =
    input.targetMarginPercent != null && input.targetMarginPercent > 0 && input.targetMarginPercent < 100
      ? input.targetMarginPercent
      : 40;
  const totalCost = input.ingredientCost + input.packagingCost + input.laborCost + input.overheadCost;
  const costPerUnit = totalCost / batchYield;
  const profitPerUnit = input.sellingPrice - costPerUnit;
  const marginPercent = input.sellingPrice > 0 ? (profitPerUnit / input.sellingPrice) * 100 : 0;
  const recommendedPrice = costPerUnit > 0 ? costPerUnit / (1 - targetMarginPercent / 100) : 0;

  return {
    totalCost,
    costPerUnit,
    profitPerUnit,
    marginPercent,
    targetMarginPercent,
    recommendedPrice,
    suggestedPriceFor40Margin: costPerUnit > 0 ? costPerUnit / 0.6 : 0,
  };
}
