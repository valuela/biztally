export const inventoryUnitOptions = [
  { value: "kg", label: "kg - kilograms" },
  { value: "g", label: "g - grams" },
  { value: "L", label: "L - liters" },
  { value: "ml", label: "ml - milliliters" },
  { value: "pcs", label: "pcs - pieces" },
  { value: "pack", label: "pack - packs" },
  { value: "box", label: "box - boxes" },
] as const;

export const inventoryUnitValues = inventoryUnitOptions.map((unit) => unit.value);
