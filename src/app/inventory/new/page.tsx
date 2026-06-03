import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { InventoryItemForm } from "./inventory-item-form";
import { inventoryTypeOptions } from "./inventory-options";

type VendorOption = {
  id: string;
  name: string;
};

export default async function NewInventoryItemPage({
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
  let vendors: VendorOption[] = [];

  if (businessId) {
    const { data: vendorRows } = await supabase
      .from("vendors")
      .select("id, name")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    vendors = vendorRows ?? [];
  }

  const businessName = ownedBusiness?.business_name ?? "BizTally business";
  const businessCurrency = ownedBusiness?.currency ?? "PHP";
  const error = Array.isArray(searchParams?.error)
    ? searchParams?.error[0]
    : searchParams?.error;

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Add item"
        subtitle={`Create a new inventory record for ${businessName}.`}
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

      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_360px]">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Item details</CardTitle>
            <p className="text-sm text-[var(--muted)]">
              Create the item identity, then record the first stock batch for receiving and expiry tracking.
            </p>
          </CardHeader>

          <CardContent>
            {error ? <FormAlert className="mb-4">{error}</FormAlert> : null}

            {!profile?.business_id ? (
              <FormAlert className="mb-4" tone="info">
                This account is not linked to a business yet. The form will submit, but inventory writes may fail until the business link exists.
              </FormAlert>
            ) : null}

            <InventoryItemForm currency={businessCurrency} vendors={vendors} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What happens on save</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted)]">
              <p>1. The item is inserted into `inventory_items`.</p>
              <p>2. If quantity is entered, the first stock batch is recorded with supplier, price, and expiry.</p>
              <p>3. You return to Inventory and the list refreshes from Supabase.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Barcode-ready flow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {inventoryTypeOptions.map((option) => {
                const Icon = option.icon;

                return (
                  <div key={option.value} className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)]">{option.label}</p>
                      <p className="text-sm text-[var(--muted)]">{option.description}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
