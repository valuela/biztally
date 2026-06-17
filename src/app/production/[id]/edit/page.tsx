import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentBusiness } from "@/lib/inventory/utils";
import { updateProductionRun } from "../../actions";
import { ProductionForm } from "../../new/production-form";

type SearchParams = Promise<{
  error?: string;
}>;

export default async function EditProductionPage({
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

  const [{ data: run }, { data: recipes }, { data: variants }] = await Promise.all([
    supabase
      .from("production_runs")
      .select("id, production_date, notes, production_run_items(id, recipe_id, recipe_variant_id, quantity_produced, selling_price_per_unit)")
      .eq("business_id", businessId)
      .eq("id", id)
      .maybeSingle(),
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
  ]);

  if (!run) notFound();

  const item = Array.isArray(run.production_run_items) ? run.production_run_items[0] : run.production_run_items;

  if (!item) notFound();

  const action = updateProductionRun.bind(null, id);

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Edit production"
        subtitle="Correct the production date, recipe, variant, quantity, or notes."
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
            <p className="text-sm text-[var(--muted)]">Saving will recalculate this production snapshot using current recipe costs.</p>
          </CardHeader>
          <CardContent>
            {query.error ? (
              <div className="mb-4 rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {query.error}
              </div>
            ) : null}
            <ProductionForm
              recipes={recipes ?? []}
              variants={variants ?? []}
              action={action}
              submitLabel="Save changes"
              cancelHref="/production"
              initialValue={{
                recipe_id: item.recipe_id,
                recipe_variant_id: item.recipe_variant_id,
                production_date: run.production_date,
                quantity_produced: item.quantity_produced,
                selling_price_per_unit: item.selling_price_per_unit,
                notes: run.notes,
              }}
            />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
