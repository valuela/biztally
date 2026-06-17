import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentBusiness } from "@/lib/inventory/utils";
import { EditInventoryItemForm } from "./edit-inventory-item-form";

export default async function EditInventoryItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string | string[] }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const { supabase, user, businessId } = await getCurrentBusiness();

  if (!businessId) {
    notFound();
  }

  const { data: item } = await supabase
    .from("inventory_items")
    .select("id, name, brand_name, barcode, inventory_type, unit, default_package_size, low_stock_threshold, low_stock_pack_threshold, recipe_density_grams_per_cup, recipe_measurement_note, notes")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!item) {
    notFound();
  }

  const error = Array.isArray(resolvedSearchParams?.error) ? resolvedSearchParams?.error[0] : resolvedSearchParams?.error;

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Edit item"
        subtitle={`Update package, barcode, and reorder settings for ${item.name}.`}
        action={
          <Link href={`/inventory/${item.id}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
            <ArrowLeft size={16} />
            Back to item
          </Link>
        }
      />
      <Card className="mt-6 max-w-4xl">
        <CardHeader>
          <CardTitle className="text-lg">Item details</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <FormAlert className="mb-4">{error}</FormAlert> : null}
          <EditInventoryItemForm item={item} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
