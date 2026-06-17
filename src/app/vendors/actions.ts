"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/inventory/utils";

function fail(message: string): never {
  redirect(`/vendors?error=${encodeURIComponent(message)}`);
}

export async function createVendor(formData: FormData) {
  const { supabase, businessId } = await getCurrentBusiness();

  if (!businessId) {
    fail("No business is linked to this account yet.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) {
    fail("Vendor name is required.");
  }

  const { error } = await supabase.from("vendors").insert({
    business_id: businessId,
    name,
    contact_name: contactName || null,
    phone: phone || null,
    email: email || null,
    notes: notes || null,
    is_active: true,
  });

  if (error) {
    fail(error.message || "We could not save this vendor.");
  }

  revalidatePath("/vendors");
  redirect(`/vendors?success=${encodeURIComponent(`${name} was added.`)}`);
}

export async function toggleVendorStatus(vendorId: string, isActive: boolean) {
  const { supabase, businessId } = await getCurrentBusiness();

  if (!businessId) {
    fail("No business is linked to this account yet.");
  }

  const { error } = await supabase
    .from("vendors")
    .update({ is_active: !isActive, updated_at: new Date().toISOString() })
    .eq("id", vendorId)
    .eq("business_id", businessId);

  if (error) {
    fail(error.message || "We could not update this vendor.");
  }

  revalidatePath("/vendors");
  redirect(`/vendors?success=${encodeURIComponent("Vendor updated.")}`);
}
