import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentBusiness } from "@/lib/inventory/utils";
import { updateSellableProduct } from "../../actions";
import { ProductForm } from "../../product-form";

type SearchParams = Promise<{
  error?: string;
}>;

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user, businessId } = await getCurrentBusiness();

  if (!businessId) notFound();

  const [{ data: product }, { data: recipes }, { data: variants }] = await Promise.all([
    supabase
      .from("sellable_products")
      .select("id, name, sku, recipe_id, recipe_variant_id, units_per_package, package_label, selling_price, packaging_cost, notes")
      .eq("business_id", businessId)
      .eq("id", id)
      .maybeSingle(),
    supabase.from("recipes").select("id, name").eq("business_id", businessId).eq("is_active", true).order("name"),
    supabase.from("recipe_variants").select("id, recipe_id, name").eq("business_id", businessId).eq("is_active", true).order("name"),
  ]);

  if (!product) notFound();

  const action = updateSellableProduct.bind(null, id);

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Edit product"
        subtitle="Update the sellable package, price, or linked recipe."
        action={
          <Link
            href="/products"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-alt)]"
          >
            <ArrowLeft size={16} />
            Back to products
          </Link>
        }
      />

      <section className="mt-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Product setup</CardTitle>
            <p className="text-sm text-[var(--muted)]">Changes update future product costing. Existing production history is not changed.</p>
          </CardHeader>
          <CardContent>
            {query.error ? (
              <div className="mb-4 rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {query.error}
              </div>
            ) : null}
            <ProductForm recipes={recipes ?? []} variants={variants ?? []} initialValue={product} action={action} />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
