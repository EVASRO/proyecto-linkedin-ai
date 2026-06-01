"use client";

import { useState } from "react";
import { Bot, Calendar, Mail, MessageSquare, Plus, X, Zap } from "lucide-react";
import type { AutomationTrigger, Column, ColumnColor } from "./types";

const CC: Record<ColumnColor, { header: string }> = {
  blue:   { header: "bg-blue-500"   },
  sky:    { header: "bg-sky-500"    },
  violet: { header: "bg-violet-500" },
  amber:  { header: "bg-amber-500"  },
  green:  { header: "bg-green-500"  },
  red:    { header: "bg-red-500"    },
  pink:   { header: "bg-pink-500"   },
  orange: { header: "bg-orange-500" },
  indigo: { header: "bg-indigo-600" },
  purple: { header: "bg-purple-600" },
};

const ACTION_ICONS = [Bot, Mail, Calendar, MessageSquare, Zap];

interface AutomationMatrixProps {
  columns: Column[];
  initialAutomations: AutomationTrigger[];
  onAdd?: (colId: string, triggerLabel: string, actionLabel: string) => void;
  onRemove?: (id: string) => void;
}

export function AutomationMatrix({
  columns,
  initialAutomations,
  onAdd,
  onRemove,
}: AutomationMatrixProps) {
  const [automations, setAutomations] = useState(initialAutomations);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [triggerInput, setTriggerInput] = useState("");
  const [actionInput, setActionInput] = useState("");

  const colAutos = (id: string) => automations.filter((a) => a.columnId === id);

  function addAutomation(colId: string) {
    if (!triggerInput.trim() || !actionInput.trim()) return;
    onAdd?.(colId, triggerInput.trim(), actionInput.trim());
    setAutomations((prev) => [
      ...prev,
      {
        id: `a_${Date.now()}`,
        columnId: colId,
        triggerLabel: triggerInput.trim(),
        actionLabel: actionInput.trim(),
      },
    ]);
    setTriggerInput("");
    setActionInput("");
    setAddingTo(null);
  }

  function remove(id: string) {
    onRemove?.(id);
    setAutomations((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto pb-4 pr-2">
      {columns.map((col) => {
        const c = CC[col.color] ?? CC.blue;
        const autos = colAutos(col.id);

        return (
          <div key={col.id} className="flex w-[260px] flex-shrink-0 flex-col">
            {/* Header */}
            <div className={`rounded-t-xl ${c.header} px-3 py-2.5`}>
              <p className="truncate text-[11px] font-bold uppercase tracking-widest text-white">
                {col.title}
              </p>
              <p className="mt-0.5 text-[10px] text-white/60">
                {autos.length} regla{autos.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Body */}
            <div className="flex-1 rounded-b-xl border-x border-b border-zinc-200 bg-zinc-50/70 p-2 space-y-2">
              {autos.map((auto, idx) => {
                const ActionIcon = ACTION_ICONS[idx % ACTION_ICONS.length];
                return (
                  <div
                    key={auto.id}
                    className="group relative rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
                  >
                    {/* Remove button */}
                    <button
                      onClick={() => remove(auto.id)}
                      className="absolute right-2 top-2 hidden h-5 w-5 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-500 group-hover:flex"
                    >
                      <X className="h-3 w-3" />
                    </button>

                    {/* SI */}
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-amber-50">
                        <Zap className="h-3 w-3 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                          SI
                        </p>
                        <p className="text-[11px] leading-snug text-zinc-800">
                          {auto.triggerLabel}
                        </p>
                      </div>
                    </div>

                    {/* Connector */}
                    <div className="my-2 ml-3 border-l-2 border-dashed border-zinc-200 pl-5">
                      <div className="h-2" />
                    </div>

                    {/* ENTONCES */}
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-indigo-50">
                        <ActionIcon className="h-3 w-3 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                          ENTONCES
                        </p>
                        <p className="text-[11px] leading-snug text-zinc-800">
                          {auto.actionLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add trigger form */}
              {addingTo === col.id ? (
                <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-3 space-y-2">
                  <input
                    autoFocus
                    value={triggerInput}
                    onChange={(e) => setTriggerInput(e.target.value)}
                    placeholder="SI: Cuando ocurre..."
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <input
                    value={actionInput}
                    onChange={(e) => setActionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addAutomation(col.id);
                      if (e.key === "Escape") setAddingTo(null);
                    }}
                    placeholder="ENTONCES: Ejecutar..."
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => addAutomation(col.id)}
                      className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      Crear regla
                    </button>
                    <button
                      onClick={() => setAddingTo(null)}
                      className="rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-500 hover:bg-zinc-50"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingTo(col.id)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir disparador
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
