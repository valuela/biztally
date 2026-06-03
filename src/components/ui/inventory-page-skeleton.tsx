import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-alt)]", className)} />;
}

export function InventoryPageSkeleton({
  title = "Inventory",
  subtitle = "Loading inventory data...",
  form = false,
}: {
  title?: string;
  subtitle?: string;
  form?: boolean;
}) {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-2xl font-bold text-[var(--foreground)]">{title}</p>
            <p className="text-sm text-[var(--muted)]">{subtitle}</p>
          </div>
          <SkeletonBlock className="h-10 w-36 rounded-full" />
        </div>

        {form ? (
          <Card className="max-w-4xl">
            <CardHeader>
              <CardTitle className="text-lg">Loading form</CardTitle>
              <SkeletonBlock className="h-4 w-72" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className={index === 0 || index === 7 ? "space-y-2 md:col-span-2" : "space-y-2"}>
                    <SkeletonBlock className="h-4 w-28" />
                    <SkeletonBlock className="h-10 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="shadow-none">
                  <CardContent className="space-y-5 p-6">
                    <SkeletonBlock className="h-4 w-28" />
                    <SkeletonBlock className="h-8 w-16" />
                    <SkeletonBlock className="h-4 w-36" />
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="space-y-3">
                <CardTitle className="text-lg">Loading items</CardTitle>
                <SkeletonBlock className="h-10 w-full max-w-xl" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-4 rounded-[var(--radius-sm)] border border-[var(--border)] p-4">
                    <SkeletonBlock className="h-10 w-10" />
                    <div className="flex-1 space-y-2">
                      <SkeletonBlock className="h-4 w-40" />
                      <SkeletonBlock className="h-3 w-64" />
                    </div>
                    <SkeletonBlock className="h-8 w-24 rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
