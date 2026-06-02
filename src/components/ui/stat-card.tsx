import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StatCard({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-[var(--muted)]">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[32px] leading-[36px] font-bold tracking-tight">{value}</p>
        {meta ? <p className="mt-2 text-xs text-[var(--muted)]">{meta}</p> : null}
      </CardContent>
    </Card>
  );
}
