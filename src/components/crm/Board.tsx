"use client";

import { useState, useRef } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Check, MoreHorizontal, Palette, Pencil, Plus, Trash2 } from "lucide-react";
import type { Column, ColumnColor, CrmLead } from "./types";
import { LeadCard } from "./LeadCard";
import { moveLead } from "@/app/dashboard/crm/actions";

// -- Color system --------------------------------------------------------------

const CC: Record<ColumnColor, { header: string; ring: string; count: string }> = {
  blue:   { header: "bg-blue-500",   ring: "ring-blue-300",   count: "bg-blue-100 text-blue-700"    },
  sky:    { header: "bg-sky-500",    ring: "ring-sky-300",    count: "bg-sky-100 text-sky-700"      },
  violet: { header: "bg-violet-500", ring: "ring-violet-300", count: "bg-violet-100 text-violet-700" },
  amber:  { header: "bg-amber-500",  ring: "ring-amber-300",  count: "bg-amber-100 text-amber-700"  },
  green:  { header: "bg-green-500",  ring: "ring-green-300",  count: "bg-green-100 text-green-700"  },
  red:    { header: "bg-red-500",    ring: "ring-red-300",    count: "bg-red-100 text-red-700"      },
  pink:   { header: "bg-pink-500",   ring: "ring-pink-300",   count: "bg-pink-100 text-pink-700"    },
  orange: { header: "bg-orange-500", ring: "ring-orange-300", count: "bg-orange-100 text-orange-700" },
  indigo: { header: "bg-indigo-600", ring: "ring-indigo-300", count: "bg-indigo-100 text-indigo-700" },
  purple: { header: "bg-purple-600", ring: "ring-purple-300", count: "bg-purple-100 text-purple-700" },
};

const ALL_COLORS = Object.keys(CC) as ColumnColor[];

// -- Types ---------------------------------------------------------------------

type MenuMode = "main" | "rename" | "color";

interface BoardProps {
  leads: CrmLead[];
  columns: Column[];
  onLeadsChange: (leads: CrmLead[]) => void;
  onColumnsChange: (cols: Column[]) => void;
  onLeadClick?: (lead: CrmLead) => void;
  onLeadDelete?: (lead: CrmLead) => void;
  onLeadArchive?: (leadId: string) => void;
}

// -- Component -----------------------------------------------------------------

