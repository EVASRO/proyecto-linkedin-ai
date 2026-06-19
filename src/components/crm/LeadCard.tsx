"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Archive, AtSign, ClipboardCopy, Clock, Eye,
  MessageSquare, Phone, Trash2, X, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrmLead } from "./types";
import { enqueueEnrichment } from "@/app/dashboard/crm/actions";

// -- Helpers -------------------------------------------------------------------

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

// -- Heat indicator -----------------------------------------------------------
// Hot  = activity within 3 days  → red
// Warm = within 7 days           → amber
// Cold = 7+ days                 → faint

function heatDot(daysInStage?: number) {
  const d = daysInStage ?? 0;
  if (d < 3) return "bg-[var(--danger)]";
  if (d < 7) return "bg-[var(--warning)]";
  return "bg-[var(--foreground-faint)]";
}

// -- Score badge --------------------------------------------------------------

function scoreBadge(score: number) {
  if (score >= 80) return "bg-[var(--warning-soft)] text-[var(--warning)]";
  if (score >= 50) return "bg-[rgba(124,58,237,0.12)] text-[#a78bfa]";
  return "bg-[var(--surface-hover)] text-[var(--foreground-muted)]";
}

// -- Delete confirm inline ----------------------------------------------------

function DeleteConfirm({ name, onConfirm, onCancel }: {
  name: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl
                    border border-[var(--danger)] bg-[var(--surface)]/95 px-4 text-center
                    backdrop-blur-sm">
      <p className="text-xs font-semibold text-[var(--foreground)]">
        ¿Eliminar a <strong>{name}</strong>?
      </p>
      <p className="text-[10px] text-[var(--foreground-muted)]">Esta acción no se puede deshacer.</p>
      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px]
                     font-semibold text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]
                     transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onConfirm(); }}
          className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition-colors"
          style={{ background: "var(--danger)" }}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

// -- Component -----------------------------------------------------------------

interface LeadCardProps {
  lead: CrmLead;
  isDragging?: boolean;
  onView?: (lead: CrmLead) => void;
  onDelete?: (lead: CrmLead) => void;
  onArchive?: (lead: CrmLead) => void;
}

