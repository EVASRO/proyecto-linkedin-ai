"use client";

import { useState, useRef } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Check, MoreHorizontal, Palette, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Column, ColumnColor, CrmLead } from "./types";
import { LeadCard } from "./LeadCard";
import { moveLead } from "@/app/dashboard/crm/actions";

// -- Column accent colors -----------------------------------------------------
// Maps the ColumnColor token to a single accent hex used for the header strip
// and drop-over ring. Everything else uses design system tokens.

const ACCENT: Record<ColumnColor, string> = {
  blue:   "#3B82F6",
  sky:    "#0EA5E9",
  violet: "#8B5CF6",
  amber:  "#F59E0B",
  green:  "#10B981",
  red:    "#EF4444",
  pink:   "#EC4899",
  orange: "#F97316",
  indigo: "#6366F1",
  purple: "#A855F7",
};

const ALL_COLORS = Object.keys(ACCENT) as ColumnColor[];

// -- Types --------------------------------------------------------------------

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

// -- Helpers ------------------------------------------------------------------

function fmtVal(v: number) {
  return v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : v > 0 ? `$${v}` : null;
}

// -- Component ----------------------------------------------------------------

export function Board({
  leads, columns, onLeadsChange, onColumnsChange,
  onLeadClick, onLeadDelete, onLeadArchive,
}: BoardProps) {
  const [openMenu, setOpenMenu] = useState<{ id: string; mode: MenuMode } | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const dragging = useRef(false);

  const colKey   = (col: Column) => col.key ?? col.id;
  const colLeads = (token: string) => leads.filter((l) => (l.crmColumn ?? l.status) === token);
  const colValue = (token: string) =>
    leads.filter((l) => (l.crmColumn ?? l.status) === token).reduce((s, l) => s + l.value, 0);

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
    } catch (_) {}
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
    const deletedKey  = columns.find((c) => c.id === id)?.key ?? id;
    const fallbackKey = columns.find((c) => c.id !== id)?.key ?? columns.find((c) => c.id !== id)?.id ?? "";
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
          const accent  = ACCENT[col.color] ?? ACCENT.blue;
          const isOpen  = openMenu?.id === col.id;
          const token   = colKey(col);
          const count   = colLeads(token).length;
          const value   = fmtVal(colValue(token));

          return (
            <div
              key={col.id}
              className="flex w-[260px] flex-shrink-0 flex-col"
              style={{ height: "calc(100vh - 180px)" }}
            >
              {/* ── Column header ─────────────────────────────────────────── */}
              <div
                className="relative rounded-t-xl px-3 py-2.5"
                style={{
                  background: `linear-gradient(135deg, ${accent}18, ${accent}0a)`,
                  borderTop:    `1px solid ${accent}40`,
                  borderLeft:   `1px solid ${accent}30`,
                  borderRight:  `1px solid ${accent}30`,
                  borderBottom: "none",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Title + count */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ background: accent }}
                    />
                    <span className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {col.title}
                    </span>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <span
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)]
                                 px-2 py-0.5 text-[10px] font-semibold text-[var(--foreground-muted)]"
                    >
                      {count}
                    </span>
                    <button
                      onClick={() => toggleMenu(col.id)}
                      className="flex h-5 w-5 items-center justify-center rounded
                                 text-[var(--foreground-faint)] opacity-0 transition-all
                                 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground-muted)]
                                 hover:opacity-100 group-hover:opacity-100 focus:opacity-100"
                      // always visible via hover on whole header area:
                      style={{ opacity: isOpen ? 1 : undefined }}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Pipeline value */}
                {value && (
                  <p className="mt-0.5 text-[10px] font-medium tabular-nums text-[var(--foreground-faint)]">
                    {value} en pipeline
                  </p>
                )}

                {/* ── Dropdown menu ───────────────────────────────────────── */}
                {isOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} />
                    <div
                      className="absolute right-2 top-full z-30 mt-1 w-44 overflow-hidden
                                 rounded-xl border border-[var(--border)] bg-[var(--surface)]
                                 shadow-[var(--shadow-lg)]"
                    >
                      {openMenu.mode === "main" && (
                        <>
                          <button
                            onClick={() => startRename(col)}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs
                                       text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]
                                       hover:text-[var(--foreground)] transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar nombre
                          </button>
                          <button
                            onClick={() => setOpenMenu({ id: col.id, mode: "color" })}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs
                                       text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]
                                       hover:text-[var(--foreground)] transition-colors"
                          >
                            <Palette className="h-3.5 w-3.5" />
                            Cambiar color
                          </button>
                          <div className="my-1 h-px bg-[var(--border)]" />
                          <button
                            onClick={() => deleteColumn(col.id)}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs
                                       text-[var(--danger)] hover:bg-[var(--danger-soft)]
                                       transition-colors"
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
                              if (e.key === "Enter")  applyRename(col.id);
                              if (e.key === "Escape") setOpenMenu(null);
                            }}
                            className="w-full rounded-lg border border-[var(--border)]
                                       bg-[var(--surface-hover)] px-2.5 py-1.5 text-xs
                                       text-[var(--foreground)] placeholder:text-[var(--foreground-faint)]
                                       focus:border-[var(--primary)] focus:outline-none
                                       focus:ring-2 focus:ring-[var(--primary-soft)]"
                            placeholder="Nombre de etapa..."
                          />
                          <button
                            onClick={() => applyRename(col.id)}
                            className="mt-1.5 flex w-full items-center justify-center gap-1
                                       rounded-lg py-1.5 text-xs font-semibold text-white
                                       transition-colors"
                            style={{ background: "var(--primary)" }}
                          >
                            <Check className="h-3 w-3" />
                            Guardar
                          </button>
                        </div>
                      )}

                      {openMenu.mode === "color" && (
                        <div className="p-2.5">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide
                                        text-[var(--foreground-faint)]">
                            Color de etapa
                          </p>
                          <div className="grid grid-cols-5 gap-1.5">
                            {ALL_COLORS.map((clr) => (
                              <button
                                key={clr}
                                onClick={() => applyColor(col.id, clr)}
                                title={clr}
                                className={cn(
                                  "h-6 w-6 rounded-md transition-transform hover:scale-110",
                                  col.color === clr
                                    ? "ring-2 ring-offset-1 ring-[var(--foreground-muted)]"
                                    : ""
                                )}
                                style={{ background: ACCENT[clr] }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* ── Drop zone ─────────────────────────────────────────────── */}
              <Droppable droppableId={token}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex-1 min-h-0 overflow-y-auto rounded-b-xl border-x border-b p-2 space-y-2",
                      "scrollbar-thin scrollbar-thumb-[var(--border)]",
                      "transition-[background-color,border-color] duration-150",
                      snapshot.isDraggingOver
                        ? "bg-[var(--primary-soft)] border-[var(--primary)]/50"
                        : "border-[var(--border)] bg-[var(--background)]"
                    )}
                    style={
                      snapshot.isDraggingOver
                        ? {
                            borderStyle: "dashed",
                            borderColor: `${accent}80`,
                            background: `${accent}06`,
                          }
                        : {}
                    }
                  >
                    {colLeads(token).map((lead, idx) => (
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

                    {/* Empty state */}
                    {count === 0 && !snapshot.isDraggingOver && (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-[11px] text-[var(--foreground-faint)]">Sin leads</p>
                        <p className="text-[10px] text-[var(--foreground-faint)] opacity-60 mt-0.5">
                          Arrastra aquí
                        </p>
                      </div>
                    )}

                    {/* Add lead button */}
                    <button
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg
                                 border border-dashed border-[var(--border)] py-2
                                 text-[11px] text-[var(--foreground-faint)]
                                 transition-colors hover:border-[var(--foreground-faint)]
                                 hover:text-[var(--foreground-muted)]"
                    >
                      <Plus className="h-3 w-3" />
                      Agregar lead
                    </button>
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}

        {/* ── Add Stage ─────────────────────────────────────────────────── */}
        <div className="w-48 flex-shrink-0">
          {addingStage ? (
            <div
              className="rounded-xl border border-dashed border-[var(--border)]
                         bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)]"
            >
              <input
                autoFocus
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  addStage();
                  if (e.key === "Escape") setAddingStage(false);
                }}
                className="w-full rounded-lg border border-[var(--border)]
                           bg-[var(--surface-hover)] px-2.5 py-1.5 text-xs
                           text-[var(--foreground)] placeholder:text-[var(--foreground-faint)]
                           focus:border-[var(--primary)] focus:outline-none
                           focus:ring-2 focus:ring-[var(--primary-soft)]"
                placeholder="Nombre de etapa..."
              />
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={addStage}
                  className="flex-1 rounded-lg py-1.5 text-xs font-semibold text-white transition-colors"
                  style={{ background: "var(--primary)" }}
                >
                  Añadir
                </button>
                <button
                  onClick={() => setAddingStage(false)}
                  className="rounded-lg border border-[var(--border)] p-1.5
                             text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]
                             transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingStage(true)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl
                         border border-dashed border-[var(--border)]
                         text-xs font-medium text-[var(--foreground-faint)]
                         transition-all hover:border-[var(--foreground-faint)]
                         hover:bg-[var(--surface)] hover:text-[var(--foreground-muted)]"
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
