import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

const kpis = [
  { label: "Sales Today", value: "$12,450", meta: "+18.6% vs yesterday" },
  { label: "Sales This Month", value: "$245,780", meta: "+12.4% vs last month" },
  { label: "Expenses This Month", value: "$82,340", meta: "+6.3% vs last month" },
  { label: "Estimated Profit", value: "$163,440", meta: "+15.7% vs last month" },
];

const recentSales = [
  { saleNo: "S-000145", customer: "Maria Santos", time: "9:24 AM", amount: "$1,250", status: "Paid" },
  { saleNo: "S-000146", customer: "Kevin Reyes", time: "9:05 AM", amount: "$850", status: "Paid" },
  { saleNo: "S-000143", customer: "Walk-in Customer", time: "8:47 AM", amount: "$260", status: "Paid" },
  { saleNo: "S-000142", customer: "Ana Cruz", time: "8:33 AM", amount: "$2,150", status: "Partial" },
  { saleNo: "S-000141", customer: "Bernard Tan", time: "8:12 AM", amount: "$1,780", status: "Unpaid" },
];

function toneForStatus(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "Paid") return "success";
  if (status === "Partial") return "warning";
  if (status === "Unpaid") return "danger";
  return "neutral";
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell userEmail={user.email}>
      <PageHeader
        title="Dashboard"
        subtitle="Monitor sales, costs, and operations in real time."
        action={<Button>New Sale</Button>}
      />

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} meta={item.meta} />
        ))}
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales Over Time</CardTitle>
            <p className="text-sm text-[var(--muted)]">Last 30 days performance trend.</p>
          </CardHeader>
          <CardContent>
            <div className="h-48 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] p-4">
              <svg viewBox="0 0 400 140" className="h-full w-full">
                <polyline fill="none" stroke="var(--primary)" strokeWidth="3" points="0,110 40,70 80,90 120,50 160,65 200,55 240,82 280,48 320,58 360,38 400,44" />
              </svg>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
              <Table className="min-w-[720px]">
                <THead>
                  <TR>
                    <TH>Sale #</TH>
                    <TH>Customer</TH>
                    <TH>Time</TH>
                    <TH>Amount</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {recentSales.map((sale) => (
                    <TR key={sale.saleNo}>
                      <TD>{sale.saleNo}</TD>
                      <TD>{sale.customer}</TD>
                      <TD>{sale.time}</TD>
                      <TD>{sale.amount}</TD>
                      <TD><StatusBadge label={sale.status} tone={toneForStatus(sale.status)} /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
