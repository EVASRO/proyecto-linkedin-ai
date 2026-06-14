"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Archive, ArrowUpRight, Bot, Calendar, CheckCircle2, ClipboardCopy,
  Clock, Loader2, MessageSquare, MoreVertical, Sparkles, Trash2,
  UserPlus, X, Zap,
} from "lucide-react";
import type { CrmLead } from "./types";
import { archiveLead, deleteLead, updateLead } from "@/app/dashboard/crm/actions";

// -- Helpers -------------------------------------------------------------------

const AVATAR_PALETTE = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-pink-500",  "bg-indigo-600", "bg-sky-500",     "bg-orange-500",
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
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const mins  = Math.floor(diff / 60000);
  if (mins  < 1)  return "ahora";
  if (mins  < 60) return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days  < 30) return `hace ${days}d`;
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

// -- Status badge --------------------------------------------------------------

const STATUS_OPTS = [
  { value: "nuevo",      label: "Nuevo",      cls: "bg-[rgba(37,99,235,0.12)] text-[#2563EB] ring-[rgba(37,99,235,0.25)]"       },
  { value: "contactado", label: "Contactado", cls: "bg-[rgba(37,99,235,0.18)] text-[#2563EB] ring-[rgba(37,99,235,0.3)]"        },
  { value: "respondio",  label: "Respondió",  cls: "bg-[rgba(16,185,129,0.12)] text-[#10B981] ring-[rgba(16,185,129,0.25)]"     },
  { value: "reunión",    label: "Reunión",    cls: "bg-[rgba(16,185,129,0.18)] text-[#10B981] ring-[rgba(16,185,129,0.3)]"      },
  { value: "cerrado",    label: "Cerrado",    cls: "bg-[rgba(255,255,255,0.06)] text-[var(--foreground-muted)] ring-[var(--border)]" },
];

// -- Mock timeline (in real app, fetch from activity_log) ---------------------

type TimelineEvent = {
  id: string;
  type: "connect" | "message" | "reply" | "meeting" | "note";
  label: string;
  ts: string;
};

const EVENT_ICON: Record<TimelineEvent["type"], React.ElementType> = {
  connect: UserPlus,
  message: MessageSquare,
  reply:   Zap,
  meeting: Calendar,
  note:    Sparkles,
};

const EVENT_COLOR: Record<TimelineEvent["type"], string> = {
  connect: "bg-[rgba(37,99,235,0.12)] text-[#2563EB]",
  message: "bg-[rgba(37,99,235,0.18)] text-[#2563EB]",
  reply:   "bg-[rgba(16,185,129,0.12)] text-[#10B981]",
  meeting: "bg-[rgba(16,185,129,0.18)] text-[#10B981]",
  note:    "bg-[rgba(245,158,11,0.12)] text-[#F59E0B]",
};

function buildTimeline(lead: CrmLead): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { id: "e1", type: "connect", label: "Solicitud de conexión enviada", ts: lead.createdAt },
  ];
  if (["contactado", "respondio", "reunión", "cerrado"].includes(lead.status)) {
    events.push({ id: "e2", type: "message", label: "Primer mensaje enviado", ts: lead.createdAt });
  }
  if (["respondio", "reunión", "cerrado"].includes(lead.status)) {
    events.push({ id: "e3", type: "reply", label: "Lead respondió el mensaje", ts: lead.createdAt });
  }
  if (["reunión", "cerrado"].includes(lead.status)) {
    events.push({ id: "e4", type: "meeting", label: "Reunión agendada", ts: lead.createdAt });
  }
  return events.reverse();
}

// -- Sub-components ------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2 py-1.5 border-b border-[var(--border)] last:border-0">
      <span className="w-24 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">{label}</span>
      <span className="text-xs text-[var(--foreground-muted)] break-all">{value}</span>
    </div>
  );
}

// -- Main component ------------------------------------------------------------

interface LeadModalProps {
  lead: CrmLead;
  onClose: () => void;
  onStageChange: (leadId: string, newStatus: string) => void;
  onDeleted?: (leadId: string) => void;
  onArchived?: (leadId: string) => void;
}