export function Board({ leads, columns, onLeadsChange, onColumnsChange, onLeadClick, onLeadDelete, onLeadArchive }: BoardProps) {
  const [openMenu, setOpenMenu] = useState<{ id: string; mode: MenuMode } | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const dragging = useRef(false); // prevent click firing after drag

  const colKey   = (col: Column) => col.key ?? col.id;
  const colLeads = (token: string) => leads.filter((l) => (l.crmColumn ?? l.status) === token);
  const colValue = (token: string) =>
    leads.filter((l) => (l.crmColumn ?? l.status) === token).reduce((s, l) => s + l.value, 0);
  const fmtVal = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`);

  async function onDragEnd({ source, destination, draggableId }: DropResult) {
    dragging.current = true;
    setTimeout(() => { dragging.current = false; }, 150);
    if (!destination || destination.droppableId === source.droppableId) return;
    onLeadsChange(
      leads.map((l) =>
        l.id === draggableId ? { ...l, crmColumn: destination.droppableId } : l
      )
    );
    try {
      await moveLead(draggableId, destination.droppableId);
    } catch (_) {
      // optimistic update already applied
    }
  }

  function toggleMenu(id: string) {
    setOpenMenu((prev) => (prev?.id === id ? null : { id, mode: "main" }));
  }

  function startRename(col: Column) {
    setRenameVal(col.title);
    setOpenMenu({ id: col.id, mode: "rename" });
  }

  function applyRename(id: string) {
    if (!renameVal.trim()) return;
    onColumnsChange(
      columns.map((c) => (c.id === id ? { ...c, title: renameVal.toUpperCase() } : c))
    );
    setOpenMenu(null);
  }

  function applyColor(id: string, color: ColumnColor) {
    onColumnsChange(columns.map((c) => (c.id === id ? { ...c, color } : c)));
    setOpenMenu(null);
  }

  function deleteColumn(id: string) {
    const deletedCol  = columns.find((c) => c.id === id);
    const deletedKey  = deletedCol?.key ?? id;
    const fallbackCol = columns.find((c) => c.id !== id);
    const fallbackKey = fallbackCol ? (fallbackCol.key ?? fallbackCol.id) : "";
    onColumnsChange(columns.filter((c) => c.id !== id));
    onLeadsChange(leads.map((l) =>
      (l.crmColumn ?? l.status) === deletedKey ? { ...l, crmColumn: fallbackKey } : l
    ));
    setOpenMenu(null);
  }

  function addStage() {
    if (!newStageName.trim()) return;
    onColumnsChange([
      ...columns,
      { id: `col_${Date.now()}`, title: newStageName.toUpperCase(), color: "sky" },
    ]);
    setNewStageName("");
    setAddingStage(false);
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full gap-3 overflow-x-auto pb-4 pr-2 items-start">
        {columns.map((col) => {
          const c = CC[col.color] ?? CC.blue;
          const isOpen = openMenu?.id === col.id;

          return (
            <div key={col.id} className="flex w-[260px] flex-shrink-0 flex-col"
                 style={{ height: 'calc(100vh - 180px)' }}>
              {/* -- Column header -- */}
              <div className={`relative rounded-t-xl ${c.header} px-3 py-2.5`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-bold uppercase tracking-widest text-white">
                    {col.title}
                  </span>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${c.count}`}>
                      {colLeads(colKey(col)).length}
                    </span>
                    <button
                      onClick={() => toggleMenu(col.id)}
                      className="flex h-5 w-5 items-center justify-center rounded text-white/70 transition-colors hover:bg-white/20"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-0.5 text-[10px] font-medium tabular-nums text-white/60">
                  {fmtVal(colValue(colKey(col)))} en pipeline
                </p>

                {/* -- Dropdown -- */}
                {isOpen && (
                  <>
                    {/* Invisible overlay to close on outside click */}
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setOpenMenu(null)}
                    />
                    <div className="absolute right-2 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
                      {openMenu.mode === "main" && (
                        <>
                          <button
                            onClick={() => startRename(col)}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                          >
                            <Pencil className="h-3.5 w-3.5 text-zinc-400" />
                            Editar nombre
                          </button>
                          <button
                            onClick={() =>
                              setOpenMenu({ id: col.id, mode: "color" })
                            }
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                          >
                            <Palette className="h-3.5 w-3.5 text-zinc-400" />
                            Cambiar color
                          </button>
                          <div className="my-1 h-px bg-zinc-100" />
                          <button
                            onClick={() => deleteColumn(col.id)}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar etapa
                          </button>
                        </>
                      )}

                      {openMenu.mode === "rename" && (
                        <div className="p-2.5">
                          <input
                            autoFocus
                            value={renameVal}
                            onChange={(e) => setRenameVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") applyRename(col.id);
                              if (e.key === "Escape") setOpenMenu(null);
                            }}
                            className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            placeholder="Nombre de etapa..."
                          />
                          <button
                            onClick={() => applyRename(col.id)}
                            className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg bg-zinc-900 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
                          >
                            <Check className="h-3 w-3" />
                            Guardar
                          </button>
                        </div>
                      )}

                      {openMenu.mode === "color" && (
                        <div className="p-2.5">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                            Color de etapa
                          </p>
                          <div className="grid grid-cols-5 gap-1.5">
                            {ALL_COLORS.map((clr) => (
                              <button
                                key={clr}
                                onClick={() => applyColor(col.id, clr)}
                                title={clr}
                                className={[
                                  "h-6 w-6 rounded-md transition-transform hover:scale-110",
                                  CC[clr].header,
                                  col.color === clr
                                    ? "ring-2 ring-offset-1 ring-zinc-700"
                                    : "",
                                ].join(" ")}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* -- Drop zone -- */}
              <Droppable droppableId={colKey(col)}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={[
                      "flex-1 min-h-0 overflow-y-auto rounded-b-xl border-x border-b p-2 space-y-2",
                      "transition-all duration-150 scrollbar-thin scrollbar-thumb-zinc-200",
                      snapshot.isDraggingOver
                        ? `bg-zinc-100/80 ${c.ring} ring-2 ring-inset border-transparent`
                        : "border-zinc-200 bg-zinc-50/70",
                    ].join(" ")}
                  >
                    {colLeads(colKey(col)).map((lead, idx) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => {
                              if (!dragging.current) onLeadClick?.(lead);
                            }}
                          >
                            <LeadCard
                              lead={lead}
                              isDragging={snapshot.isDragging}
                              onView={onLeadClick}
                              onDelete={onLeadDelete}
                              onArchive={onLeadArchive ? (l) => onLeadArchive(l.id) : undefined}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {colLeads(col.id).length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-[11px] text-zinc-400">Sin leads</p>
                        <p className="text-[10px] text-zinc-300">Arrastra aquí</p>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}

        {/* -- Add Stage -- */}
        <div className="w-48 flex-shrink-0">
          {addingStage ? (
            <div className="rounded-xl border-2 border-dashed border-zinc-300 bg-white p-3 shadow-sm">
              <input
                autoFocus
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addStage();
                  if (e.key === "Escape") setAddingStage(false);
                }}
                className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="Nombre de etapa..."
              />
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={addStage}
                  className="flex-1 rounded-lg bg-zinc-900 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
                >
                  Añadir
                </button>
                <button
                  onClick={() => setAddingStage(false)}
                  className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingStage(true)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 text-xs font-medium text-zinc-400 transition-all hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
            >
              <Plus className="h-4 w-4" />
              Añadir etapa
            </button>
          )}
        </div>
      </div>
    </DragDropContext>
  );
}
