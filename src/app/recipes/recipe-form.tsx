"use client";

import Link from "next/link";
import { Plus, Save, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateRecipeCost } from "@/lib/recipes/costing";
import { convertRecipeQuantity, recipeUnitOptions } from "@/lib/recipes/units";
import { createRecipe } from "./actions";

type InventoryOption = {
  id: string;
  name: string;
  brand_name: string | null;
  unit: string;
  cost_per_unit: string | number;
  recipe_density_grams_per_cup: string | number | null;
  recipe_measurement_note: string | null;
};

type IngredientRow = {
  key: string;
  inventoryItemId: string;
  displayName: string;
  quantity: string;
  unit: string;
  notes: string;
};

type RecipeDraft = {
  name: string;
  sku: string;
  description: string;
  yieldUnit: string;
  notes: string;
  batchYield: string;
  sellingPrice: string;
  packagingCost: string;
  laborCost: string;
  overheadCost: string;
  targetMarginPercent: string;
  rows: IngredientRow[];
};

const recipeDraftKey = "biztally:new-recipe-draft";

export type RecipeFormInitialValue = {
  name: string;
  sku: string | null;
  description: string | null;
  batch_yield: string | number;
  yield_unit: string;
  selling_price: string | number;
  packaging_cost: string | number;
  labor_cost: string | number;
  overhead_cost: string | number;
  target_margin_percent: string | number | null;
  notes: string | null;
  recipe_ingredients: {
    id: string;
    inventory_item_id: string;
    input_quantity: string | number | null;
    input_unit: string | null;
    quantity: string | number;
    unit: string;
    notes: string | null;
  }[];
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 gap-2" disabled={pending}>
      <Save size={16} />
      {pending ? "Saving recipe..." : label}
    </Button>
  );
}

function toNumber(value: string | number | null | undefined) {
  if (value == null || value === "") return 0;
  return typeof value === "number" ? value : Number.parseFloat(value) || 0;
}

function formatStock(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatMoney(value: string | number | null | undefined, currency = "PHP") {
  const amount = toNumber(value);
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `P${amount.toFixed(2)}`;
  }
}

