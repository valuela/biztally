import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentBusiness } from "@/lib/inventory/utils";
import { ProductionForm } from "./production-form";

type SearchParams = Promise<{
  recipeId?: string;
  error?: string;
}>;

export default async function NewProductionPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, user, businessId } = await getCurrentBusiness();

  const [{ data: recipes }, { data: variants }] = businessId
    ? await Promise.all([
        supabase
          .from("recipes")
          .select("id, name, batch_yield, yield_unit, selling_price")
          .eq("business_id", businessId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("recipe_variants")
          .select("id, recipe_id, name, selling_price")
          .eq("business_id", businessId)
          .eq("is_active", true)
          .order("name"),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Record production"
        subtitle="Save what you made and snapshot the recipe cost for this batch."
        action={
          <Link
            href="/production"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-alt)]"
          >
            <ArrowLeft size={16} />
            Back to production
          </Link>
        }
      />

      <section className="mt-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Production details</CardTitle>
            <p className="text-sm text-[var(--muted)]">This records history only. Inventory deduction will come after stock checks.</p>
          </CardHeader>
          <CardContent>
            {params.error ? (
              <div className="mb-4 rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {params.error}
              </div>
            ) : null}

            {(recipes ?? []).length > 0 ? (
              <ProductionForm recipes={recipes ?? []} variants={variants ?? []} defaultRecipeId={params.recipeId} />
            ) : (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-5">
                <p className="font-semibold">Create a recipe first</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Production history needs a recipe so BizTally can snapshot cost and profit.</p>
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