export function LeadCard({ lead, isDragging, onView, onDelete, onArchive }: LeadCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [enrichStatus, setEnrichStatus] = useState<"idle" | "queued" | "error">("idle");

  async function handleEnrich(e: React.MouseEvent, type: "find_email" | "find_phone") {
    e.stopPropagation();
    if (!lead.linkedinUrl) return;
    setEnrichStatus("queued");
    const res = await enqueueEnrichment(lead.id, type, lead.linkedinUrl);
    if (!res.success) setEnrichStatus("error");
    setTimeout(() => setEnrichStatus("idle"), 3000);
  }

  function copyUrl(e: React.MouseEvent) {
    e.stopPropagation();
    if (lead.linkedinUrl) navigator.clipboard.writeText(lead.linkedinUrl);
  }

  return (
    <motion.div
      whileHover={isDragging ? {} : { y: -2, boxShadow: "var(--shadow-md)" }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "group relative w-full rounded-xl border bg-[var(--surface)] p-3.5",
        "cursor-grab active:cursor-grabbing select-none",
        "transition-[border-color,box-shadow] duration-150",
        isDragging
          ? "rotate-[1.5deg] scale-[1.03] border-[var(--primary)] shadow-[var(--shadow-glow-primary)]"
          : "border-[var(--border)] shadow-[var(--shadow-sm)]"
      )}
    >
      {showDeleteConfirm && (
        <DeleteConfirm
          name={lead.name}
          onConfirm={() => { setShowDeleteConfirm(false); onDelete?.(lead); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Heat dot / Score badge ------------------------------------------------ */}
      {(lead.score ?? 0) > 0 ? (
        <div
          className={cn(
            "absolute right-3 top-3 flex h-5 w-8 items-center justify-center",
            "rounded-full text-[9px] font-bold",
            scoreBadge(lead.score ?? 0)
          )}
          title={`Score: ${lead.score}`}
        >
          {lead.score}
        </div>
      ) : (
        <span
          className={cn("absolute right-3 top-3 h-2 w-2 rounded-full", heatDot(lead.daysInStage))}
          title={`Actividad: ${lead.daysInStage ?? 0}d`}
        />
      )}

      {/* Row 1 — Avatar · Name ------------------------------------------------ */}
      <div className="flex items-start gap-2.5 pr-8">
        <div className="relative flex-shrink-0">
          {lead.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lead.avatarUrl}
              alt={lead.name}
              className="h-9 w-9 rounded-full object-cover ring-1 ring-[var(--border)]"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full
                         text-[11px] font-bold text-white"
              style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
            >
              {initials(lead.name)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-[var(--foreground)]">
            {lead.name}
          </p>
          <p className="truncate text-[11px] text-[var(--foreground-muted)] leading-tight mt-0.5">
            {lead.headline ?? lead.company}
          </p>
        </div>
      </div>

      {/* Row 2 — Tags --------------------------------------------------------- */}
      {lead.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.tags.slice(0, 2).map((tag) => (
            <span
              key={tag.label}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-hover)]
                         px-2 py-0.5 text-[10px] font-medium text-[var(--foreground-muted)]"
            >
              {tag.label}
            </span>
          ))}
          {lead.tags.length > 2 && (
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-hover)]
                             px-2 py-0.5 text-[10px] text-[var(--foreground-faint)]">
              +{lead.tags.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Row 3 — Next automation task ----------------------------------------- */}
      {(lead.nextPendingTask ?? lead.nextTask) && (
        <div className="mt-2">
          <span className="flex w-fit max-w-full items-center gap-1 rounded-md
                           bg-[var(--warning-soft)] px-2 py-0.5
                           text-[10px] font-medium text-[var(--warning)]">
            <Zap className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{lead.nextPendingTask ?? lead.nextTask}</span>
          </span>
        </div>
      )}

      {/* Row 4 — Days-in-stage alert ------------------------------------------ */}
      {(lead.daysInStage ?? 0) > 3 && (
        <div className={cn(
          "mt-2 flex items-center gap-1 rounded-lg px-2 py-1 border",
          (lead.daysInStage ?? 0) > 7
            ? "bg-[var(--danger-soft)] border-[rgba(239,68,68,0.2)]"
            : "bg-[var(--warning-soft)] border-[rgba(245,158,11,0.2)]"
        )}>
          <Clock className={cn(
            "h-3 w-3 flex-shrink-0",
            (lead.daysInStage ?? 0) > 7 ? "text-[var(--danger)]" : "text-[var(--warning)]"
          )} />
          <span className={cn(
            "text-[9px] font-medium",
            (lead.daysInStage ?? 0) > 7 ? "text-[var(--danger)]" : "text-[var(--warning)]"
          )}>
            {(lead.daysInStage ?? 0) > 7 ? "⚠ " : ""}
            {lead.daysInStage}d en esta etapa
          </span>
        </div>
      )}

      {/* Row 5 — Footer: campaign · date --------------------------------------- */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {lead.campaignName ? (
          <span className="flex min-w-0 items-center gap-1 text-[10px] text-[var(--foreground-faint)] truncate">
            <Zap className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{lead.campaignName}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="flex-shrink-0 text-[10px] text-[var(--foreground-faint)]">
          {relativeDate(lead.createdAt)}
        </span>
      </div>

      {/* Value chip ----------------------------------------------------------- */}
      {lead.value > 0 && (
        <div className="mt-1.5 flex justify-end">
          <span className="text-[11px] font-bold tabular-nums text-[var(--foreground-muted)]">
            {fmtValue(lead.value)}
          </span>
        </div>
      )}

      {/* Hover action bar ----------------------------------------------------- */}
      <div className="absolute inset-x-0 bottom-0 hidden items-center justify-end gap-1
                      rounded-b-xl border-t border-[var(--border)]
                      bg-[var(--surface)]/95 px-3 py-1.5 backdrop-blur-sm group-hover:flex">
        <button
          onClick={(e) => { e.stopPropagation(); onView?.(lead); }}
          title="Ver detalle"
          className="flex h-6 w-6 items-center justify-center rounded-md
                     text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]
                     hover:text-[var(--foreground)] transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onView?.(lead); }}
          title="Mensaje IA"
          className="flex h-6 w-6 items-center justify-center rounded-md
                     text-[var(--foreground-muted)] hover:bg-[var(--primary-soft)]
                     hover:text-[var(--primary)] transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
        {lead.linkedinUrl && (
          <button
            onClick={copyUrl}
            title="Copiar URL de LinkedIn"
            className="flex h-6 w-6 items-center justify-center rounded-md
                       text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]
                       hover:text-[var(--foreground)] transition-colors"
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
          </button>
        )}
        {lead.email ? (
          <span
            title={lead.email}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgba(16,185,129,0.12)] text-[#10B981]"
          >
            <AtSign className="h-3.5 w-3.5" />
          </span>
        ) : lead.linkedinUrl ? (
          <button
            onClick={(e) => handleEnrich(e, "find_email")}
            title={enrichStatus === "queued" ? "Email encolado ✓" : "Buscar Email"}
            disabled={enrichStatus === "queued"}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
              enrichStatus === "queued"
                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                : "text-[var(--foreground-muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
            )}
          >
            <AtSign className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {lead.phone ? (
          <span
            title={lead.phone}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgba(16,185,129,0.12)] text-[#10B981]"
          >
            <Phone className="h-3.5 w-3.5" />
          </span>
        ) : lead.linkedinUrl ? (
          <button
            onClick={(e) => handleEnrich(e, "find_phone")}
            title={enrichStatus === "queued" ? "Teléfono encolado ✓" : "Buscar Teléfono"}
            disabled={enrichStatus === "queued"}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
              enrichStatus === "queued"
                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                : "text-[var(--foreground-muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
            )}
          >
            <Phone className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {onArchive && (
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(lead); }}
            title="Archivar lead"
            className="flex h-6 w-6 items-center justify-center rounded-md
                       text-[var(--foreground-muted)] hover:bg-[var(--warning-soft)]
                       hover:text-[var(--warning)] transition-colors"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
            title="Eliminar lead"
            className="flex h-6 w-6 items-center justify-center rounded-md
                       text-[var(--foreground-muted)] hover:bg-[var(--danger-soft)]
                       hover:text-[var(--danger)] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        {showDeleteConfirm && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
            className="flex h-6 w-6 items-center justify-center rounded-md
                       text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
