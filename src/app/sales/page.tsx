import Link from "next/link";
import { CalendarDays, ChevronDown, Plus, ReceiptText, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatMoney, formatPhilippineDate, formatStock, getCurrentBusiness, toNumber } from "@/lib/inventory/utils";

type SaleRow = {
  id: string;
  sale_date: string;
  customer_name: string | null;
  payment_method: string;
  status: string;
  notes: string | null;
  total_revenue: string | number;
  total_cost: string | number;
  total_profit: string | number;
  sale_items: {
    id: string;
    product_name: string;
    quantity_sold: string | number;
    package_label: string;
    units_sold: string | number;
    selling_price_per_package: string | number;
    cost_per_package: string | number;
    total_revenue: string | number;
    total_profit: string | number;
  }[];
};

type SearchParams = Promise<{
  from?: string;
  to?: string;
}>;

function paymentLabel(value: string) {
  switch (value) {
    case "gcash":
      return "GCash";
    case "bank_transfer":
      return "Bank transfer";
    case "cash":
      return "Cash";
    default:
      return value || "Other";
  }
}

function isDateInput(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, user, businessId, currency } = await getCurrentBusiness();
  const fromDate = isDateInput(params.from) ? params.from : "";
  const toDate = isDateInput(params.to) ? params.to : "";

  let data: unknown[] | null = [];
  let error: { message: string } | null = null;

  if (businessId) {
    let query = supabase
        .from("sales")
        .select(
          "id, sale_date, customer_name, payment_method, status, notes, total_revenue, total_cost, total_profit, sale_items(id, product_name, quantity_sold, package_label, units_sold, selling_price_per_package, cost_per_package, total_revenue, total_profit)"
        )
      .eq("business_id", businessId);

    if (fromDate) query = query.gte("sale_date", fromDate);
    if (toDate) query = query.lte("sale_date", toDate);

    const result = await query.order("sale_date", { ascending: false }).order("created_at", { ascending: false });
    data = result.data;
    error = result.error;
  }

  const sales = (data ?? []) as SaleRow[];
  const totalRevenue = sales.reduce((total, sale) => total + toNumber(sale.total_revenue), 0);
  const totalProfit = sales.reduce((total, sale) => total + toNumber(sale.total_profit), 0);
  const totalPackages = sales.reduce(
    (total, sale) => total + sale.sale_items.reduce((lineTotal, item) => lineTotal + toNumber(item.quantity_sold), 0),
    0
  );
  const salesByDate = sales.reduce<Record<string, SaleRow[]>>((grouped, sale) => {
    grouped[sale.sale_date] = grouped[sale.sale_date] ?? [];
    grouped[sale.sale_date].push(sale);
    return grouped;
  }, {});
  const groupedDates = Object.keys(salesByDate).sort((a, b) => b.localeCompare(a));

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Sales"
        subtitle="Record product sales and see profit from produced inventory."
        action={
          <Link
            href="/sales/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
          >
            <Plus size={16} />
            Record sale
          </Link>
        }
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Revenue" value={formatMoney(totalRevenue, currency)} meta="Recorded sales" />
        <StatCard label="Profit" value={formatMoney(totalProfit, currency)} meta="After product cost" />
        <StatCard label="Packages sold" value={formatStock(totalPackages)} meta="All products" />
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Sales history</CardTitle>
                <p className="mt-1 text-sm text-[var(--muted)]">Grouped by sale date. Each sale consumes available packages from production logically.</p>
              </div>
              <form action="/sales" className="grid w-full items-end gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_auto_auto]">
                <div className="min-w-0 space-y-1">
                  <label htmlFor="from" className="block text-xs text-[var(--muted)]">From</label>
                  <input
                    id="from"
                    name="from"
                    type="date"
                    defaultValue={fromDate}
                    className="block h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <label htmlFor="to" className="block text-xs text-[var(--muted)]">To</label>
                  <input
                    id="to"
                    name="to"
                    type="date"
                    defaultValue={toDate}
                    className="block h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
                >
                  <CalendarDays size={15} />
                  Filter
                </button>
                <Link
                  href="/sales"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-alt)]"
                >
                  Clear
                </Link>
              </form>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Could not load sales: {error.message}
              </div>
            ) : groupedDates.length > 0 ? (
              <div className="space-y-5">
                {groupedDates.map((date, dateIndex) => {
                  const daySales = salesByDate[date];
                  const dayRevenue = daySales.reduce((total, sale) => total + toNumber(sale.total_revenue), 0);
                  const dayProfit = daySales.reduce((total, sale) => total + toNumber(sale.total_profit), 0);

                  return (
                    <details
                      key={date}
                      open={dateIndex === 0}
                      className="group overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"
                    >
                      <summary className="flex cursor-pointer list-none flex-col gap-2 p-3 marker:content-none hover:bg-[var(--surface-alt)] sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
                        <div>
                          <p className="font-semibold">{formatPhilippineDate(date)}</p>
                          <p className="text-xs text-[var(--muted)]">{daySales.length} sale{daySales.length === 1 ? "" : "s"}</p>
                        </div>
                        <div className="flex items-center justify-between gap-4 sm:justify-end">
                          <div className="text-sm text-[var(--muted)]">
                            Revenue <span className="font-semibold text-[var(--foreground)]">{formatMoney(dayRevenue, currency)}</span> - Profit{" "}
                            <span className={`font-semibold ${dayProfit < 0 ? "text-red-600" : "text-[var(--foreground)]"}`}>{formatMoney(dayProfit, currency)}</span>
                          </div>
                          <ChevronDown size={17} className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" />
                        </div>
                      </summary>

                      <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                        <div className="hidden grid-cols-[minmax(0,1.3fr)_110px_110px_100px_120px_auto] items-center gap-3 bg-[var(--surface-alt)] px-3 py-2 text-xs font-medium text-[var(--muted)] md:grid">
                          <span>Product</span>
                          <span>Revenue</span>
                          <span>Profit</span>
                          <span>Margin</span>
                          <span>Price</span>
                          <span className="text-right">Status</span>
                        </div>
                        {daySales.map((sale) => {
                          const item = sale.sale_items[0];
                          const margin = toNumber(sale.total_revenue) > 0 ? (toNumber(sale.total_profit) / toNumber(sale.total_revenue)) * 100 : 0;

                          return (
                            <div key={sale.id} className="grid gap-3 p-3 md:grid-cols-[minmax(0,1.3fr)_110px_110px_100px_120px_auto] md:items-center">
                              <div className="flex min-w-0 gap-3">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                                  <ReceiptText size={16} />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-[var(--foreground)]">{item?.product_name ?? "Sale"}</p>
                                  <p className="mt-1 text-xs text-[var(--muted)]">
                                    {item ? `${formatStock(toNumber(item.quantity_sold))} ${item.package_label} - ${formatStock(toNumber(item.units_sold))} pcs` : "No item"} -{" "}
                                    {sale.customer_name ?? "Walk-in"} - {paymentLabel(sale.payment_method)}
                                  </p>
                                  {sale.notes ? <p className="mt-1 truncate text-xs text-[var(--muted)]">{sale.notes}</p> : null}
                                </div>
                              </div>

                              <div>
                                <p className="text-xs text-[var(--muted)] md:hidden">Revenue</p>
                                <p className="font-semibold">{formatMoney(sale.total_revenue, currency)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-[var(--muted)] md:hidden">Profit</p>
                                <p className={`font-semibold ${toNumber(sale.total_profit) < 0 ? "text-red-600" : ""}`}>{formatMoney(sale.total_profit, currency)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-[var(--muted)] md:hidden">Margin</p>
                                <p className="font-semibold">{margin.toFixed(1)}%</p>
                              </div>
                              <div>
                                <p className="text-xs text-[var(--muted)] md:hidden">Price</p>
                                <p className="text-sm text-[var(--muted)]">{item ? formatMoney(item.selling_price_per_package, currency) : formatMoney(0, currency)} / pkg</p>
                              </div>
                              <div className="flex justify-start md:justify-end">
                                <Badge className={sale.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-[var(--surface-alt)] text-[var(--muted)]"}>
                                  {sale.status}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-6">
                <p className="font-semibold">No sales yet</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Record a sale after creating products and production runs.</p>
                <Link
                  href="/sales/new"
                  className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
                >
                  <TrendingUp size={16} />
                  Record sale
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
