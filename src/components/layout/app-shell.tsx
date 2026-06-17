"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BellRing,
  Boxes,
  ChartColumnIncreasing,
  ChefHat,
  Factory,
  Menu,
  Search,
  Settings,
  ShoppingCart,
  Store,
  User,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: ChartColumnIncreasing },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
  { href: "/production", label: "Production", icon: Factory },
  { href: "/reorder", label: "Reorder", icon: ShoppingCart },
  { href: "/vendors", label: "Vendors", icon: Store },
  { href: "/products", label: "Products", icon: Boxes },
  { href: "/sales", label: "Sales", icon: ChartColumnIncreasing },
  { href: "#", label: "Expenses", icon: ChartColumnIncreasing },
];

const notifications = [
  {
    title: "Low stock alert",
    detail: "Revel Bars are down to 8 boxes.",
    time: "5m ago",
    unread: true,
  },
  {
    title: "New sale recorded",
    detail: "Maria Santos completed a $1,250 sale.",
    time: "18m ago",
    unread: true,
  },
  {
    title: "Inventory synced",
    detail: "Barcode data imported successfully.",
    time: "2h ago",
    unread: false,
  },
];

function getInitials(email?: string) {
  if (!email) return "U";
  const handle = email.split("@")[0] ?? "";
  const parts = handle.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return handle.slice(0, 2).toUpperCase() || "U";
}

export function AppShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const initials = getInitials(userEmail);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              {open ? <X size={16} /> : <Menu size={16} />}
            </button>
            <p className="text-lg font-semibold">BizTally</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                className="h-9 w-72 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                placeholder="Search..."
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--surface-alt)]"
                  aria-label="Notifications"
                >
                  <Bell size={16} />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--danger)]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between px-2 py-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">Notifications</p>
                    <p className="text-xs text-[var(--muted)]">Recent activity and alerts.</p>
                  </div>
                  <BellRing size={14} className="text-[var(--muted)]" />
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.map((notification) => (
                  <DropdownMenuItem key={notification.title} className="items-start gap-3 py-2">
                    <span
                      className={cn(
                        "mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
                        notification.unread ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{notification.title}</span>
                      <span className="block text-xs text-[var(--muted)]">{notification.detail}</span>
                      <span className="mt-1 block text-xs text-[var(--muted)]">{notification.time}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-[var(--muted)]">View all notifications</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-9 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-alt)]">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-semibold text-[var(--foreground)]">
                    {initials}
                  </span>
                  <span className="hidden max-w-[180px] truncate md:inline">{userEmail ?? "Signed in"}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="space-y-1 px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-alt)] text-sm font-semibold text-[var(--foreground)]">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)]">Account</p>
                      <p className="truncate text-xs text-[var(--muted)]">{userEmail ?? "Signed in"}</p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="flex items-center gap-2">
                    <User size={14} />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/inventory" className="flex items-center gap-2">
                    <Boxes size={14} />
                    Inventory
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings size={14} />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[var(--danger)] focus:text-[var(--danger)]"
                  onSelect={(event) => {
                    event.preventDefault();
                    signOutFormRef.current?.requestSubmit();
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <form ref={signOutFormRef} action="/auth/signout" method="post" className="hidden" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-[248px_1fr]">
        <aside className={cn("border-r border-[var(--border)] bg-[var(--surface)] p-4 lg:block", open ? "block" : "hidden lg:block")}>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href !== "#" && pathname.startsWith(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors",
                    item.href === "#"
                      ? "pointer-events-none text-[var(--muted)]/70"
                      : active
                        ? "bg-[var(--surface-alt)] text-[var(--foreground)] font-medium shadow-[inset_0_0_0_1px_var(--border)]"
                        : "text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] transition-colors",
                      active ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "text-[var(--muted)] group-hover:text-[var(--foreground)]"
                    )}
                  >
                    <Icon size={14} />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
