"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSale } from "../actions";

type ProductOption = {
  id: string;
  name: string;
  package_label: string;
  selling_price: string | number;
  available_packages: number;
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 gap-2" disabled={pending}>
      <Save size={16} />
      {pending ? "Recording..." : "Record sale"}
    </Button>
  );
}

export function SalesForm({ products }: { products: ProductOption[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const selectedProduct = products.find((product) => product.id === productId);
  const [quantitySold, setQuantitySold] = useState("1");
  const [sellingPrice, setSellingPrice] = useState(String(selectedProduct?.selling_price ?? ""));
  const expectedRevenue = toNumber(quantitySold) * toNumber(sellingPrice);

  function selectProduct(nextProductId: string) {
    const nextProduct = products.find((product) => product.id === nextProductId);
    setProductId(nextProductId);
    setSellingPrice(String(nextProduct?.selling_price ?? ""));
  }

  return (
    <form action={createSale} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="sellable_product_id">Product</Label>
          <select
            id="sellable_product_id"
            name="sellable_product_id"
            required
            value={productId}
            onChange={(event) => selectProduct(event.target.value)}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} - {product.available_packages.toFixed(2)} {product.package_label} available
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sale_date">Sale date</Label>
          <Input id="sale_date" name="sale_date" type="date" defaultValue={today()} />
        </div>

        <div className="space-y-2">
          <Label>Available</Label>
          <div className="flex h-11 items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 text-sm text-[var(--muted)]">
            {selectedProduct ? `${selectedProduct.available_packages.toFixed(2)} ${selectedProduct.package_label}` : "No product selected"}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity_sold">Quantity sold</Label>
          <Input id="quantity_sold" name="quantity_sold" inputMode="decimal" value={quantitySold} onChange={(event) => setQuantitySold(event.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="selling_price_per_package">Selling price / {selectedProduct?.package_label ?? "package"}</Label>
          <Input
            id="selling_price_per_package"
            name="selling_price_per_package"
            inputMode="decimal"
            value={sellingPrice}
            onChange={(event) => setSellingPrice(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Expected revenue</Label>
          <div className="flex h-11 items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 text-sm font-semibold text-[var(--foreground)]">
            {formatMoney(expectedRevenue)}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_method">Payment method</Label>
          <select
            id="payment_method"
            name="payment_method"
            defaultValue="cash"
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
            defaultValue="paid"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="customer_name">Customer</Label>
          <Input id="customer_name" name="customer_name" placeholder="Optional customer name" />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="min-h-[88px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            placeholder="Example: pickup order, weekend bazaar, reseller batch."
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Link href="/sales" className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-alt)]">
          Cancel
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}
