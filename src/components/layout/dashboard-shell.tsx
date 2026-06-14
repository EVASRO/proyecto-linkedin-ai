"use client";

import { useState } from "react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { CommandPaletteProvider } from "@/components/ui/CommandPalette";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <CommandPaletteProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--background)]">
        <DashboardSidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <DashboardHeader onMobileMenuOpen={() => setMobileOpen(true)} />
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
