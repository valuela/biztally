import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentBusiness } from "@/lib/inventory/utils";
import { PhysicalRecountForm } from "./physical-recount-form";

export default async function PhysicalRecountPage({
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

  const [{ data: item }, { data: batches }] = await Promise.all([
    supabase.from("inventory_items").select("id, name").eq("id", id).eq("business_id", businessId).maybeSingle(),
    supabase
      .from("inventory_batches")
      .select("id, batch_code, supplier_name, sealed_packs_remaining, open_packs, emptied_packs, package_size, package_unit, expiration_date, received_at")
      .eq("inventory_item_id", id)
      .eq("business_id", businessId)
      .order("expiration_date", { ascending: true, nullsFirst: false }),
  ]);

  if (!item) {
    notFound();
  }

  const error = Array.isArray(resolvedSearchParams?.error) ? resolvedSearchParams?.error[0] : resolvedSearchParams?.error;

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Physical recount"
        subtitle={`Count actual sealed, open, and empty packs for ${item.name}.`}
        action={
          <Link href={`/inventory/${id}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
            <ArrowLeft size={16} />
            Back to item
          </Link>
        }
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Shelf count</CardTitle>
          <p className="text-sm text-[var(--muted)]">
            Use this when the system and actual storage do not match. It recalculates stock from sealed + open packs.
          </p>
        </CardHeader>
        <CardContent>
          {error ? <FormAlert className="mb-4">{error}</FormAlert> : null}
          {batches && batches.length > 0 ? (
            <PhysicalRecountForm itemId={id} batches={batches} />
          ) : (
            <FormAlert tone="info">No batches exist for this item yet.</FormAlert>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
