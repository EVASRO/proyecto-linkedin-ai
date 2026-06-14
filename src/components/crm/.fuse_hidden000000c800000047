"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Archive, ArrowUpRight, Bot, Calendar, CheckCircle2, ClipboardCopy,
  Clock, Loader2, MessageSquare, MoreVertical, Sparkles, Trash2,
  UserPlus, X, Zap,
} from "lucide-react";
import type { CrmLead } from "./types";
import { archiveLead, deleteLead, updateLead } from "@/app/dashboard/crm/actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_OPTS = [
  { value: "nuevo",      label: "Nuevo",      cls: "bg-blue-50 text-blue-700 ring-blue-200"       },
  { value: "contactado", label: "Contactado", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  { value: "respondio",  label: "Respondió",  cls: "bg-green-50 text-green-700 ring-green-200"    },
  { value: "reunión",    label: "Reunión",    cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "cerrado",    label: "Cerrado",    cls: "bg-zinc-100 text-zinc-600 ring-zinc-200"      },
];

// ── Mock timeline (in real app, fetch from activity_log) ─────────────────────

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
  connect: "bg-blue-50 text-blue-600",
  message: "bg-indigo-50 text-indigo-600",
  reply:   "bg-green-50 text-green-600",
  meeting: "bg-emerald-50 text-emerald-700",
  note:    "bg-amber-50 text-amber-600",
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

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2 py-1.5 border-b border-zinc-50 last:border-0">
      <span className="w-24 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="text-xs text-zinc-700 break-all">{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
        className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        style={{ height: "calc(100vh - 64px)" }}
      >
        {/* ── Header ── */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-zinc-100 bg-white px-5 py-3.5">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(lead.name)}`}>
            {initials(lead.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-zinc-900 leading-tight">{lead.name}</p>
            <p className="text-[11px] text-zinc-500">{lead.company}</p>
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_OPTS.map((s) => (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                className={[
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset transition-all",
                  currentStatus === s.value ? s.cls + " scale-105" : "bg-zinc-50 text-zinc-400 ring-zinc-200 hover:bg-zinc-100",
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
              className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              LinkedIn
              <ArrowUpRight className="h-3 w-3 opacity-60" />
            </a>
          )}

          {/* ⋮ dropdown */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
              title="Más acciones"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
                {lead.linkedinUrl && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(lead.linkedinUrl!); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    <ClipboardCopy className="h-3.5 w-3.5 text-zinc-400" />
                    Copiar URL LinkedIn
                  </button>
                )}
                <div className="my-1 h-px bg-zinc-100" />
                <button
                  onClick={handleMenuArchive}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-700 hover:bg-amber-50"
                >
                  <Archive className="h-3.5 w-3.5 text-zinc-400" />
                  Archivar lead
                </button>
                <button
                  onClick={handleMenuDelete}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar lead
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Confirm overlay ── */}
        {confirmAction && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
                <h3 className="text-sm font-bold text-zinc-900">
                  {confirmAction === "delete" ? "Eliminar lead" : "Archivar lead"}
                </h3>
                <button onClick={handleConfirmDismiss} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-zinc-600">
                  {confirmAction === "delete"
                    ? `¿Eliminar a "${lead.name}"? Esta acción no se puede deshacer.`
                    : `¿Archivar a "${lead.name}"? Puedes reactivarlo después.`}
                </p>
              </div>
              <div className="flex gap-3 border-t border-zinc-100 bg-zinc-50/60 px-5 py-4">
                <button
                  onClick={handleConfirmDismiss}
                  className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmExecute}
                  disabled={isPending}
                  className={[
                    "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-60",
                    confirmAction === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-amber-500 hover:bg-amber-600",
                  ].join(" ")}
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {confirmAction === "delete" ? "Eliminar" : "Archivar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Body: 2-col layout ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left column — info + notes + quick actions */}
          <div className="flex w-80 flex-shrink-0 flex-col gap-4 overflow-y-auto border-r border-zinc-100 p-5">

            {/* Contact info */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Información</p>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-3 py-1">
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
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Etiquetas</p>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map((t) => (
                    <span key={t.label} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-medium text-zinc-600">
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Próxima acción */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Próxima acción</p>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => handleQuickAction("message")}
                  className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Enviar mensaje
                </button>
                <button
                  onClick={() => handleQuickAction("followup")}
                  className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <Clock className="h-3.5 w-3.5" /> Agendar follow-up
                </button>
                <button
                  onClick={() => handleQuickAction("close")}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como cerrado
                </button>
              </div>
            </div>

            {/* Notes with auto-save */}
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Notas</p>
                {isPending && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
                {notesSaved && <span className="text-[10px] text-green-600 font-medium">✓ Guardado</span>}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder="Añade notas sobre este lead..."
                className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Generate message IA */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Mensaje IA</p>
              <button
                onClick={handleGenerateMessage}
                disabled={generatingMsg}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 px-3 py-2.5 text-xs font-semibold text-violet-700 hover:from-violet-100 hover:to-indigo-100 disabled:opacity-60 transition-all"
              >
                {generatingMsg
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Bot className="h-3.5 w-3.5" />}
                Generar mensaje IA
              </button>
              {generatedMsg && (
                <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50 p-3">
                  <p className="text-[11px] leading-relaxed text-violet-800">{generatedMsg}</p>
                  <button
                    onClick={() => { setNotes(generatedMsg); setGeneratedMsg(""); }}
                    className="mt-2 text-[10px] font-semibold text-violet-600 hover:text-violet-800"
                  >
                    Usar como nota →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right column — timeline */}
          <div className="flex flex-1 flex-col overflow-y-auto p-5">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Actividad</p>

            {timeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-2 text-zinc-400">
                <Sparkles className="h-8 w-8 opacity-30" />
                <p className="text-xs font-medium">Sin actividad registrada</p>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-zinc-100" />

                <div className="space-y-4">
                  {timeline.map((ev) => {
                    const Icon = EVENT_ICON[ev.type];
                    return (
                      <div key={ev.id} className="relative flex items-start gap-4 pl-10">
                        <div className={`absolute left-1.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${EVENT_COLOR[ev.type]}`}>
                          <Icon className="h-2.5 w-2.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-800">{ev.label}</p>
                          <p className="mt-0.5 text-[10px] text-zinc-400">{relativeDate(ev.ts)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* "Hoy" anchor */}
                <div className="relative mt-6 flex items-center gap-4 pl-10">
                  <div className="absolute left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100">
                    <Clock className="h-2.5 w-2.5 text-zinc-400" />
                  </div>
                  <p className="text-[10px] text-zinc-400 italic">Hoy — en espera de próxima acción</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
