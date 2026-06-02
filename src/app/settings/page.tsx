import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
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
        title="Settings"
        subtitle="Manage your account and workspace defaults."
        action={<Button>Save changes</Button>}
      />

      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Display name</p>
                <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--muted)]">
                  {user.user_metadata?.full_name ?? "BizTally user"}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Email</p>
                <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--muted)]">
                  {user.email}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Theme</p>
              <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--muted)]">
                Light mode for now
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
              <p className="text-sm font-medium">Password</p>
              <p className="text-sm text-[var(--muted)]">Change your password from the auth provider.</p>
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
              <p className="text-sm font-medium">Session</p>
              <p className="text-sm text-[var(--muted)]">You are signed in on this device.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
