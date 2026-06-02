"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center p-4 sm:p-6">
      <section className="grid w-full max-w-[960px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)] md:grid-cols-2">
        <div className="hidden border-r border-[var(--border)] bg-[var(--surface-alt)] p-8 md:block">
          <p className="text-lg font-semibold">BizTally</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight">Sign in to your workspace.</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Manage inventory, pricing, sales, and expenses in one place.</p>
        </div>

        <Card className="rounded-none border-0 shadow-none">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">Sign in</CardTitle>
            <p className="text-sm text-[var(--muted)]">Use your account credentials.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" required />
              </div>

              {error ? <FormAlert>{error}</FormAlert> : null}

              <Button className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <p className="mt-4 text-sm text-[var(--muted)]">
              No account yet? <Link href="/register" className="font-medium text-[var(--primary)]">Create one</Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
