import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentBusiness, toNumber } from "@/lib/inventory/utils";
import { SalesForm } from "../../new/sales-form";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

type ProductRow = {
  id: string;
  name: string;
  recipe_id: string;
  recipe_variant_id: string | null;
  units_per_package: string | number;
  package_label: string;
  selling_price: string | number;
  recipe_variants: { is_active: boolean } | { is_active: boolean }[] | null;
  sellable_product_components?: ProductComponentRow[];
};

type ProductComponentRow = {
  sellable_product_id: string;
  recipe_id: string;
  recipe_variant_id: string | null;
  units_per_package: string | number;
  recipe_variants?: { is_active: boolean } | { is_active: boolean }[] | null;
};

type ProductionItemRow = {
  recipe_id: string;
  recipe_variant_id: string | null;
  quantity_produced: string | number;
};

type SaleItemRow = {
  sale_id: string;
  sellable_product_id: string;
  quantity_sold: string | number;
  units_sold: string | number;
  selling_price_per_package: string | number;
};

type CustomerRow = {
  customer_name: string | null;
};

export default async function EditSalePage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, user, businessId } = await getCurrentBusiness();
  if (!businessId) notFound();

  const [{ data: sale }, { data: products }, { data: productionRows }, { data: saleRows }, { data: customerRows }] = await Promise.all([
    supabase
      .from("sales")
      .select("id, sale_date, customer_name, payment_method, status, notes, sale_items(sale_id, sellable_product_id, quantity_sold, selling_price_per_package)")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase
      .from("sellable_products")
      .select("id, name, recipe_id, recipe_variant_id, units_per_package, package_label, selling_price, recipe_variants(is_active), sellable_product_components(sellable_product_id, recipe_id, recipe_variant_id, units_per_package, recipe_variants(is_active))")
      .eq("business_id", businessId)
      .order("name"),
    supabase.from("production_run_items").select("recipe_id, recipe_variant_id, quantity_produced").eq("business_id", businessId),
    supabase.from("sale_items").select("sale_id, sellable_product_id, quantity_sold, units_sold").eq("business_id", businessId),
    supabase
      .from("sales")
      .select("customer_name")
      .eq("business_id", businessId)
      .not("customer_name", "is", null)
      .order("customer_name", { ascending: true }),
  ]);

  if (!sale || !sale.sale_items?.[0]) notFound();
  const currentItem = sale.sale_items[0] as SaleItemRow;
  const productOptions = ((products ?? []) as ProductRow[]).filter((product) => {
    const variant = Array.isArray(product.recipe_variants) ? product.recipe_variants[0] : product.recipe_variants;
    const components = product.sellable_product_components ?? [];
    const activeComponents = components.every((component) => {
      const componentVariant = Array.isArray(component.recipe_variants) ? component.recipe_variants[0] : component.recipe_variants;
      return !component.recipe_variant_id || componentVariant?.is_active === true;
    });
    return product.id === currentItem.sellable_product_id || ((!product.recipe_variant_id || variant?.is_active === true) && activeComponents);
  }).map((product) => {
    const components =
      product.sellable_product_components && product.sellable_product_components.length > 0
        ? product.sellable_product_components
        : [{ sellable_product_id: product.id, recipe_id: product.recipe_id, recipe_variant_id: product.recipe_variant_id, units_per_package: product.units_per_package }];
    const availableByComponent = components.map((component) => {
      const producedUnits = ((productionRows ?? []) as ProductionItemRow[])
        .filter((item) => item.recipe_id === component.recipe_id && (item.recipe_variant_id ?? null) === (component.recipe_variant_id ?? null))
        .reduce((total, item) => total + toNumber(item.quantity_produced), 0);
      const soldUnits = ((saleRows ?? []) as SaleItemRow[]).reduce((total, saleItem) => {
        if (saleItem.sale_id === id) return total;
        const soldProduct = ((products ?? []) as ProductRow[]).find((item) => item.id === saleItem.sellable_product_id);
        if (!soldProduct) return total;
        const soldComponents =
          soldProduct.sellable_product_components && soldProduct.sellable_product_components.length > 0
            ? soldProduct.sellable_product_components
            : [{ sellable_product_id: soldProduct.id, recipe_id: soldProduct.recipe_id, recipe_variant_id: soldProduct.recipe_variant_id, units_per_package: soldProduct.units_per_package }];
        return (
          total +
          soldComponents
            .filter((soldComponent) => soldComponent.recipe_id === component.recipe_id && (soldComponent.recipe_variant_id ?? null) === (component.recipe_variant_id ?? null))
            .reduce((componentTotal, soldComponent) => componentTotal + toNumber(saleItem.quantity_sold) * toNumber(soldComponent.units_per_package), 0)
        );
      }, 0);
      const remainingUnits = Math.max(0, producedUnits - soldUnits);
      return toNumber(component.units_per_package) > 0 ? remainingUnits / toNumber(component.units_per_package) : 0;
    });

    return { ...product, available_packages: availableByComponent.length > 0 ? Math.min(...availableByComponent) : 0 };
  });
  const customerSuggestions = Array.from(
    new Set(((customerRows ?? []) as CustomerRow[]).map((row) => row.customer_name?.trim()).filter((name): name is string => Boolean(name)))
  );

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Edit sale"
        subtitle="Correct sale details while keeping production availability accurate."
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
            <p className="text-sm text-[var(--muted)]">Changing the product or quantity recalculates revenue, cost, profit, and availability.</p>
          </CardHeader>
          <CardContent>
            {query.error ? <div className="mb-4 rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{query.error}</div> : null}
            <SalesForm
              products={productOptions}
              customerSuggestions={customerSuggestions}
              initialSale={{
                id: sale.id,
                sale_date: sale.sale_date,
                customer_name: sale.customer_name,
                payment_method: sale.payment_method,
                status: sale.status,
                notes: sale.notes,
                items: (sale.sale_items as SaleItemRow[]).map((item) => ({
                  sellable_product_id: item.sellable_product_id,
                  quantity_sold: item.quantity_sold,
                  selling_price_per_package: item.selling_price_per_package,
                })),
              }}
            />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
