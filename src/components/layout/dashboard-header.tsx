"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { DashboardMobileMenuButton } from "@/components/layout/dashboard-sidebar";
import { useCommandPalette } from "@/components/ui/CommandPalette";

// ── Breadcrumb map ─────────────────────────────────────────────────────────────

const breadcrumbMap: Record<string, string> = {
  "/dashboard":                          "Dashboard",
  "/dashboard/campanas":                 "Campañas",
  "/dashboard/crm":                      "CRM",
  "/dashboard/smart-inbox":              "Smart Inbox",
  "/dashboard/inbound":                  "Inbound",
  "/dashboard/agentes-ia":              "Agentes IA",
  "/dashboard/analytics":               "Analytics",
  "/dashboard/settings":                "Ajustes",
  "/dashboard/settings/email":          "Ajustes · Email",
  "/dashboard/configuracion":           "Integraciones",
  "/dashboard/configuracion/selectores":"Selectores IA",
  "/dashboard/equipo":                  "Equipo",
  "/dashboard/perfil":                  "Mi perfil",
  "/dashboard/onboarding":              "Onboarding",
};

function Breadcrumb() {
  const pathname = usePathname();
  const label = breadcrumbMap[pathname] ?? "Dashboard";
  const parts = label.split(" · ");
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-[var(--foreground-faint)]">cazary.ai</span>
      <span className="text-[var(--foreground-faint)]">/</span>
      {parts.map((part, i) => (
        <span key={part}>
          {i > 0 && <span className="mr-1.5 text-[var(--foreground-faint)]">/</span>}
          <span className={i === parts.length - 1 ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}>
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}

// ── Search trigger ─────────────────────────────────────────────────────────────

function SearchTrigger() {
  const { open } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={open}
      className="hidden items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--foreground)] sm:flex"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Buscar...</span>
      <kbd className="ml-4 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--foreground-faint)]">
        ⌘K
      </kbd>
    </button>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────────

type DashboardHeaderProps = {
  onMobileMenuOpen?: () => void;
};

export function DashboardHeader({ onMobileMenuOpen }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-4">
      {/* Mobile burger */}
      {onMobileMenuOpen && (
        <DashboardMobileMenuButton onClick={onMobileMenuOpen} />
      )}

      {/* Breadcrumb */}
      <div className="hidden sm:block">
        <Breadcrumb />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Center: search */}
      <SearchTrigger />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: notifications + theme + avatar */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="relative rounded-lg p-2 text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
        </button>

        <ThemeToggle />

        <Link
          href="/dashboard/perfil"
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#06B6D4] text-xs font-bold text-white shadow-[var(--shadow-glow-primary)] transition-transform hover:scale-105"
          title="Mi perfil"
        >
          U
        </Link>
      </div>
    </header>
  );
}
