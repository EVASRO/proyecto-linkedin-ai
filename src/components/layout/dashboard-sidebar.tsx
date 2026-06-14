"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Zap, Users, MessageSquare, Bot, BarChart2,
  Link2, Users2, Settings, ChevronLeft, X, Menu,
  BarChart3, Columns3, Inbox, PenLine, Wrench, Megaphone,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";
import { SignOutButton } from "@/components/auth/sign-out-button";

// ── Nav structure ──────────────────────────────────────────────────────────────

const navGroups = [
  {
    label: "PRINCIPAL",
    items: [
      { icon: LayoutDashboard, label: "Dashboard",    href: "/dashboard",           exact: true  },
      { icon: Zap,             label: "Campañas",     href: "/dashboard/campanas",  exact: false },
      { icon: Columns3,        label: "CRM",          href: "/dashboard/crm",       exact: false },
      { icon: MessageSquare,   label: "Smart Inbox",  href: "/dashboard/smart-inbox", exact: false, badge: "inbox" },
      { icon: PenLine,         label: "Inbound",      href: "/dashboard/inbound",   exact: false },
    ],
  },
  {
    label: "INTELIGENCIA",
    items: [
      { icon: Bot,       label: "Agentes IA", href: "/dashboard/agentes-ia", exact: false },
      { icon: BarChart2, label: "Analytics",  href: "/dashboard/analytics",  exact: false },
    ],
  },
  {
    label: "CONFIGURACIÓN",
    items: [
      { icon: Settings, label: "Ajustes",       href: "/dashboard/settings",                exact: false },
      { icon: Link2,    label: "Integraciones", href: "/dashboard/configuracion",            exact: false },
      { icon: Users2,   label: "Equipo",        href: "/dashboard/equipo",                   exact: false },
      { icon: Wrench,   label: "Selectores IA", href: "/dashboard/configuracion/selectores", exact: false, badge: "selectores" },
    ],
  },
];

// ── Inbox badge (realtime) ─────────────────────────────────────────────────────

function useInboxBadge() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const supabase = createClient();
    const ch = `inbox-badge-${Math.random().toString(36).slice(2)}`;
    function fetch() {
      supabase.from("conversations").select("unread_count").gt("unread_count", 0)
        .then(({ data }) => {
          setUnread((data ?? []).reduce((s: number, r: { unread_count: number | null }) => s + (r.unread_count ?? 0), 0));
        });
    }
    fetch();
    const channel = supabase.channel(ch)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
  return unread;
}

// ── Selectores badge (polling) ─────────────────────────────────────────────────

