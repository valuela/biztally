"use client";

import { CheckCircle2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

type Toast = {
  id: number;
  tone: "success" | "error";
  message: string;
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(toast: Omit<Toast, "id">) {
    const id = Date.now();
    setToasts((current) => [...current, { id, ...toast }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4500);
  }

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <UrlToastListener onToast={addToast} />
      </Suspense>
      <div className="fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm shadow-[var(--shadow-md)]"
          >
            <CheckCircle2
              size={18}
              className={toast.tone === "success" ? "mt-0.5 shrink-0 text-[var(--success)]" : "mt-0.5 shrink-0 text-[var(--danger)]"}
            />
            <p className="min-w-0 flex-1 text-[var(--foreground)]">{toast.message}</p>
            <button
              type="button"
              className="shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
              aria-label="Dismiss notification"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function UrlToastListener({ onToast }: { onToast: (toast: Omit<Toast, "id">) => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const message = success ?? error;

    if (!message) return;
    if (lastMessageRef.current === `${success ? "success" : "error"}:${message}`) return;

    lastMessageRef.current = `${success ? "success" : "error"}:${message}`;
    window.setTimeout(() => {
      onToast({ tone: success ? "success" : "error", message });
    }, 0);

    const cleanParams = new URLSearchParams(searchParams.toString());
    cleanParams.delete("success");
    cleanParams.delete("error");
    const query = cleanParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });

  }, [onToast, pathname, router, searchParams]);

  return null;
}
