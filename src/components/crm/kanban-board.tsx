"use client";

import { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import type { Lead } from "@/lib/supabase";
import { updateLeadStatus } from "@/app/dashboard/crm/actions";

const COLUMNS: {
  id: string;
  label: string;
  dot: string;
  headerBg: string;
  headerText: string;
}[] = [
  {
    id: "nuevo",
    label: "Nuevo",
    dot: "bg-blue-400",
    headerBg: "bg-blue-50",
    headerText: "text-blue-700",
  },
  {
    id: "en_campana",
    label: "En Campaña",
    dot: "bg-violet-400",
    headerBg: "bg-violet-50",
    headerText: "text-violet-700",
  },
  {
    id: "conectado",
    label: "Conectado",
    dot: "bg-sky-400",
    headerBg: "bg-sky-50",
    headerText: "text-sky-700",
  },
  {
    id: "respondio",
    label: "Respondió",
    dot: "bg-amber-400",
    headerBg: "bg-amber-50",
    headerText: "text-amber-700",
  },
  {
    id: "calificado",
    label: "Calificado",
    dot: "bg-green-400",
    headerBg: "bg-green-50",
    headerText: "text-green-700",
  },
  {
    id: "rechazado",
    label: "Rechazado",
    dot: "bg-red-400",
    headerBg: "bg-red-50",
    headerText: "text-red-700",
  },
];

type BoardState = Record<string, Lead[]>;

function groupLeads(leads: Lead[]): BoardState {
  const board: BoardState = {};
  for (const col of COLUMNS) board[col.id] = [];
  for (const lead of leads) {
    const key = lead.status in board ? lead.status : "nuevo";
    board[key].push(lead);
  }
  return board;
}

export function KanbanBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const [board, setBoard] = useState<BoardState>(() =>
    groupLeads(initialLeads)
  );

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const sourceCol = [...board[source.droppableId]];
    const destCol = [...board[destination.droppableId]];
    const [moved] = sourceCol.splice(source.index, 1);

    destCol.splice(destination.index, 0, {
      ...moved,
      status: destination.droppableId,
    });

    setBoard((prev) => ({
      ...prev,
      [source.droppableId]: sourceCol,
      [destination.droppableId]: destCol,
    }));

    await updateLeadStatus(draggableId, destination.droppableId);
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 select-none">
        {COLUMNS.map((col) => (
          <div key={col.id} className="w-60 flex-shrink-0 flex flex-col">
            {/* Header */}
            <div
              className={`${col.headerBg} rounded-t-xl px-3 py-2.5 flex items-center justify-between`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${col.headerText}`}
                >
                  {col.label}
                </span>
              </div>
              <span
                className={`text-xs font-bold tabular-nums ${col.headerText}`}
              >
                {board[col.id].length}
              </span>
            </div>

            {/* Drop zone */}
            <Droppable droppableId={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 min-h-[120px] rounded-b-xl p-2 space-y-2 transition-colors duration-150 ${
                    snapshot.isDraggingOver ? "bg-zinc-200/70" : "bg-zinc-100/80"
                  }`}
                >
                  {board[col.id].map((lead, index) => (
                    <Draggable
                      key={lead.id}
                      draggableId={lead.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`rounded-lg border bg-white px-3 py-3 transition-shadow cursor-grab active:cursor-grabbing ${
                            snapshot.isDragging
                              ? "shadow-lg ring-2 ring-primary/20 rotate-1"
                              : "border-zinc-200 shadow-sm hover:shadow-md"
                          }`}
                        >
                          <p className="text-sm font-semibold text-foreground leading-snug truncate">
                            {lead.full_name}
                          </p>

                          {lead.headline && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              {lead.headline}
                            </p>
                          )}

                          <div className="mt-2.5 flex items-center justify-between">
                            <span className="text-[10px] text-zinc-400 tabular-nums">
                              {new Date(lead.created_at).toLocaleDateString(
                                "es-PE",
                                { day: "2-digit", month: "short" }
                              )}
                            </span>
                            <span className="h-5 w-5 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[9px] font-bold text-white">
                              {lead.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
