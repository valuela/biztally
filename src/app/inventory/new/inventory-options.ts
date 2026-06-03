import { Boxes, Layers3, Package2, Wheat } from "lucide-react";

export const inventoryTypeOptions = [
  {
    value: "finished_product",
    label: "Finished product",
    description: "Goods you sell directly.",
    icon: Package2,
  },
  {
    value: "raw_material",
    label: "Ingredient",
    description: "Inputs used in recipes.",
    icon: Wheat,
  },
  {
    value: "packaging",
    label: "Packaging",
    description: "Boxes, labels, and wraps.",
    icon: Layers3,
  },
  {
    value: "supply",
    label: "Supply",
    description: "Operational consumables.",
    icon: Boxes,
  },
] as const;
