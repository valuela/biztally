import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentBusiness } from "@/lib/inventory/utils";
import { BatchCorrectionForm } from "./batch-correction-form";

export default async function EditBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; batchId: string }>;
  searchParams?: Promise<{ error?: string | string[] }>;
}) {
  const [{ id, batchId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const { supabase, user, businessId } = await getCurrentBusiness();

  if (!businessId) {
    notFound();
  }

  const { data: batch } = await supabase
    .from("inventory_batches")
    .select("id, inventory_item_id, batch_code, supplier_name, purchase_price, cost_per_unit, packages_received, sealed_packs_remaining, open_packs, emptied_packs, package_size, expiration_date, correction_note")
    .eq("id", batchId)
    .eq("inventory_item_id", id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!batch) {
    notFound();
  }

  const error = Array.isArray(resolvedSearchParams?.error) ? resolvedSearchParams?.error[0] : resolvedSearchParams?.error;

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Correct batch"
        subtitle="Fix pack counts, expiry, vendor, or purchase cost after a recount or mistake."
        action={
          <Link href={`/inventory/${id}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
            <ArrowLeft size={16} />
            Back to item
          </Link>
        }
      />
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Batch correction</CardTitle>
          <p className="text-sm text-[var(--muted)]">This recalculates remaining stock from sealed + open packs.</p>
        </CardHeader>
        <CardContent>
          {error ? <FormAlert className="mb-4">{error}</FormAlert> : null}
          <BatchCorrectionForm batch={batch} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
