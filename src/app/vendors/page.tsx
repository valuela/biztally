import { Store } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatPhilippineDateTime, getCurrentBusiness } from "@/lib/inventory/utils";
import { VendorForm } from "./vendor-form";
import { VendorStatusButton } from "./vendor-status-button";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string | string[]; success?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { supabase, user, businessId, businessName } = await getCurrentBusiness();
  const error = Array.isArray(resolvedSearchParams?.error) ? resolvedSearchParams?.error[0] : resolvedSearchParams?.error;
  const success = Array.isArray(resolvedSearchParams?.success) ? resolvedSearchParams?.success[0] : resolvedSearchParams?.success;

  const { data: vendors } = businessId
    ? await supabase.from("vendors").select("id, name, contact_name, phone, email, notes, is_active, updated_at").eq("business_id", businessId).order("name", { ascending: true })
    : { data: [] };

  return (
    <AppShell userEmail={user.email}>
      <PageHeader title="Vendors" subtitle={`Manage stores and suppliers for ${businessName}.`} />

      <section className="mt-6 grid gap-4 lg:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add vendor</CardTitle>
            <p className="text-sm text-[var(--muted)]">Save supermarkets, baking suppliers, or direct suppliers.</p>
          </CardHeader>
          <CardContent>
            {error ? <FormAlert className="mb-4">{error}</FormAlert> : null}
            {success ? <FormAlert tone="info" className="mb-4">{success}</FormAlert> : null}
            <VendorForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Vendor list</CardTitle>
              <p className="text-sm text-[var(--muted)]">{vendors?.length ?? 0} saved vendors.</p>
            </div>
            <Store size={18} className="text-[var(--muted)]" />
          </CardHeader>
          <CardContent>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Contact</TH>
                    <TH>Status</TH>
                    <TH>Updated</TH>
                    <TH>Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {(vendors ?? []).map((vendor) => (
                    <TR key={vendor.id}>
                      <TD>{vendor.name}</TD>
                      <TD>{vendor.phone || vendor.email || vendor.contact_name || "Not set"}</TD>
                      <TD><Badge>{vendor.is_active ? "Active" : "Inactive"}</Badge></TD>
                      <TD>{formatPhilippineDateTime(vendor.updated_at)}</TD>
                      <TD><VendorStatusButton vendorId={vendor.id} isActive={vendor.is_active} /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <div className="space-y-3 md:hidden">
              {(vendors ?? []).map((vendor) => (
                <div key={vendor.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{vendor.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{vendor.phone || vendor.email || vendor.contact_name || "No contact yet"}</p>
                    </div>
                    <Badge>{vendor.is_active ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-[var(--muted)]">{formatPhilippineDateTime(vendor.updated_at)}</p>
                    <VendorStatusButton vendorId={vendor.id} isActive={vendor.is_active} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
