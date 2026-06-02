import { Badge } from "@/components/ui/badge";

type StatusTone = "success" | "warning" | "danger" | "neutral";

const toneStyles: Record<StatusTone, string> = {
  success: "border-green-200 bg-green-50 text-green-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]",
};

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return <Badge className={toneStyles[tone]}>{label}</Badge>;
}
