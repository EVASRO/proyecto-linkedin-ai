"use client";

import { useState } from "react";
import {
  ArrowRight, Bot, Calendar, ChevronDown, ExternalLink,
  Link2, Mail, MessageSquare, Phone, User, X, Zap,
} from "lucide-react";
import type { InboxLead, Message, PipelineStage } from "./types";

const STAGES: { id: PipelineStage; label: string }[] = [
  { id: "leads_entrantes", label: "Lead Entrante"    },
  { id: "en_contacto",     label: "En Contacto"      },
  { id: "demo_agendada",   label: "Demo Agendada"    },
  { id: "propuesta",       label: "Propuesta"        },
  { id: "cerrado",         label: "Cerrado / Ganado" },
  { id: "perdido",         label: "Perdido"          },
];

const STAGE_IDX: Record<PipelineStage, number> = {
  leads_entrantes: 0,
  en_contacto:     1,
  demo_agendada:   2,
  propuesta:       3,
  cerrado:         4,
  perdido:         4,
};

function avatarColor(name: string): string {
  const palette = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#DB2777", "#0891B2"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function buildActivityFromMessages(messages: Message[]) {
  if (messages.length === 0) return [];
  return messages.slice(-5).map((m) => ({
    text: m.sender === "ai"   ? "Autopilot envió mensaje"
        : m.sender === "user" ? "Tú enviaste mensaje"
        : "Prospecto respondió",
    time: new Date(m.timestamp).toLocaleDateString("es", { day: "numeric", month: "short" }),
    color: m.sender === "ai"   ? "#7C3AED"
         : m.sender === "user" ? "#2563EB"
         : "#10B981",
  }));
}

interface LeadDetailPanelProps {
  lead: InboxLead;
  messages?: Message[];
  onClose: () => void;
  onStageChange: (leadId: string, stage: PipelineStage) => void;
  autopilotActive?: boolean;
  autopilotMode?: "auto" | "review";
  onToggleAutopilot?: (active: boolean) => void;
  onChangeAutopilotMode?: (mode: "auto" | "review") => void;
}

