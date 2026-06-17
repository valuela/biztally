import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { PageHeader } from "@/components/ui/page-header";
import { formatStock, getCurrentBusiness, toNumber } from "@/lib/inventory/utils";
import { UseStockForm } from "./use-stock-form";

export default async function UseStockPage({
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
    .select("id, name, unit, quantity_on_hand, default_package_size, default_package_unit")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!item) {
    notFound();
  }

  const error = Array.isArray(resolvedSearchParams?.error) ? resolvedSearchParams?.error[0] : resolvedSearchParams?.error;
  const normalizedItem = { ...item, quantity_on_hand: formatStock(toNumber(item.quantity_on_hand)) };

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Deduct stock"
        subtitle="Deduct only whole empty packs. Partial open-pack usage stays in stock until the pack is finished."
        action={
          <Link href={`/inventory/${item.id}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
            <ArrowLeft size={16} />
            Back to item
          </Link>
        }
      />
      <Card className="mt-6 max-w-3xl">
        <CardHeader>
          <CardTitle className="text-lg">Empty pack deduction</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <FormAlert className="mb-4">{error}</FormAlert> : null}
          <UseStockForm item={normalizedItem} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
