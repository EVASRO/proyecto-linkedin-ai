"use client";

import { useState } from "react";
import {
  DashboardSidebar,
  DashboardMobileMenuButton,
} from "@/components/layout/dashboard-sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
          <DashboardMobileMenuButton onClick={() => setMobileOpen(true)} />
          <span className="text-sm font-semibold text-foreground">NexusAI</span>
        </div>
        {/* Contenido — cada página maneja su propio scroll interno */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
