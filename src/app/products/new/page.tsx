import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentBusiness } from "@/lib/inventory/utils";
import { ProductForm } from "../product-form";

type SearchParams = Promise<{
  error?: string;
}>;

export default async function NewProductPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, user, businessId } = await getCurrentBusiness();

  const [{ data: recipes }, { data: variants }] = businessId
    ? await Promise.all([
        supabase.from("recipes").select("id, name").eq("business_id", businessId).eq("is_active", true).order("name"),
        supabase.from("recipe_variants").select("id, recipe_id, name").eq("business_id", businessId).eq("is_active", true).order("name"),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="New product"
        subtitle="Create a sellable package like Puto Tub - 6 pcs."
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
            <p className="text-sm text-[var(--muted)]">Products are how you sell recipes: tubs, boxes, singles, or bundles.</p>
          </CardHeader>
          <CardContent>
            {params.error ? (
              <div className="mb-4 rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {params.error}
              </div>
            ) : null}

            {(recipes ?? []).length > 0 ? (
              <ProductForm recipes={recipes ?? []} variants={variants ?? []} />
            ) : (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-5">
                <p className="font-semibold">Create a recipe first</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Products need a recipe so BizTally can calculate cost per package.</p>
                <Link
                  href="/recipes/new"
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
                >
                  New recipe
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
