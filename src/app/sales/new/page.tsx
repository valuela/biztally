import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentBusiness, toNumber } from "@/lib/inventory/utils";
import { SalesForm } from "./sales-form";

type SearchParams = Promise<{
  error?: string;
}>;

type ProductRow = {
  id: string;
  name: string;
  recipe_id: string;
  recipe_variant_id: string | null;
  units_per_package: string | number;
  package_label: string;
  selling_price: string | number;
};

type ProductionItemRow = {
  recipe_id: string;
  recipe_variant_id: string | null;
  quantity_produced: string | number;
};

type SaleItemRow = {
  sellable_product_id: string;
  quantity_sold: string | number;
};

export default async function NewSalePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, user, businessId } = await getCurrentBusiness();

  const [{ data: products }, { data: productionRows }, { data: saleRows }] = businessId
    ? await Promise.all([
        supabase
          .from("sellable_products")
          .select("id, name, recipe_id, recipe_variant_id, units_per_package, package_label, selling_price")
          .eq("business_id", businessId)
          .eq("is_active", true)
          .order("name"),
        supabase.from("production_run_items").select("recipe_id, recipe_variant_id, quantity_produced").eq("business_id", businessId),
        supabase.from("sale_items").select("sellable_product_id, quantity_sold").eq("business_id", businessId),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const productOptions = ((products ?? []) as ProductRow[]).map((product) => {
    const producedUnits = ((productionRows ?? []) as ProductionItemRow[])
      .filter((item) => item.recipe_id === product.recipe_id && (item.recipe_variant_id ?? null) === (product.recipe_variant_id ?? null))
      .reduce((total, item) => total + toNumber(item.quantity_produced), 0);
    const producedPackages = toNumber(product.units_per_package) > 0 ? producedUnits / toNumber(product.units_per_package) : 0;
    const soldPackages = ((saleRows ?? []) as SaleItemRow[])
      .filter((item) => item.sellable_product_id === product.id)
      .reduce((total, item) => total + toNumber(item.quantity_sold), 0);

    return {
      ...product,
      available_packages: Math.max(0, producedPackages - soldPackages),
    };
  });

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Record sale"
        subtitle="Sell products from available production and snapshot profit."
        action={
          <Link
            href="/sales"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-alt)]"
          >
            <ArrowLeft size={16} />
            Back to sales
          </Link>
        }
      />

      <section className="mt-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Sale details</CardTitle>
            <p className="text-sm text-[var(--muted)]">Quantity sold cannot exceed packages available from production.</p>
          </CardHeader>
          <CardContent>
            {params.error ? (
              <div className="mb-4 rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {params.error}
              </div>
            ) : null}

            {productOptions.length > 0 ? (
              <SalesForm products={productOptions} />
            ) : (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-5">
                <p className="font-semibold">Create a product first</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Sales need sellable products like 6-piece tubs or boxes.</p>
                <Link
                  href="/products/new"
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
                >
                  New product
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
