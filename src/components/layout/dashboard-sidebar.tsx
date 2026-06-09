"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { Logo } from "@/components/ui/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { dashboardNavItems } from "@/lib/dashboard-nav";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";

// ── Inbox nav item with realtime unread badge ─────────────────────────────────

function InboxNavItem({
  href, label, icon: Icon, isActive, onClick,
}: {
  href: string; label: string; icon: React.ElementType;
  isActive: boolean; onClick?: () => void;
}) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    // Nombre único por instancia para evitar conflicto con StrictMode double-mount
    const channelName = `inbox-badge-${Math.random().toString(36).slice(2)}`;

    function fetchUnread() {
      supabase
        .from("conversations")
        .select("unread_count")
        .gt("unread_count", 0)
        .then(({ data }) => {
          const total = (data ?? []).reduce((s: number, r: { unread_count: number | null }) => s + (r.unread_count ?? 0), 0);
          setUnread(total);
        });
    }

    fetchUnread();

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, fetchUnread)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        isActive
          ? "bg-gradient-to-r from-emerald-600/90 to-green-600/90 text-white shadow-md shadow-emerald-900/30"
          : "text-sidebar-muted hover:bg-zinc-800/80 hover:text-white"
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          isActive ? "text-white" : "text-zinc-500 group-hover:text-emerald-400"
        )}
        strokeWidth={isActive ? 2.25 : 2}
      />
      <span className="flex-1 truncate">{label}</span>
      {unread > 0 && (
        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

type DashboardSidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function DashboardSidebar({
  mobileOpen = false,
  onMobileClose,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  const nav = (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg shadow-emerald-500/20">
          <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <Logo variant="light" className="[&_span:last-child]:text-base" />
          <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-muted">
            LinkedIn AI
          </p>
        </div>
        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            className="ml-auto rounded-lg p-2 text-sidebar-muted hover:bg-zinc-800 hover:text-white lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Módulos
        </p>
        {dashboardNavItems.filter((i) => i.section !== "account").map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          if (item.href === "/dashboard/smart-inbox") {
            return (
              <InboxNavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={Icon}
                isActive={isActive}
                onClick={onMobileClose}
              />
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-gradient-to-r from-emerald-600/90 to-green-600/90 text-white shadow-md shadow-emerald-900/30"
                  : "text-sidebar-muted hover:bg-zinc-800/80 hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isActive ? "text-white" : "text-zinc-500 group-hover:text-emerald-400"
                )}
                strokeWidth={isActive ? 2.25 : 2}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        <div className="my-2 border-t border-zinc-700/50" />
        <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Cuenta
        </p>
        {dashboardNavItems.filter((i) => i.section === "account").map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-gradient-to-r from-emerald-600/90 to-green-600/90 text-white shadow-md shadow-emerald-900/30"
                  : "text-sidebar-muted hover:bg-zinc-800/80 hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isActive ? "text-white" : "text-zinc-500 group-hover:text-emerald-400"
                )}
                strokeWidth={isActive ? 2.25 : 2}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
          <p className="text-xs font-medium text-zinc-300">Human-in-the-loop</p>
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
            Tú controlas cada conversión crítica.
          </p>
        </div>
        <SignOutButton />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        {nav}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-hidden
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {nav}
      </aside>
    </>
  );
}

export function DashboardMobileMenuButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border bg-surface p-2.5 text-foreground shadow-sm lg:hidden"
      aria-label="Abrir menú"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
