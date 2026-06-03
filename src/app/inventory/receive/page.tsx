import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { ReceiveStockForm } from "./receive-stock-form";

type InventoryOption = {
  id: string;
  name: string;
  brand_name: string | null;
  unit: string;
  barcode: string | null;
  default_package_size: string | number | null;
  default_package_unit: string | null;
};

type VendorOption = {
  id: string;
  name: string;
};

export default async function ReceiveStockPage({
  searchParams,
}: {
  searchParams?: { error?: string | string[] };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: ownedBusiness }] = await Promise.all([
    supabase.from("user_profiles").select("business_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("businesses").select("id, business_name, currency").eq("owner_id", user.id).maybeSingle(),
  ]);

  const businessId = profile?.business_id ?? ownedBusiness?.id ?? null;
  const businessName = ownedBusiness?.business_name ?? "BizTally business";
  const businessCurrency = ownedBusiness?.currency ?? "PHP";
  let items: InventoryOption[] = [];
  let vendors: VendorOption[] = [];

  if (businessId) {
    const [{ data: itemRows }, { data: vendorRows }] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, name, brand_name, unit, barcode, default_package_size, default_package_unit")
        .eq("business_id", businessId)
        .order("name", { ascending: true }),
      supabase
        .from("vendors")
        .select("id, name")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

    items = itemRows ?? [];
    vendors = vendorRows ?? [];
  }

  const error = Array.isArray(searchParams?.error) ? searchParams?.error[0] : searchParams?.error;

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Receive stock"
        subtitle={`Add a new stock batch for an existing item in ${businessName}.`}
        action={
          <Link
            href="/inventory"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
          >
            <ArrowLeft size={16} />
            Back to inventory
          </Link>
        }
      />

      <section className="mt-6 max-w-4xl">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Stock batch</CardTitle>
            <p className="text-sm text-[var(--muted)]">
              Use this when the item already exists and only the quantity, purchase price, or expiry date changed.
            </p>
          </CardHeader>
          <CardContent>
            {error ? <FormAlert className="mb-4">{error}</FormAlert> : null}
            {items.length > 0 ? (
              <ReceiveStockForm currency={businessCurrency} items={items} vendors={vendors} />
            ) : (
              <FormAlert tone="info">Add an inventory item first before receiving additional stock.</FormAlert>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