export function LeadDetailPanel({
  lead,
  messages,
  onClose,
  onStageChange,
  autopilotActive = false,
  autopilotMode   = "review",
  onToggleAutopilot,
  onChangeAutopilotMode,
}: LeadDetailPanelProps) {
  const [notes, setNotes]     = useState(lead.notes);
  const [stage, setStage]     = useState<PipelineStage>(lead.pipeline);
  const [stageOpen, setStageOpen] = useState(false);

  const activity    = buildActivityFromMessages(messages ?? []);
  const stageIndex  = STAGE_IDX[stage] ?? 0;
  const totalStages = 5;
  const progressPct = Math.round(((stageIndex + 1) / totalStages) * 100);

  function handleStageSelect(s: PipelineStage) {
    setStage(s);
    setStageOpen(false);
    onStageChange(lead.id, s);
  }

  return (
    <div
      className="hidden xl:flex w-72 flex-shrink-0 flex-col overflow-hidden border-l"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3.5"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--foreground-faint)" }}>
          Perfil del Lead
        </span>
        <button
          onClick={onClose}
          className="rounded-lg p-1 transition-colors"
          style={{ color: "var(--foreground-faint)" }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Avatar + identity */}
        <div className="flex flex-col items-center px-4 py-5 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white"
            style={{ background: avatarColor(lead.name), boxShadow: "var(--shadow-md)" }}
          >
            {initials(lead.name)}
          </div>
          <h3 className="mt-3 text-sm font-bold" style={{ color: "var(--foreground)" }}>{lead.name}</h3>
          {lead.title && (
            <p className="mt-0.5 text-xs" style={{ color: "var(--foreground-faint)" }}>{lead.title}</p>
          )}
          <p className="text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>{lead.company}</p>

          {lead.value > 0 && (
            <div
              className="mt-2 rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}
            >
              ${lead.value >= 1000 ? `${(lead.value / 1000).toFixed(0)}K` : lead.value} USD
            </div>
          )}

          {lead.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap justify-center gap-1">
              {lead.tags.map((t) => (
                <span key={t.label} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t.color}`}>{t.label}</span>
              ))}
            </div>
          )}
        </div>

        {/* Campaign / Pipeline section */}
        <div
          className="border-t px-4 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <p
            className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--foreground-faint)" }}
          >
            <Zap className="h-3 w-3" /> En campaña
          </p>

          {/* Stage picker */}
          <div className="relative">
            <button
              onClick={() => setStageOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all"
              style={{ background: "var(--surface-hover)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
            >
              {STAGES.find((s) => s.id === stage)?.label ?? "—"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${stageOpen ? "rotate-180" : ""}`} />
            </button>
            {stageOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStageOpen(false)} />
                <div
                  className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl shadow-2xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  {STAGES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleStageSelect(s.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--surface-hover)]"
                      style={{
                        color: stage === s.id ? "var(--foreground)" : "var(--foreground-muted)",
                        fontWeight: stage === s.id ? 700 : 400,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                        style={{ background: stage === s.id ? "#2563EB" : "transparent", border: stage === s.id ? "none" : "1px solid var(--border)" }}
                      />
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px]" style={{ color: "var(--foreground-faint)" }}>Progreso</span>
              <span className="text-[10px] font-bold" style={{ color: "#2563EB" }}>{progressPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #2563EB, #06B6D4)" }}
              />
            </div>
          </div>
        </div>

        {/* Activity timeline */}
        <div
          className="border-t px-4 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <p
            className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--foreground-faint)" }}
          >
            <Calendar className="h-3 w-3" /> Actividad
          </p>
          {activity.length === 0 ? (
            <p className="text-[11px] italic" style={{ color: "var(--foreground-faint)" }}>Sin actividad registrada.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div
                    className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: a.color }}
                  />
                  <div>
                    <p className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>{a.text}</p>
                    <p className="text-[10px]" style={{ color: "var(--foreground-faint)" }}>{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact info */}
        <div
          className="border-t px-4 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <p
            className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--foreground-faint)" }}
          >
            <User className="h-3 w-3" /> Contacto
          </p>
          <div className="space-y-2">
            {lead.email && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--foreground-muted)" }}>
                <Mail className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--foreground-faint)" }} />
                <a href={`mailto:${lead.email}`} className="truncate hover:text-[#2563EB]">{lead.email}</a>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--foreground-muted)" }}>
                <Phone className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--foreground-faint)" }} />
                <a href={`tel:${lead.phone}`} className="hover:text-[#2563EB]">{lead.phone}</a>
              </div>
            )}
            {lead.linkedinUrl && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--foreground-muted)" }}>
                <Link2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--foreground-faint)" }} />
                <a
                  href={lead.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-[#2563EB]"
                >
                  LinkedIn <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div
          className="border-t px-4 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <p
            className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--foreground-faint)" }}
          >
            <MessageSquare className="h-3 w-3" /> Notas
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Añade una nota sobre este lead..."
            className="w-full resize-none rounded-lg px-2.5 py-2 text-xs focus:outline-none transition-colors"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#2563EB"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
        </div>

        {/* Autopilot control */}
        {onToggleAutopilot && (
          <div
            className="border-t px-4 py-4"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center justify-between rounded-xl p-3"
              style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}
            >
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-400" />
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Autopilot IA</p>
                  <p className="text-[10px]" style={{ color: "var(--foreground-faint)" }}>
                    {autopilotMode === "auto" ? "Envío automático" : "Revisar antes de enviar"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <button
                  onClick={() => onToggleAutopilot(!autopilotActive)}
                  className="relative h-5 w-9 rounded-full transition-colors"
                  style={{ background: autopilotActive ? "#7C3AED" : "var(--border)" }}
                >
                  <div
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                    style={{ transform: autopilotActive ? "translateX(18px)" : "translateX(2px)" }}
                  />
                </button>
                {autopilotActive && onChangeAutopilotMode && (
                  <select
                    value={autopilotMode}
                    onChange={(e) => onChangeAutopilotMode(e.target.value as "auto" | "review")}
                    className="rounded px-1 py-0.5 text-[10px] focus:outline-none"
                    style={{ background: "var(--surface)", border: "1px solid rgba(124,58,237,0.3)", color: "#7C3AED" }}
                  >
                    <option value="review">Revisar antes</option>
                    <option value="auto">Auto-enviar</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div
          className="border-t px-4 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex flex-col gap-2">
            <button
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors"
              style={{ background: "var(--surface-hover)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Mover a CRM
            </button>
            <button
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors"
              style={{ background: "var(--surface-hover)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Agregar nota
            </button>
            {autopilotActive && onToggleAutopilot && (
              <button
                onClick={() => onToggleAutopilot(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors"
                style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <Bot className="h-3.5 w-3.5" />
                Desactivar Autopilot
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
