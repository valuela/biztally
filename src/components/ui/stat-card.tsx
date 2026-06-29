import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  meta,
  compact = false,
  fitValue = false,
}: {
  label: string;
  value: string;
  meta?: string;
  compact?: boolean;
  fitValue?: boolean;
}) {
  return (
    <Card>
      <CardHeader className={cn(compact && "p-3 pb-1 sm:p-6 sm:pb-0")}>
        <CardTitle className={cn("text-sm font-medium text-[var(--muted)]", compact && "text-xs sm:text-sm")}>{label}</CardTitle>
      </CardHeader>
      <CardContent className={cn(compact && "px-3 pb-3 sm:px-6 sm:pb-6")}>
        <p
          className={cn(
            "truncate text-2xl leading-8 font-bold tracking-tight sm:text-[32px] sm:leading-[36px]",
            compact && "text-xl leading-6 sm:text-[32px] sm:leading-[36px]",
            fitValue &&
              "truncate whitespace-nowrap text-xl leading-7 sm:text-2xl sm:leading-8 xl:text-[26px] xl:leading-8"
          )}
        >
          {value}
        </p>
        {meta ? <p className={cn("mt-2 text-xs text-[var(--muted)]", compact && "mt-1 max-h-8 overflow-hidden leading-4")}>{meta}</p> : null}
      </CardContent>
    </Card>
  );
}
