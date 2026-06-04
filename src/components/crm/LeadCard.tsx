"use client";

import { useState } from "react";
import { Archive, ClipboardCopy, Eye, MessageSquare, Trash2, X, Zap } from "lucide-react";
import type { CrmLead } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-pink-500",  "bg-indigo-600", "bg-sky-500",     "bg-orange-500",
  "bg-teal-500",  "bg-rose-500",   "bg-cyan-600",    "bg-fuchsia-500",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "ahora";
  if (mins  < 60) return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days  < 30) return `hace ${days}d`;
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function fmtValue(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(v % 1000 === 0 ? 0 : 1)}K`;
  return `$${v}`;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; cls: string }> = {
  nuevo:      { label: "Nuevo",      cls: "bg-blue-50   text-blue-700   ring-blue-200"   },
  contactado: { label: "Contactado", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  respondio:  { label: "Respondió",  cls: "bg-green-50  text-green-700  ring-green-200"  },
  "reunión":  { label: "Reunión",    cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  cerrado:    { label: "Cerrado",    cls: "bg-zinc-100  text-zinc-600   ring-zinc-200"   },
};

// ── Priority dot ──────────────────────────────────────────────────────────────

type Priority = "alta" | "media" | "baja";

function priorityDot(score?: number): { p: Priority; cls: string } {
  if (!score || score < 30) return { p: "baja",  cls: "bg-green-400" };
  if (score < 70)            return { p: "media", cls: "bg-amber-400" };
  return                            { p: "alta",  cls: "bg-red-400"   };
}

// ── Delete confirm inline ─────────────────────────────────────────────────────

function DeleteConfirm({ name, onConfirm, onCancel }: {
  name: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-red-300 bg-white/97 px-4 text-center backdrop-blur-sm">
      <p className="text-xs font-semibold text-zinc-800">¿Eliminar a <strong>{name}</strong>?</p>
      <p className="text-[10px] text-zinc-400">Esta acción no se puede deshacer.</p>
      <div className="flex gap-2">
        <button onClick={(e) => { e.stopPropagation(); onCancel(); }}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50">
          Cancelar
        </button>
        <button onClick={(e) => { e.stopPropagation(); onConfirm(); }}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-700">
          Eliminar
        </button>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LeadCardProps {
  lead: CrmLead;
  isDragging?: boolean;
  onView?: (lead: CrmLead) => void;
  onDelete?: (lead: CrmLead) => void;
  onArchive?: (lead: CrmLead) => void;
}

export function LeadCard({ lead, isDragging, onView, onDelete, onArchive }: LeadCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const statusInfo = STATUS[lead.status] ?? { label: lead.status, cls: "bg-zinc-100 text-zinc-500 ring-zinc-200" };
  const { cls: dotCls } = priorityDot(lead.score);

  function copyUrl(e: React.MouseEvent) {
    e.stopPropagation();
    if (lead.linkedinUrl) navigator.clipboard.writeText(lead.linkedinUrl);
  }

  return (
    <div
      className={[
        "group relative w-full rounded-xl border bg-white px-3.5 py-3 transition-all duration-150",
        "cursor-grab active:cursor-grabbing select-none",
        isDragging
          ? "rotate-1 scale-[1.03] border-indigo-200 shadow-2xl shadow-indigo-200/50 ring-2 ring-indigo-100"
          : "border-zinc-200 shadow-sm hover:shadow-md hover:border-zinc-300",
      ].join(" ")}
    >
      {showDeleteConfirm && (
        <DeleteConfirm
          name={lead.name}
          onConfirm={() => { setShowDeleteConfirm(false); onDelete?.(lead); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Priority dot */}
      <span
        className={`absolute right-3 top-3 h-2 w-2 rounded-full ${dotCls}`}
        title={`Prioridad ${priorityDot(lead.score).p}`}
      />

      {/* Row 1 — Avatar · Name */}
      <div className="flex items-start gap-2.5 pr-4">
        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarColor(lead.name)}`}>
          {initials(lead.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-zinc-900">{lead.name}</p>
          <p className="truncate text-[11px] text-zinc-500">{lead.company}</p>
        </div>
      </div>

      {/* Row 2 — Status + value */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${statusInfo.cls}`}>
          {statusInfo.label}
        </span>
        {lead.value > 0 && (
          <span className="text-[13px] font-bold tabular-nums text-zinc-800">{fmtValue(lead.value)}</span>
        )}
      </div>

      {/* Row 3 — Tags */}
      {lead.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {lead.tags.slice(0, 2).map((tag) => (
            <span key={tag.label} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
              {tag.label}
            </span>
          ))}
          {lead.tags.length > 2 && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-400">+{lead.tags.length - 2}</span>
          )}
        </div>
      )}

      {/* Row 4 — Date */}
      <div className="mt-2 flex items-center justify-between">
        <span className="truncate text-[10px] text-zinc-400">{relativeDate(lead.createdAt)}</span>
      </div>

      {/* Row 5 — next_task */}
      {lead.nextTask && (
        <div className="mt-2 border-t border-zinc-100 pt-2">
          <span className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 w-fit max-w-full">
            <Zap className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{lead.nextTask}</span>
          </span>
        </div>
      )}

      {/* Hover action bar */}
      <div className="absolute inset-x-0 bottom-0 hidden items-center justify-end gap-1 rounded-b-xl border-t border-zinc-100 bg-white/95 px-3 py-1.5 backdrop-blur-sm group-hover:flex">
        <button
          onClick={(e) => { e.stopPropagation(); onView?.(lead); }}
          title="Ver detalle"
          className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onView?.(lead); }}
          title="Mensaje IA"
          className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
        {lead.linkedinUrl && (
          <button
            onClick={copyUrl}
            title="Copiar URL de LinkedIn"
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
          </button>
        )}
        {onArchive && (
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(lead); }}
            title="Archivar lead"
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-amber-50 hover:text-amber-500 transition-colors"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
            title="Eliminar lead"
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        {showDeleteConfirm && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
