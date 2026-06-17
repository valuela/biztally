import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentBusiness } from "@/lib/inventory/utils";
import { RecipeForm } from "../recipe-form";

export default async function NewRecipePage() {
  const { supabase, user, businessId, currency } = await getCurrentBusiness();

  const { data: inventoryItems } = businessId
    ? await supabase
        .from("inventory_items")
        .select("id, name, brand_name, unit, cost_per_unit, inventory_type, recipe_density_grams_per_cup, recipe_measurement_note")
        .eq("business_id", businessId)
        .in("inventory_type", ["raw_material", "packaging", "supply"])
        .order("name", { ascending: true })
    : { data: [] };

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="New recipe"
        subtitle="Build a product recipe and calculate cost, profit, and margin."
        action={
          <Link
            href="/recipes"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-alt)]"
          >
            <ArrowLeft size={16} />
            Back to recipes
          </Link>
        }
      />

      {!businessId ? (
        <Card className="mt-6 border-dashed bg-[var(--surface-alt)] shadow-none">
          <CardContent className="p-6">
            <p className="text-base font-semibold">Business link missing</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Link this account to a business before creating recipes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6">
          <RecipeForm inventoryItems={inventoryItems ?? []} currency={currency} />
        </div>
      )}
    </AppShell>
  );
}