function useSelectorBadge() {
  const [proposed, setProposed] = useState(0);
  useEffect(() => {
    const supabase = createClient();
    function fetch() {
      supabase.from("selector_failures").select("id", { count: "exact", head: true })
        .eq("status", "proposed").then(({ count }) => setProposed(count ?? 0));
    }
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, []);
  return proposed;
}

// ── Single nav item ────────────────────────────────────────────────────────────

function NavItem({
  icon: Icon, label, href, exact, badgeCount, isCollapsed, onClick,
}: {
  icon: React.ElementType; label: string; href: string; exact: boolean;
  badgeCount?: number; isCollapsed: boolean; onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  const inner = (
    <>
      <div className={cn("relative flex shrink-0 items-center justify-center", isCollapsed ? "mx-auto" : "")}>
        <Icon
          className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-white" : "text-[var(--sidebar-muted)]")}
          strokeWidth={isActive ? 2.25 : 2}
        />
        {/* Badge on icon when collapsed */}
        {isCollapsed && badgeCount && badgeCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[#EF4444] px-0.5 text-[8px] font-bold text-white">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </div>
      {!isCollapsed && (
        <>
          <span className="flex-1 truncate text-sm font-medium">{label}</span>
          {badgeCount && badgeCount > 0 ? (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[9px] font-bold text-white">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          ) : null}
        </>
      )}
    </>
  );

  return (
    <Link
      href={href}
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-all duration-150",
        isCollapsed && "justify-center px-2",
        isActive
          ? "border-l-2 border-[#2563EB] bg-[rgba(37,99,235,0.18)] pl-[calc(0.625rem-2px)] text-white"
          : "text-[#475569] hover:bg-[rgba(37,99,235,0.10)] hover:text-[#CBD5E1]",
        isCollapsed && isActive && "border-l-0 pl-2"
      )}
    >
      {inner}
    </Link>
  );
}

// ── Motor status indicator ─────────────────────────────────────────────────────

function MotorStatus({ isCollapsed }: { isCollapsed: boolean }) {
  const status: "active" | "paused" | "error" = "active";
  const dot = {
    active: "bg-[#10B981] animate-pulse",
    paused: "bg-[#F59E0B]",
    error:  "bg-[#EF4444]",
  }[status];
  const label = { active: "Motor activo", paused: "Motor pausado", error: "Error en motor" }[status];

  return (
    <div className={cn("flex items-center gap-2 rounded-lg border border-[var(--sidebar-border)] bg-[#0A1628] px-3 py-2", isCollapsed && "justify-center px-2")}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
      {!isCollapsed && (
        <span className="text-xs font-medium text-[#94A3B8]">{label}</span>
      )}
    </div>
  );
}

// ── Main sidebar component ─────────────────────────────────────────────────────

type DashboardSidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function DashboardSidebar({ mobileOpen = false, onMobileClose }: DashboardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cazary-sidebar");
      if (saved !== null) setIsCollapsed(JSON.parse(saved));
    } catch {}
  }, []);

  function toggleCollapse() {
    setIsCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("cazary-sidebar", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const inboxBadge = useInboxBadge();
  const selectorBadge = useSelectorBadge();

  function getBadge(badge?: string) {
    if (badge === "inbox") return inboxBadge;
    if (badge === "selectores") return selectorBadge;
    return undefined;
  }

  const navContent = (collapsed: boolean, closeFn?: () => void) => (
    <div className="flex h-full flex-col">
      {/* Logo area */}
      <div className={cn("relative flex h-14 items-center border-b border-[var(--sidebar-border)]", collapsed ? "justify-center px-3" : "px-4")}>
        {collapsed ? (
          <Image src="/logo-icon-dark.png" alt="cazary.ai" width={32} height={32} className="h-8 w-8 object-contain" priority />
        ) : (
          <Image src="/logo-rect-navy.png" alt="cazary.ai" width={120} height={32} className="h-8 w-auto object-contain" priority />
        )}
        {closeFn && (
          <button type="button" onClick={closeFn} className="ml-auto rounded-lg p-1.5 text-[#475569] hover:text-[#CBD5E1] lg:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#334155]">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  icon={item.icon}
                  label={item.label}
                  href={item.href}
                  exact={item.exact}
                  badgeCount={getBadge(item.badge)}
                  isCollapsed={collapsed}
                  onClick={closeFn}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom area */}
      <div className={cn("border-t border-[var(--sidebar-border)] p-2 space-y-2")}>
        <MotorStatus isCollapsed={collapsed} />
        {!collapsed && <SignOutButton />}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "relative hidden h-full shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[#080F1E] transition-all duration-300 lg:flex",
          isCollapsed ? "w-16" : "w-60"
        )}
      >
        {navContent(isCollapsed)}

        {/* Collapse toggle button */}
        <button
          type="button"
          onClick={toggleCollapse}
          title={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          className="absolute -right-3 top-[4.5rem] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[#0F172A] text-[#475569] shadow-md transition-all hover:text-[#CBD5E1]"
        >
          <ChevronLeft
            className={cn("h-3.5 w-3.5 transition-transform duration-300", isCollapsed && "rotate-180")}
          />
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onMobileClose} aria-hidden />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--sidebar-border)] bg-[#080F1E] transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent(false, onMobileClose)}
      </aside>
    </>
  );
}

export function DashboardMobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] lg:hidden"
      aria-label="Abrir menú"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
