import Link from "next/link";
import { Factory, Pencil, Plus, ReceiptText, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatMoney, formatPhilippineDate, formatStock, getCurrentBusiness, toNumber } from "@/lib/inventory/utils";
import { DeleteProductionButton } from "./delete-production-button";

type ProductionRun = {
  id: string;
  production_date: string;
  status: string;
  notes: string | null;
  total_cost: string | number;
  total_revenue: string | number;
  total_profit: string | number;
  created_at: string;
  production_run_items: {
    id: string;
    recipe_name: string;
    variant_name: string | null;
    quantity_produced: string | number;
    yield_unit: string;
    cost_per_unit: string | number;
    selling_price_per_unit: string | number;
    total_profit: string | number;
  }[];
};

export default async function ProductionPage() {
  const { supabase, user, businessId, currency } = await getCurrentBusiness();

  const { data, error } = businessId
    ? await supabase
        .from("production_runs")
        .select(
          "id, production_date, status, notes, total_cost, total_revenue, total_profit, created_at, production_run_items(id, recipe_name, variant_name, quantity_produced, yield_unit, cost_per_unit, selling_price_per_unit, total_profit)"
        )
        .eq("business_id", businessId)
        .order("production_date", { ascending: false })
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  const runs = (data ?? []) as ProductionRun[];
  const totalProduced = runs.reduce(
    (total, run) => total + run.production_run_items.reduce((lineTotal, item) => lineTotal + toNumber(item.quantity_produced), 0),
    0
  );
  const totalProfit = runs.reduce((total, run) => total + toNumber(run.total_profit), 0);
  const totalRevenue = runs.reduce((total, run) => total + toNumber(run.total_revenue), 0);

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Production"
        subtitle="Track batches made and keep a cost snapshot for each run."
        action={
          <Link
            href="/production/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
          >
            <Plus size={16} />
            Record production
          </Link>
        }
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Production runs" value={runs.length.toString()} meta="Recorded batches" />
        <StatCard label="Units produced" value={formatStock(totalProduced)} meta="All recorded runs" />
        <StatCard label="Estimated profit" value={formatMoney(totalProfit, currency)} meta={`${formatMoney(totalRevenue, currency)} revenue`} />
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <p className="text-sm text-[var(--muted)]">These are cost snapshots. Inventory deduction will be connected after stock-availability checks.</p>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Could not load production history: {error.message}
              </div>
            ) : runs.length > 0 ? (
              <div className="space-y-3">
                {runs.map((run) => {
                  const item = run.production_run_items[0];
                  return (
                    <div key={run.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 gap-3">
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                            <Factory size={18} />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--foreground)]">
                              {item?.recipe_name ?? "Production run"}
                              {item?.variant_name ? ` - ${item.variant_name}` : ""}
                            </p>
                            <p className="mt-1 text-sm text-[var(--muted)]">
                              {formatPhilippineDate(run.production_date)} - {item ? `${formatStock(toNumber(item.quantity_produced))} ${item.yield_unit}` : "No item lines"}
                            </p>
                            {run.notes ? <p className="mt-2 text-sm text-[var(--muted)]">{run.notes}</p> : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-emerald-50 text-emerald-700">{run.status}</Badge>
                          <Link
                            href={`/production/${run.id}/edit`}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-3 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
                          >
                            <Pencil size={15} />
                            Edit
                          </Link>
                          <DeleteProductionButton runId={run.id} />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-5">
                        <div>
                          <p className="text-xs text-[var(--muted)]">Cost</p>
                          <p className="mt-1 font-semibold">{formatMoney(run.total_cost, currency)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--muted)]">Revenue</p>
                          <p className="mt-1 font-semibold">{formatMoney(run.total_revenue, currency)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--muted)]">Profit</p>
                          <p className={`mt-1 font-semibold ${toNumber(run.total_profit) < 0 ? "text-red-600" : ""}`}>
                            {formatMoney(run.total_profit, currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--muted)]">Unit cost</p>
                          <p className="mt-1 font-semibold">{item ? formatMoney(item.cost_per_unit, currency) : formatMoney(0, currency)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--muted)]">Selling / unit</p>
                          <p className="mt-1 font-semibold">{item ? formatMoney(item.selling_price_per_unit, currency) : formatMoney(0, currency)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">No production recorded yet</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Record the first batch after you make a recipe.</p>
                  </div>
                  <Link
                    href="/production/new"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] !bg-[var(--primary)] px-4 text-sm font-medium !text-white hover:!bg-[var(--primary-hover)]"
                  >
                    <ReceiptText size={16} />
                    Record production
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Why this matters</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
              <TrendingUp size={18} />
            </span>
            <p className="text-sm text-[var(--muted)]">
              Production history preserves the cost at the time you made the batch, even if ingredient prices change later.
            </p>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