export function LeadModal({ lead, onClose, onStageChange, onDeleted, onArchived }: LeadModalProps) {
  const [currentStatus, setCurrentStatus] = useState(lead.status);
  const [notes, setNotes]                 = useState(lead.nextTask ?? "");
  const [notesSaved, setNotesSaved]       = useState(false);
  const [generatingMsg, setGeneratingMsg] = useState(false);
  const [generatedMsg, setGeneratedMsg]   = useState("");
  const [isPending, startTransition]      = useTransition();
  const debounceRef                       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen]           = useState(false);
  const [confirmAction, setConfirmAction] = useState<"delete" | "archive" | null>(null);
  const menuRef                           = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  function handleMenuDelete() {
    setMenuOpen(false);
    setConfirmAction("delete");
  }

  function handleMenuArchive() {
    setMenuOpen(false);
    setConfirmAction("archive");
  }

  function handleConfirmDismiss() {
    setConfirmAction(null);
  }

  function handleConfirmExecute() {
    if (confirmAction === "delete") {
      startTransition(async () => {
        const res = await deleteLead(lead.id);
        if (res.success) {
          onDeleted?.(lead.id);
          onClose();
        }
        setConfirmAction(null);
      });
    } else if (confirmAction === "archive") {
      startTransition(async () => {
        const res = await archiveLead(lead.id);
        if (res.success) {
          onArchived?.(lead.id);
          onClose();
        }
        setConfirmAction(null);
      });
    }
  }

  const timeline = buildTimeline(lead);

  // Auto-save notes with 2s debounce
  useEffect(() => {
    if (notes === (lead.nextTask ?? "")) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        await updateLead(lead.id, { next_task: notes });
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      });
    }, 2000);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  function handleStatusChange(newStatus: string) {
    setCurrentStatus(newStatus);
    onStageChange(lead.id, newStatus);
    startTransition(async () => {
      await updateLead(lead.id, { status: newStatus });
    });
  }

  function handleQuickAction(action: "message" | "followup" | "close") {
    if (action === "close") handleStatusChange("cerrado");
    if (action === "message") setNotes((n) => n ? n : "Enviar mensaje de seguimiento");
    if (action === "followup") setNotes((n) => n ? n : "Agendar follow-up en 3 días");
  }

  async function handleGenerateMessage() {
    setGeneratingMsg(true);
    setGeneratedMsg("");
    try {
      const res = await fetch("/api/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:    lead.name,
          company: lead.company,
          status:  currentStatus,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { message?: string };
        setGeneratedMsg(data.message ?? "No se pudo generar el mensaje.");
      } else {
        setGeneratedMsg("Hola {{nombre}}, te escribo para hacer un seguimiento rápido...");
      }
    } catch {
      setGeneratedMsg("Hola {{nombre}}, te escribo para hacer un seguimiento rápido...");
    } finally {
      setGeneratingMsg(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        style={{ height: "calc(100vh - 64px)" }}
      >
        {/* -- Header -- */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3.5">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(lead.name)}`}>
            {initials(lead.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--foreground)] leading-tight">{lead.name}</p>
            <p className="text-[11px] text-[var(--foreground-muted)]">{lead.company}</p>
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_OPTS.map((s) => (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                className={[
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset transition-all",
                  currentStatus === s.value ? s.cls + " scale-105" : "bg-[rgba(255,255,255,0.04)] text-[var(--foreground-faint)] ring-[var(--border)] hover:bg-[rgba(255,255,255,0.08)]",
                ].join(" ")}
              >
                {s.label}
              </button>
            ))}
          </div>

          {lead.linkedinUrl && (
            <a
              href={lead.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            >
              LinkedIn
              <ArrowUpRight className="h-3 w-3 opacity-60" />
            </a>
          )}

          {/* ⋮ dropdown */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-lg p-1.5 text-[var(--foreground-faint)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--foreground-muted)] transition-colors"
              title="Más acciones"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
                {lead.linkedinUrl && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(lead.linkedinUrl!); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.06)]"
                  >
                    <ClipboardCopy className="h-3.5 w-3.5 text-[var(--foreground-faint)]" />
                    Copiar URL LinkedIn
                  </button>
                )}
                <div className="my-1 h-px bg-[var(--border)]" />
                <button
                  onClick={handleMenuArchive}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-[var(--foreground-muted)] hover:bg-[rgba(245,158,11,0.08)]"
                >
                  <Archive className="h-3.5 w-3.5 text-[var(--foreground-faint)]" />
                  Archivar lead
                </button>
                <button
                  onClick={handleMenuDelete}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar lead
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--foreground-faint)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--foreground-muted)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* -- Confirm overlay -- */}
        {confirmAction && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                <h3 className="text-sm font-bold text-[var(--foreground)]">
                  {confirmAction === "delete" ? "Eliminar lead" : "Archivar lead"}
                </h3>
                <button onClick={handleConfirmDismiss} className="rounded-lg p-1.5 text-[var(--foreground-faint)] hover:bg-[rgba(255,255,255,0.06)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-[var(--foreground-muted)]">
                  {confirmAction === "delete"
                    ? `¿Eliminar a "${lead.name}"? Esta acción no se puede deshacer.`
                    : `¿Archivar a "${lead.name}"? Puedes reactivarlo después.`}
                </p>
              </div>
              <div className="flex gap-3 border-t border-[var(--border)] bg-[var(--background)] px-5 py-4">
                <button
                  onClick={handleConfirmDismiss}
                  className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-xs font-semibold text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.06)]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmExecute}
                  disabled={isPending}
                  className={[
                    "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-60",
                    confirmAction === "delete"
                      ? "bg-[#EF4444] hover:bg-[rgba(239,68,68,0.85)]"
                      : "bg-[#F59E0B] hover:bg-[rgba(245,158,11,0.85)]",
                  ].join(" ")}
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {confirmAction === "delete" ? "Eliminar" : "Archivar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* -- Body: 2-col layout -- */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left column — info + notes + quick actions */}
          <div className="flex w-80 flex-shrink-0 flex-col gap-4 overflow-y-auto border-r border-[var(--border)] p-5">

            {/* Contact info */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-faint)]">Información</p>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-1">
                <InfoRow label="Empresa"  value={lead.company} />
                <InfoRow label="Email"    value={lead.email} />
                <InfoRow label="Teléfono" value={lead.phone} />
                <InfoRow label="LinkedIn" value={lead.linkedinUrl} />
                <InfoRow label="Valor"    value={lead.value ? `$${lead.value.toLocaleString()}` : null} />
                <InfoRow label="Creado"   value={relativeDate(lead.createdAt)} />
              </div>
            </div>

            {/* Tags */}
            {lead.tags.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-faint)]">Etiquetas</p>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map((t) => (
                    <span key={t.label} className="rounded-full bg-[rgba(255,255,255,0.06)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--foreground-muted)]">
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Próxima acción */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-faint)]">Próxima acción</p>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => handleQuickAction("message")}
                  className="flex items-center gap-2 rounded-lg border border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.12)] px-3 py-2 text-xs font-semibold text-[#2563EB] hover:bg-[rgba(37,99,235,0.18)] transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Enviar mensaje
                </button>
                <button
                  onClick={() => handleQuickAction("followup")}
                  className="flex items-center gap-2 rounded-lg border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.12)] px-3 py-2 text-xs font-semibold text-[#F59E0B] hover:bg-[rgba(245,158,11,0.18)] transition-colors"
                >
                  <Clock className="h-3.5 w-3.5" /> Agendar follow-up
                </button>
                <button
                  onClick={() => handleQuickAction("close")}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-semibold text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como cerrado
                </button>
              </div>
            </div>

            {/* Notes with auto-save */}
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-faint)]">Notas</p>
                {isPending && <Loader2 className="h-3 w-3 animate-spin text-[var(--foreground-faint)]" />}
                {notesSaved && <span className="text-[10px] text-[#10B981] font-medium">✓ Guardado</span>}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder="Añade notas sobre este lead..."
                className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
              />
            </div>

            {/* Generate message IA */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-faint)]">Mensaje IA</p>
              <button
                onClick={handleGenerateMessage}
                disabled={generatingMsg}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(37,99,235,0.25)] bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-3 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {generatingMsg
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Bot className="h-3.5 w-3.5" />}
                Generar mensaje IA
              </button>
              {generatedMsg && (
                <div className="mt-2 rounded-xl border border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.08)] p-3">
                  <p className="text-[11px] leading-relaxed text-[var(--foreground-muted)]">{generatedMsg}</p>
                  <button
                    onClick={() => { setNotes(generatedMsg); setGeneratedMsg(""); }}
                    className="mt-2 text-[10px] font-semibold text-[#2563EB] hover:text-[#06B6D4]"
                  >
                    Usar como nota →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right column — timeline */}
          <div className="flex flex-1 flex-col overflow-y-auto p-5">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-faint)]">Actividad</p>

            {timeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-2 text-[var(--foreground-faint)]">
                <Sparkles className="h-8 w-8 opacity-30" />
                <p className="text-xs font-medium">Sin actividad registrada</p>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--border)]" />

                <div className="space-y-4">
                  {timeline.map((ev) => {
                    const Icon = EVENT_ICON[ev.type];
                    return (
                      <div key={ev.id} className="relative flex items-start gap-4 pl-10">
                        <div className={`absolute left-1.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${EVENT_COLOR[ev.type]}`}>
                          <Icon className="h-2.5 w-2.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[var(--foreground)]">{ev.label}</p>
                          <p className="mt-0.5 text-[10px] text-[var(--foreground-faint)]">{relativeDate(ev.ts)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* "Hoy" anchor */}
                <div className="relative mt-6 flex items-center gap-4 pl-10">
                  <div className="absolute left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(255,255,255,0.06)]">
                    <Clock className="h-2.5 w-2.5 text-[var(--foreground-faint)]" />
                  </div>
                  <p className="text-[10px] text-[var(--foreground-faint)] italic">Hoy — en espera de próxima acción</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
