"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CostFieldsProps = {
  currency: string;
  stockUnit: string;
  idPrefix?: string;
  defaultPackageSize?: string | number | null;
  defaultPackageUnit?: string | null;
  lockPackageSize?: boolean;
};

function computeUnitCost(purchasePrice: string, quantity: string) {
  const price = Number(purchasePrice);
  const received = Number(quantity);

  if (!Number.isFinite(price) || !Number.isFinite(received) || received <= 0) {
    return "";
  }

  return (price / received).toFixed(2);
}

function toInputValue(value: string | number | null | undefined) {
  return value == null ? "" : String(value);
}

export function CostFields({
  currency,
  stockUnit,
  idPrefix = "",
  defaultPackageSize,
  defaultPackageUnit,
  lockPackageSize = false,
}: CostFieldsProps) {
  const fieldId = (name: string) => `${idPrefix}${name}`;
  const [packagesReceived, setPackagesReceived] = useState("1");
  const [packageSize, setPackageSize] = useState(toInputValue(defaultPackageSize));
  const [purchasePrice, setPurchasePrice] = useState("");
  const [manualCostValue, setManualCostValue] = useState("");
  const [manualCost, setManualCost] = useState(false);
  const packageUnit = defaultPackageUnit || stockUnit;
  const hasLockedPackageSize = lockPackageSize && packageSize !== "";
  const quantityReceived = computeQuantityReceived(packagesReceived, packageSize);
  const computedCost = computeUnitCost(purchasePrice, quantityReceived);
  const costPerUnit = manualCost ? manualCostValue : computedCost || "0.00";

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={fieldId("packages_received")}>Packages bought</Label>
        <Input
          id={fieldId("packages_received")}
          name="packages_received"
          type="number"
          step="0.01"
          min="0"
          value={packagesReceived}
          onChange={(event) => {
            setPackagesReceived(event.target.value);
            setManualCost(false);
          }}
          required
        />
      </div>

      {hasLockedPackageSize ? (
        <div className="space-y-2">
          <Label>Package size</Label>
          <input type="hidden" name="package_size" value={packageSize} />
          <div className="flex h-10 items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 text-sm font-medium text-[var(--foreground)]">
            {packageSize} {packageUnit || "unit"} per pack
          </div>
          <p className="text-xs text-[var(--muted)]">
            Saved on this item, so you only enter how many packs you bought.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={fieldId("package_size")}>Size per package</Label>
          <Input
            id={fieldId("package_size")}
            name="package_size"
            type="number"
            step="0.01"
            min="0"
            placeholder={stockUnit ? `2 ${stockUnit}` : "2"}
            value={packageSize}
            onChange={(event) => {
              setPackageSize(event.target.value);
              setManualCost(false);
            }}
            required
          />
          <p className="text-xs text-[var(--muted)]">
            Save the pack size once for this item or barcode, such as 2 kg per pack.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={fieldId("quantity_on_hand")}>Quantity added to stock</Label>
        <div className="relative">
          <Input id={fieldId("quantity_on_hand")} name="quantity_on_hand" type="number" step="0.01" min="0" value={quantityReceived} readOnly required className="pr-16" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">
            {packageUnit || "unit"}
          </span>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Example: 3 packs x 2 {packageUnit || "kg"} becomes 6 {packageUnit || "kg"} in stock.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={fieldId("purchase_price")}>Purchase price ({currency})</Label>
        <Input
          id={fieldId("purchase_price")}
          name="purchase_price"
          type="number"
          step="0.01"
          min="0"
          placeholder="Total paid for this purchase"
          value={purchasePrice}
          onChange={(event) => {
            setPurchasePrice(event.target.value);
            setManualCost(false);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={fieldId("cost_per_unit")}>Cost per unit ({currency})</Label>
        <Input
          id={fieldId("cost_per_unit")}
          name="cost_per_unit"
          type="number"
          step="0.01"
          min="0"
          value={costPerUnit}
          onChange={(event) => {
            setManualCost(true);
            setManualCostValue(event.target.value);
          }}
          required
        />
        <p className="text-xs text-[var(--muted)]">
          Auto-computed per {stockUnit || "stock unit"} from purchase price divided by stock quantity.
        </p>
      </div>
    </>
  );
}

function computeQuantityReceived(packagesReceived: string, packageSize: string) {
  const packages = Number(packagesReceived);
  const size = Number(packageSize);

  if (!Number.isFinite(packages) || !Number.isFinite(size) || packages <= 0 || size <= 0) {
    return "0";
  }

  const quantity = packages * size;
  return Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(2);
}
