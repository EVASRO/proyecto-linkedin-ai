"use client";

import { useState } from "react";
import {
  DashboardSidebar,
  DashboardMobileMenuButton,
} from "@/components/layout/dashboard-sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
          <DashboardMobileMenuButton onClick={() => setMobileOpen(true)} />
          <span className="text-sm font-semibold text-foreground">
            NexusAI
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
