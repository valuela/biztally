import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Barcode,
  Boxes,
  Package2,
  Sparkles,
  Wheat,
  Layers3,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { createInventoryItem } from "./actions";

const inventoryTypeOptions = [
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

export default async function NewInventoryItemPage({
  searchParams,
}: {
  searchParams?: { error?: string | string[] };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: ownedBusiness }] = await Promise.all([
    supabase.from("user_profiles").select("business_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("businesses").select("id, business_name, currency").eq("owner_id", user.id).maybeSingle(),
  ]);

  const businessName = ownedBusiness?.business_name ?? "BizTally business";
  const businessCurrency = ownedBusiness?.currency ?? "PHP";
  const error = Array.isArray(searchParams?.error)
    ? searchParams?.error[0]
    : searchParams?.error;

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Add item"
        subtitle={`Create a new inventory record for ${businessName}.`}
        action={
          <Link
            href="/inventory"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
          >
            <ArrowLeft size={16} />
            Back to inventory
          </Link>
        }
      />

      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_360px]">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Item details</CardTitle>
            <p className="text-sm text-[var(--muted)]">
              Enter the core item data first. You can wire barcode scanning into the barcode field next.
            </p>
          </CardHeader>

          <CardContent>
            {error ? <FormAlert className="mb-4">{error}</FormAlert> : null}

            {!profile?.business_id ? (
              <FormAlert className="mb-4" tone="info">
                This account is not linked to a business yet. The form will submit, but inventory writes may fail until the business link exists.
              </FormAlert>
            ) : null}

              <form action={createInventoryItem} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name">Item name</Label>
                  <Input id="name" name="name" placeholder="Revel Bars (24pc)" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand_name">Brand name</Label>
                  <Input id="brand_name" name="brand_name" placeholder="Magnolia" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier_name">Bought from</Label>
                  <Input id="supplier_name" name="supplier_name" placeholder="S&R, Puregold, local supplier" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="image_file">Item image</Label>
                  <Input
                    id="image_file"
                    name="image_file"
                    type="file"
                    accept="image/*"
                    className="h-auto px-3 py-2 file:mr-4 file:rounded-full file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[var(--primary-hover)]"
                  />
                  <p className="text-xs text-[var(--muted)]">
                    Upload a product or ingredient image. We store it in Supabase Storage.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <div className="relative">
                    <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                    <Input id="barcode" name="barcode" className="pl-9" placeholder="1234567890123" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inventory_type">Item type</Label>
                  <select
                    id="inventory_type"
                    name="inventory_type"
                    required
                    className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select type
                    </option>
                    {inventoryTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input id="unit" name="unit" placeholder="box, pack, kg, pc" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity_on_hand">Starting quantity</Label>
                  <Input id="quantity_on_hand" name="quantity_on_hand" type="number" step="0.01" min="0" defaultValue="0" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost_per_unit">Cost per unit ({businessCurrency})</Label>
                  <Input id="cost_per_unit" name="cost_per_unit" type="number" step="0.01" min="0" defaultValue="0" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purchase_price">Purchase price ({businessCurrency})</Label>
                  <Input id="purchase_price" name="purchase_price" type="number" step="0.01" min="0" placeholder="Total paid for this purchase" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="low_stock_threshold">Low stock threshold</Label>
                  <Input id="low_stock_threshold" name="low_stock_threshold" type="number" step="0.01" min="0" placeholder="Optional" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiration_date">Expiration date</Label>
                  <Input id="expiration_date" name="expiration_date" type="date" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    className="min-h-[110px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    placeholder="Supplier details, recipe notes, or handling instructions"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Link
                  href="/inventory"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
                >
                  Cancel
                </Link>
                <Button type="submit" className="gap-2">
                  <Sparkles size={16} />
                  Save item
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What happens on save</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted)]">
              <p>1. The item is inserted into `inventory_items`.</p>
              <p>2. If you enter a starting quantity, a `stock_in` movement is recorded.</p>
              <p>3. You return to Inventory and the list refreshes from Supabase.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Barcode-ready flow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {inventoryTypeOptions.map((option) => {
                const Icon = option.icon;

                return (
                  <div key={option.value} className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)]">{option.label}</p>
                      <p className="text-sm text-[var(--muted)]">{option.description}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
