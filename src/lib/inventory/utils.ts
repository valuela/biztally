import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type InventoryType = "raw_material" | "packaging" | "finished_product" | "supply";
export type MovementType = "stock_in" | "stock_out" | "adjustment" | "waste" | "sale_usage";

export function parseNumber(value: FormDataEntryValue | string | number | null | undefined) {
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}
export function toNumber(value: string | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number.parseFloat(value) || 0;
}

export function formatStock(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

export function formatMoney(value: string | number | null | undefined, currency = "PHP") {
  const amount = toNumber(value);
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `P${amount.toFixed(2)}`;
  }
}

export function formatPhilippineDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatPhilippineDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const today = new Date();
  const target = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(target.getTime())) return null;
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((target.getTime() - todayMidnight.getTime()) / 86_400_000);
}

export async function getCurrentBusiness() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: ownedBusiness }] = await Promise.all([
    supabase.from("user_profiles").select("business_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("businesses").select("id, business_name, business_type, currency, owner_id").eq("owner_id", user.id).maybeSingle(),
  ]);

  const businessId = profile?.business_id ?? ownedBusiness?.id ?? null;

  return {
    supabase,
    user,
    businessId,
    business: ownedBusiness,
    currency: ownedBusiness?.currency ?? "PHP",
    businessName: ownedBusiness?.business_name ?? "BizTally business",
  };
}