function IngredientSearchSelect({
  id,
  value,
  options,
  placeholder = "Search inventory item",
  onSelect,
  onInvalid,
}: {
  id: string;
  value: string;
  options: InventoryOption[];
  placeholder?: string;
  onSelect: (item: InventoryOption | null) => void;
  onInvalid?: () => void;
}) {
  const selected = options.find((item) => item.id === value) ?? null;
  const [query, setQuery] = useState(selected ? `${selected.name}${selected.brand_name ? ` - ${selected.brand_name}` : ""}` : "");
  const [open, setOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options.slice(0, 12);

    return options
      .filter((item) =>
        [item.name, item.brand_name, item.unit]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      )
      .slice(0, 12);
  }, [options, query]);

  return (
    <div className="relative">
      <input
        type="hidden"
        name="ingredient_inventory_item_id"
        value={value}
        required
        onInvalid={onInvalid}
      />
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        autoComplete="off"
        className="pl-9"
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (value) onSelect(null);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            setQuery(selected ? `${selected.name}${selected.brand_name ? ` - ${selected.brand_name}` : ""}` : "");
          }, 120);
        }}
      />
      {open ? (
        <div
          id={`${id}-options`}
          className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm hover:bg-[var(--surface-alt)]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(item);
                  setQuery(`${item.name}${item.brand_name ? ` - ${item.brand_name}` : ""}`);
                  setOpen(false);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.name}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {item.brand_name ? `${item.brand_name} - ` : ""}
                    {formatMoney(item.cost_per_unit)} / {item.unit}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-[var(--muted)]">{item.unit}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-[var(--muted)]">No matching inventory item.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function RecipeForm({
  inventoryItems,
  currency,
  action = createRecipe,
  initialRecipe,
  submitLabel = "Save recipe",
  cancelHref = "/recipes",
}: {
  inventoryItems: InventoryOption[];
  currency: string;
  action?: (formData: FormData) => void | Promise<void>;
  initialRecipe?: RecipeFormInitialValue;
  submitLabel?: string;
  cancelHref?: string;
}) {
  const searchParams = useSearchParams();
  const formError = !initialRecipe ? searchParams.get("error") : null;
  const [clientError, setClientError] = useState<string | null>(null);
  const [rows, setRows] = useState<IngredientRow[]>([
    ...(initialRecipe?.recipe_ingredients.length
      ? initialRecipe.recipe_ingredients.map((ingredient) => ({
          key: ingredient.id,
          inventoryItemId: ingredient.inventory_item_id,
          displayName: inventoryItems.find((item) => item.id === ingredient.inventory_item_id)?.name ?? "",
          quantity: String(ingredient.input_quantity ?? ingredient.quantity ?? ""),
          unit: ingredient.input_unit ?? ingredient.unit ?? "g",
          notes: ingredient.notes ?? "",
        }))
      : [{ key: "ingredient-new-0", inventoryItemId: "", displayName: "", quantity: "", unit: "g", notes: "" }]),
  ]);
  const [batchYield, setBatchYield] = useState(String(initialRecipe?.batch_yield ?? "24"));
  const [sellingPrice, setSellingPrice] = useState(initialRecipe ? String(initialRecipe.selling_price ?? "") : "");
  const [packagingCost, setPackagingCost] = useState(String(initialRecipe?.packaging_cost ?? ""));
  const [laborCost, setLaborCost] = useState(String(initialRecipe?.labor_cost ?? ""));
  const [overheadCost, setOverheadCost] = useState(String(initialRecipe?.overhead_cost ?? ""));
  const [targetMarginPercent, setTargetMarginPercent] = useState(String(initialRecipe?.target_margin_percent ?? "40"));
  const [name, setName] = useState(initialRecipe?.name ?? "");
  const [sku, setSku] = useState(initialRecipe?.sku ?? "");
  const [description, setDescription] = useState(initialRecipe?.description ?? "");
  const [yieldUnit, setYieldUnit] = useState(initialRecipe?.yield_unit ?? "pcs");
  const [recipeNotes, setRecipeNotes] = useState(initialRecipe?.notes ?? "");

  useEffect(() => {
    if (!formError || initialRecipe) return;
    const savedDraft = window.sessionStorage.getItem(recipeDraftKey);
    if (!savedDraft) return;

    try {
      const draft = JSON.parse(savedDraft) as RecipeDraft;
      queueMicrotask(() => {
        setName(draft.name);
        setSku(draft.sku);
        setDescription(draft.description);
        setYieldUnit(draft.yieldUnit);
        setRecipeNotes(draft.notes);
        setBatchYield(draft.batchYield);
        setSellingPrice(draft.sellingPrice);
        setPackagingCost(draft.packagingCost);
        setLaborCost(draft.laborCost);
        setOverheadCost(draft.overheadCost);
        setTargetMarginPercent(draft.targetMarginPercent);
        setRows(draft.rows);
      });
    } catch {
      window.sessionStorage.removeItem(recipeDraftKey);
    }
  }, [formError, initialRecipe]);

  const itemById = useMemo(() => new Map(inventoryItems.map((item) => [item.id, item])), [inventoryItems]);

  const ingredientCost = rows.reduce((total, row) => {
    const item = itemById.get(row.inventoryItemId);
    if (!item) return total;
    const converted = convertRecipeQuantity(toNumber(row.quantity), row.unit, item.unit, {
      gramsPerCup: item.recipe_density_grams_per_cup,
    });
    if (converted.error) return total;
    return total + converted.quantity * toNumber(item.cost_per_unit);
  }, 0);

  const cost = calculateRecipeCost({
    batchYield: toNumber(batchYield),
    sellingPrice: toNumber(sellingPrice),
    packagingCost: toNumber(packagingCost),
    laborCost: toNumber(laborCost),
    overheadCost: toNumber(overheadCost),
    ingredientCost,
    targetMarginPercent: toNumber(targetMarginPercent),
  });
  const effectiveSellingPrice = sellingPrice ? toNumber(sellingPrice) : cost.recommendedPrice;
  const previewProfitPerUnit = effectiveSellingPrice - cost.costPerUnit;
  const previewMarginPercent = effectiveSellingPrice > 0 ? (previewProfitPerUnit / effectiveSellingPrice) * 100 : 0;

  function updateRow(key: string, patch: Partial<IngredientRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { key: crypto.randomUUID(), inventoryItemId: "", displayName: "", quantity: "", unit: "g", notes: "" }]);
  }

  function removeRow(key: string) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const missingRows = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !row.inventoryItemId || !itemById.has(row.inventoryItemId));

    if (missingRows.length > 0) {
      event.preventDefault();
      setClientError(
        `Check ${missingRows
          .map(({ row, index }) => row.displayName || `ingredient ${index + 1}`)
          .join(", ")}. ${missingRows.length === 1 ? "It is" : "They are"} no longer available in inventory.`
      );
      return;
    }

    setClientError(null);
    if (initialRecipe) return;
    const draft: RecipeDraft = {
      name,
      sku,
      description,
      yieldUnit,
      notes: recipeNotes,
      batchYield,
      sellingPrice,
      packagingCost,
      laborCost,
      overheadCost,
      targetMarginPercent,
      rows,
    };
    window.sessionStorage.setItem(recipeDraftKey, JSON.stringify(draft));
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {clientError || formError ? (
          <div role="alert" className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {clientError || formError}
          </div>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Recipe details</CardTitle>
            <p className="text-sm text-[var(--muted)]">Define the product and yield. BizTally can recommend the per-piece price.</p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Recipe / product name</Label>
              <Input id="name" name="name" placeholder="Revel Bars 24 pcs" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" placeholder="RB-24" value={sku} onChange={(event) => setSku(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="selling_price">Manual selling price per piece</Label>
              <Input
                id="selling_price"
                name="selling_price"
                inputMode="decimal"
                placeholder={`Leave blank to use ${formatMoney(cost.recommendedPrice, currency)}`}
                value={sellingPrice}
                onChange={(event) => setSellingPrice(event.target.value)}
              />
              <p className="text-xs text-[var(--muted)]">Optional. If blank, the recommended price below will be saved.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch_yield">Batch yield</Label>
              <Input
                id="batch_yield"
                name="batch_yield"
                inputMode="decimal"
                required
                value={batchYield}
                onChange={(event) => setBatchYield(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yield_unit">Yield unit</Label>
              <Input id="yield_unit" name="yield_unit" value={yieldUnit} onChange={(event) => setYieldUnit(event.target.value)} placeholder="pcs" required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-[96px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                placeholder="Short production notes or product description"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Ingredients</CardTitle>
              <p className="mt-1 text-sm text-[var(--muted)]">Use the same unit shown in inventory for accurate costing.</p>
            </div>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-alt)]"
            >
              <Plus size={16} />
              Add line
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.map((row, index) => {
              const item = itemById.get(row.inventoryItemId);
              const ingredientMissing = Boolean(row.inventoryItemId && !item);
              const conversion = item
                ? convertRecipeQuantity(toNumber(row.quantity), row.unit, item.unit, {
                    gramsPerCup: item.recipe_density_grams_per_cup,
                  })
                : null;
              const lineCost = conversion && !conversion.error ? conversion.quantity * toNumber(item?.cost_per_unit) : 0;

              return (
                <div key={row.key} className={`rounded-[var(--radius-md)] border bg-[var(--surface-alt)] p-3 ${ingredientMissing ? "border-red-300" : "border-[var(--border)]"}`}>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_120px_120px_1fr_40px]">
                    <div className="space-y-2">
                      <Label htmlFor={`ingredient-${row.key}`}>Ingredient {index + 1}</Label>
                      <IngredientSearchSelect
                        id={`ingredient-${row.key}`}
                        value={row.inventoryItemId}
                        options={inventoryItems}
                        onInvalid={() => {
                          setClientError(`${row.displayName || `Ingredient ${index + 1}`} is not available. Select a current inventory item before saving.`);
                        }}
                        onSelect={(selected) => {
                          updateRow(row.key, {
                            inventoryItemId: selected?.id ?? "",
                            displayName: selected ? `${selected.name}${selected.brand_name ? ` - ${selected.brand_name}` : ""}` : "",
                            unit: selected?.unit ?? row.unit,
                          });
                          setClientError(null);
                        }}
                      />
                      <input type="hidden" name="ingredient_name" value={row.displayName || (item ? `${item.name}${item.brand_name ? ` - ${item.brand_name}` : ""}` : `Ingredient ${index + 1}`)} />
                      {ingredientMissing ? <p className="text-xs text-red-600">This ingredient is no longer available. Choose another item.</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`quantity-${row.key}`}>Quantity</Label>
                      <Input
                        id={`quantity-${row.key}`}
                        name="ingredient_quantity"
                        inputMode="decimal"
                        placeholder={item ? item.unit : "0"}
                        value={row.quantity}
                        required
                        onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`unit-${row.key}`}>Recipe unit</Label>
                      <select
                        id={`unit-${row.key}`}
                        name="ingredient_unit"
                        className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                        value={row.unit}
                        required
                        onChange={(event) => updateRow(row.key, { unit: event.target.value })}
                      >
                        {recipeUnitOptions.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`notes-${row.key}`}>Line note</Label>
                      <Input
                        id={`notes-${row.key}`}
                        name="ingredient_notes"
                        placeholder={item ? `${formatMoney(item.cost_per_unit, currency)} / ${item.unit}` : "Optional"}
                        value={row.notes}
                        onChange={(event) => updateRow(row.key, { notes: event.target.value })}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--danger)]"
                        aria-label="Remove ingredient"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {item && conversion && !conversion.error
                      ? `${formatStock(toNumber(row.quantity))} ${row.unit} = ${formatStock(conversion.quantity)} ${item.unit} x ${formatMoney(item.cost_per_unit, currency)} = ${formatMoney(lineCost, currency)}`
                      : item && conversion?.error
                        ? conversion.error
                      : "Choose an inventory item to calculate this line."}
                    {item?.recipe_measurement_note ? ` ${item.recipe_measurement_note}` : ""}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Other costs</CardTitle>
            <p className="text-sm text-[var(--muted)]">Add costs that are not tracked as inventory yet.</p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="packaging_cost">Packaging per batch</Label>
              <Input id="packaging_cost" name="packaging_cost" inputMode="decimal" value={packagingCost} onChange={(event) => setPackagingCost(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="labor_cost">Labor per batch</Label>
              <Input id="labor_cost" name="labor_cost" inputMode="decimal" value={laborCost} onChange={(event) => setLaborCost(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="overhead_cost">Overhead per batch</Label>
              <Input id="overhead_cost" name="overhead_cost" inputMode="decimal" value={overheadCost} onChange={(event) => setOverheadCost(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_margin_percent">Target margin %</Label>
              <Input
                id="target_margin_percent"
                name="target_margin_percent"
                inputMode="decimal"
                value={targetMarginPercent}
                onChange={(event) => setTargetMarginPercent(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                value={recipeNotes}
                onChange={(event) => setRecipeNotes(event.target.value)}
                className="min-h-[96px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Cost preview</CardTitle>
            <p className="text-sm text-[var(--muted)]">Updates as you build the recipe.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                <p className="text-xs text-[var(--muted)]">Batch cost</p>
                <p className="mt-1 text-lg font-bold">{formatMoney(cost.totalCost, currency)}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                <p className="text-xs text-[var(--muted)]">Cost / unit</p>
                <p className="mt-1 text-lg font-bold">{formatMoney(cost.costPerUnit, currency)}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                <p className="text-xs text-[var(--muted)]">Profit / unit</p>
                <p className="mt-1 text-lg font-bold">{formatMoney(previewProfitPerUnit, currency)}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                <p className="text-xs text-[var(--muted)]">Margin</p>
                <p className="mt-1 text-lg font-bold">{previewMarginPercent.toFixed(1)}%</p>
              </div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-sm font-medium">Recommended selling price</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Based on ingredient consumption, added costs, yield, and {cost.targetMarginPercent.toFixed(0)}% target margin.
              </p>
              <p className="mt-2 text-xl font-bold">{formatMoney(cost.recommendedPrice, currency)}</p>
              {!sellingPrice ? (
                <p className="mt-2 text-xs text-[var(--muted)]">This price will be saved because manual selling price is blank.</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
              <SubmitButton label={submitLabel} />
              <Link
                href={cancelHref}
                className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-alt)]"
              >
                Cancel
              </Link>
            </div>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}
