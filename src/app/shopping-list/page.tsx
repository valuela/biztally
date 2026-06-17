import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buildReorderItems, groupReorderItemsByVendor } from "@/lib/inventory/reorder";
import { getCurrentBusiness } from "@/lib/inventory/utils";
import { ShoppingChecklist } from "./shopping-checklist";

export default async function ShoppingListPage() {
  const { supabase, user, businessId, businessName } = await getCurrentBusiness();
  const [{ data: items }, { data: batches }] = businessId
    ? await Promise.all([
        supabase
          .from("inventory_items")
          .select("id, name, brand_name, unit, default_package_size, low_stock_pack_threshold, low_stock_threshold")
          .eq("business_id", businessId)
          .order("name", { ascending: true }),
        supabase
          .from("inventory_batches")
          .select("inventory_item_id, supplier_name, purchase_price, sealed_packs_remaining, open_packs, quantity_remaining, expiration_date, received_at")
          .eq("business_id", businessId)
          .order("expiration_date", { ascending: true, nullsFirst: false }),
      ])
    : [{ data: [] }, { data: [] }];

  const reorderItems = buildReorderItems(items ?? [], batches ?? []);
  const groupedItems = groupReorderItemsByVendor(reorderItems);

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Shopping list"
        subtitle={`Phone-friendly buying list for ${businessName}.`}
        action={
          <Link href="/reorder" className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
            <ArrowLeft size={16} />
            Reorder list
          </Link>
        }
      />

      <section className="mt-6 max-w-3xl">
        {reorderItems.length > 0 ? (
          <ShoppingChecklist groupedItems={groupedItems} />
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-[var(--muted)]">No shopping items right now.</CardContent>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
