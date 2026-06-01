"use client";

import { useState } from "react";
import { Columns3, LayoutList } from "lucide-react";
import type { Lead } from "@/lib/supabase";
import { LeadsTable } from "@/app/dashboard/crm/leads-table";
import { KanbanBoard } from "./kanban-board";

type View = "kanban" | "list";

export function CrmView({ initialLeads }: { initialLeads: Lead[] }) {
  const [view, setView] = useState<View>("kanban");

  return (
    <div>
      {/* View toggle */}
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {initialLeads.length} prospecto
          {initialLeads.length !== 1 ? "s" : ""}
        </p>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-1 shadow-sm">
          <button
            onClick={() => setView("kanban")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === "kanban"
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Kanban
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === "list"
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" />
            Lista
          </button>
        </div>
      </div>

      {view === "kanban" ? (
        <KanbanBoard initialLeads={initialLeads} />
      ) : (
        <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
          <LeadsTable initialLeads={initialLeads} />
        </div>
      )}
    </div>
  );
}
