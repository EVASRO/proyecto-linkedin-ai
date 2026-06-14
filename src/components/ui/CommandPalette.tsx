"use client";

import { useEffect, useState, useCallback, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  LayoutDashboard, Zap, Columns3, MessageSquare, PenLine,
  Bot, BarChart2, Settings, Link2, Users2, Wrench,
  Plus, Upload, PauseCircle, Search,
} from "lucide-react";

// ── Context ────────────────────────────────────────────────────────────────────

type CommandPaletteCtx = { open: () => void; close: () => void };
const CommandPaletteContext = createContext<CommandPaletteCtx>({ open: () => {}, close: () => {} });
export function useCommandPalette() { return useContext(CommandPaletteContext); }

// ── Nav items ──────────────────────────────────────────────────────────────────

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard",    href: "/dashboard" },
  { icon: Zap,             label: "Campañas",     href: "/dashboard/campanas" },
  { icon: Columns3,        label: "CRM",          href: "/dashboard/crm" },
  { icon: MessageSquare,   label: "Smart Inbox",  href: "/dashboard/smart-inbox" },
  { icon: PenLine,         label: "Inbound",      href: "/dashboard/inbound" },
  { icon: Bot,             label: "Agentes IA",   href: "/dashboard/agentes-ia" },
  { icon: BarChart2,       label: "Analytics",    href: "/dashboard/analytics" },
  { icon: Settings,        label: "Ajustes",      href: "/dashboard/settings" },
  { icon: Link2,           label: "Integraciones",href: "/dashboard/configuracion" },
  { icon: Users2,          label: "Equipo",       href: "/dashboard/equipo" },
  { icon: Wrench,          label: "Selectores IA",href: "/dashboard/configuracion/selectores" },
];

// ── Palette dialog ─────────────────────────────────────────────────────────────

function PaletteDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  useEffect(() => { if (isOpen) setSearch(""); }, [isOpen]);

  function navigate(href: string) {
    router.push(href);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
        <Command className="flex flex-col" shouldFilter>
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5">
            <Search className="h-4 w-4 shrink-0 text-[var(--foreground-muted)]" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Buscar módulos o acciones..."
              className="flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-faint)]"
              autoFocus
            />
            <kbd className="rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--foreground-faint)]">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[340px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-[var(--foreground-muted)]">
              Sin resultados.
            </Command.Empty>

            {/* Navigation group */}
            <Command.Group
              heading="Navegación"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-[var(--foreground-faint)]"
            >
              {navItems.map(({ icon: Icon, label, href }) => (
                <Command.Item
                  key={href}
                  value={label}
                  onSelect={() => navigate(href)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--foreground-muted)] transition-colors aria-selected:bg-[rgba(37,99,235,0.18)] aria-selected:text-[var(--foreground)]"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Actions group */}
            <Command.Group
              heading="Acciones"
              className="mt-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-[var(--foreground-faint)]"
            >
              {[
                { icon: Plus,        label: "Crear campaña",    action: () => navigate("/dashboard/campanas") },
                { icon: Upload,      label: "Importar leads",   action: () => navigate("/dashboard/crm") },
                { icon: PauseCircle, label: "Pausar motor",     action: onClose },
              ].map(({ icon: Icon, label, action }) => (
                <Command.Item
                  key={label}
                  value={label}
                  onSelect={action}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--foreground-muted)] transition-colors aria-selected:bg-[rgba(37,99,235,0.18)] aria-selected:text-[var(--foreground)]"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>

          {/* Footer hint */}
          <div className="flex items-center gap-3 border-t border-[var(--border)] px-4 py-2 text-[10px] text-[var(--foreground-faint)]">
            <span><kbd className="font-mono">↑↓</kbd> navegar</span>
            <span><kbd className="font-mono">↵</kbd> abrir</span>
            <span><kbd className="font-mono">ESC</kbd> cerrar</span>
          </div>
        </Command>
      </div>
    </div>
  );
}

// ── Provider (wraps the whole dashboard) ──────────────────────────────────────

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open, close }}>
      {children}
      <PaletteDialog isOpen={isOpen} onClose={close} />
    </CommandPaletteContext.Provider>
  );
}
