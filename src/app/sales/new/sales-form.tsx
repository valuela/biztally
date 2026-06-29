"use client";

import Link from "next/link";
import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSale, updateSale } from "../actions";

type ProductOption = {
  id: string;
  name: string;
  package_label: string;
  selling_price: string | number;
  available_packages: number;
};

type SaleLine = {
  productId: string;
  quantitySold: string;
  sellingPrice: string;
};

function toNumber(value: string | number | null | undefined) {
  if (value == null || value === "") return 0;
  return typeof value === "number" ? value : Number.parseFloat(value) || 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(value);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 gap-2" disabled={pending}>
      <Save size={16} />
      {pending ? "Saving..." : editing ? "Save changes" : "Record sale"}
    </Button>
  );
}

type InitialSale = {
  id: string;
  sale_date: string;
  customer_name: string | null;
  payment_method: string;
  status: string;
  notes: string | null;
  items: {
    sellable_product_id: string;
    quantity_sold: string | number;
    selling_price_per_package: string | number;
  }[];
};

export function SalesForm({
  products,
  customerSuggestions = [],
  initialSale,
}: {
  products: ProductOption[];
  customerSuggestions?: string[];
  initialSale?: InitialSale;
}) {
  const editing = Boolean(initialSale);
  const defaultProduct = products[0];
  const [lines, setLines] = useState<SaleLine[]>(
    initialSale?.items?.length
      ? initialSale.items.map((item) => ({
          productId: item.sellable_product_id,
          quantitySold: String(item.quantity_sold),
          sellingPrice: String(item.selling_price_per_package),
        }))
      : [
          {
            productId: defaultProduct?.id ?? "",
            quantitySold: "1",
            sellingPrice: String(defaultProduct?.selling_price ?? ""),
          },
        ]
  );
  const [customerName, setCustomerName] = useState(initialSale?.customer_name ?? "");
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const expectedRevenue = lines.reduce((total, line) => total + toNumber(line.quantitySold) * toNumber(line.sellingPrice), 0);
  const filteredCustomerSuggestions = customerSuggestions
    .filter((name) => name.toLowerCase().includes(customerName.trim().toLowerCase()))
    .filter((name) => name.toLowerCase() !== customerName.trim().toLowerCase())
    .slice(0, 6);

  function updateLine(index: number, patch: Partial<SaleLine>) {
    setLines((current) => current.map((line, currentIndex) => (currentIndex === index ? { ...line, ...patch } : line)));
  }

  function selectProduct(index: number, nextProductId: string) {
    const nextProduct = products.find((product) => product.id === nextProductId);
    updateLine(index, {
      productId: nextProductId,
      sellingPrice: String(nextProduct?.selling_price ?? ""),
    });
  }

  return (
    <form action={initialSale ? updateSale.bind(null, initialSale.id) : createSale} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 md:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label>Products in this order</Label>
              <p className="mt-1 text-sm text-[var(--muted)]">Add multiple products for one customer/order.</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  {
                    productId: defaultProduct?.id ?? "",
                    quantitySold: "1",
                    sellingPrice: String(defaultProduct?.selling_price ?? ""),
                  },
                ])
              }
            >
              <Plus size={16} />
              Add product
            </Button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => {
              const selectedProduct = products.find((product) => product.id === line.productId);
              const lineRevenue = toNumber(line.quantitySold) * toNumber(line.sellingPrice);

              return (
                <div key={index} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_110px_150px_auto]">
                    <div className="space-y-2">
                      <Label htmlFor={`sellable_product_id_${index}`}>Product</Label>
                      <select
                        id={`sellable_product_id_${index}`}
                        name="sellable_product_id"
                        required
                        value={line.productId}
                        onChange={(event) => selectProduct(index, event.target.value)}
                        className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                      >
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} - {product.available_packages.toFixed(2)} {product.package_label} available
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[var(--muted)]">
                        Available: {selectedProduct ? `${selectedProduct.available_packages.toFixed(2)} ${selectedProduct.package_label}` : "No product selected"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`quantity_sold_${index}`}>Qty</Label>
                      <Input
                        id={`quantity_sold_${index}`}
                        name="quantity_sold"
                        inputMode="decimal"
                        value={line.quantitySold}
                        onChange={(event) => updateLine(index, { quantitySold: event.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`selling_price_per_package_${index}`}>Price / {selectedProduct?.package_label ?? "pkg"}</Label>
                      <Input
                        id={`selling_price_per_package_${index}`}
                        name="selling_price_per_package"
                        inputMode="decimal"
                        value={line.sellingPrice}
                        onChange={(event) => updateLine(index, { sellingPrice: event.target.value })}
                        required
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-11 w-full gap-2 text-red-700 hover:bg-red-50 lg:w-auto"
                        disabled={lines.length <= 1}
                        onClick={() => setLines((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                      >
                        <Trash2 size={15} />
                        Remove
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                    <span className="text-[var(--muted)]">Line revenue </span>
                    <span className="font-semibold">{formatMoney(lineRevenue)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sale_date">Sale date</Label>
          <Input id="sale_date" name="sale_date" type="date" defaultValue={initialSale?.sale_date ?? today()} />
        </div>

        <div className="space-y-2">
          <Label>Order total</Label>
          <div className="flex h-11 items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 text-sm font-semibold text-[var(--foreground)]">
            {formatMoney(expectedRevenue)}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_method">Payment method</Label>
          <select
            id="payment_method"
            name="payment_method"
            defaultValue={initialSale?.payment_method ?? "cash"}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={initialSale?.status ?? "paid"}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="customer_name">Customer</Label>
          <div className="relative">
            <Input
              id="customer_name"
              name="customer_name"
              autoComplete="off"
              value={customerName}
              onBlur={() => {
                window.setTimeout(() => setShowCustomerSuggestions(false), 120);
              }}
              onChange={(event) => {
                setCustomerName(event.target.value);
                setShowCustomerSuggestions(true);
              }}
              onFocus={() => setShowCustomerSuggestions(true)}
              placeholder="Optional customer name"
            />
            {showCustomerSuggestions && filteredCustomerSuggestions.length > 0 ? (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                {filteredCustomerSuggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setCustomerName(name);
                      setShowCustomerSuggestions(false);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initialSale?.notes ?? ""}
            className="min-h-[88px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            placeholder="Example: pickup order, weekend bazaar, reseller batch."
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Link href="/sales" className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-alt)]">
          Cancel
        </Link>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
