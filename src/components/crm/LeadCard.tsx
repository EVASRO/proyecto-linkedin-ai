"use client";

import { Clock, Globe, Link2, Mail, Phone, Users, Zap } from "lucide-react";
import type { CrmLead, TagColor } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-pink-500", "bg-indigo-600", "bg-sky-500", "bg-orange-500",
  "bg-teal-500", "bg-rose-500",   "bg-cyan-600", "bg-fuchsia-500",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function fmtValue(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : `$${v}`;
}

const TAG_CLS: Record<TagColor, string> = {
  blue:   "bg-blue-50   text-blue-700   ring-blue-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  green:  "bg-green-50  text-green-700  ring-green-200",
  amber:  "bg-amber-50  text-amber-700  ring-amber-200",
  red:    "bg-red-50    text-red-700    ring-red-200",
  pink:   "bg-pink-50   text-pink-700   ring-pink-200",
  sky:    "bg-sky-50    text-sky-700    ring-sky-200",
  gray:   "bg-zinc-100  text-zinc-600   ring-zinc-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

const SOURCE_ICON: Record<string, React.ElementType> = {
  LinkedIn: Link2,
  Web:      Globe,
  Email:    Mail,
  Llamada:  Phone,
  Referido: Users,
};

// ── Component ─────────────────────────────────────────────────────────────────

interface LeadCardProps {
  lead: CrmLead;
  isDragging?: boolean;
}

export function LeadCard({ lead, isDragging }: LeadCardProps) {
  const Icon = SOURCE_ICON[lead.source] ?? Globe;

  return (
    <div
      className={[
        "w-full rounded-xl border bg-white px-3.5 py-3 transition-all duration-150",
        "cursor-grab active:cursor-grabbing select-none",
        isDragging
          ? "rotate-1 scale-[1.03] border-indigo-200 shadow-2xl shadow-indigo-200/50 ring-2 ring-indigo-100"
          : "border-zinc-200 shadow-sm hover:border-zinc-300 hover:shadow-md",
      ].join(" ")}
    >
      {/* Row 1 — Avatar · Name · Date */}
      <div className="flex items-start gap-2.5">
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarColor(lead.name)}`}
        >
          {initials(lead.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-zinc-900">
              {lead.name}
            </p>
            <span className="flex-shrink-0 text-[10px] tabular-nums text-zinc-400">
              {fmtDate(lead.createdAt)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <p className="truncate text-[11px] text-zinc-500">{lead.company}</p>
            <span className="text-zinc-300">·</span>
            <p className="flex-shrink-0 text-[10px] text-zinc-400">#{lead.id}</p>
          </div>
        </div>
      </div>

      {/* Value */}
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="text-[17px] font-bold tabular-nums leading-none text-zinc-900">
          {fmtValue(lead.value)}
        </span>
        <span className="text-[10px] font-medium text-zinc-400">USD</span>
      </div>

      {/* Tags */}
      {lead.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.tags.map((tag) => (
            <span
              key={tag.label}
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${TAG_CLS[tag.color] ?? TAG_CLS.gray}`}
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {/* Extraction pending badge */}
      {lead.nextTask === "Extracción de perfil pendiente" && (
        <div className="mt-2">
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700 w-fit">
            <Clock className="h-2.5 w-2.5" /> Perfil pendiente
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-2.5 flex items-center justify-between border-t border-zinc-100 pt-2">
        <div className="flex items-center gap-1 text-zinc-400">
          <Icon className="h-3 w-3" />
          <span className="text-[10px]">{lead.source}</span>
        </div>
        {lead.nextTask && lead.nextTask !== "Extracción de perfil pendiente" ? (
          <div className="flex max-w-[130px] items-center gap-1">
            <Zap className="h-3 w-3 flex-shrink-0 text-amber-400" />
            <span className="truncate text-[10px] font-medium text-amber-600">
              {lead.nextTask}
            </span>
          </div>
        ) : (
          <span className="text-[10px] italic text-zinc-400">Sin tareas</span>
        )}
      </div>
    </div>
  );
}
