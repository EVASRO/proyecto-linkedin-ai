"use client";

import { useState } from "react";
import {
  ArrowRight, Bot, Calendar, ChevronDown, ExternalLink,
  Globe, Link2, Mail, MapPin, MessageSquare, Phone,
  Tag, User, X, Zap,
} from "lucide-react";
import type { InboxLead, Message, PipelineStage } from "./types";

// ── Pipeline stages ───────────────────────────────────────────────────────────

const STAGES: { id: PipelineStage; label: string; color: string }[] = [
  { id: "leads_entrantes", label: "Lead Entrante",   color: "bg-blue-100 text-blue-700 border-blue-200"   },
  { id: "en_contacto",     label: "En Contacto",     color: "bg-sky-100 text-sky-700 border-sky-200"      },
  { id: "demo_agendada",   label: "Demo Agendada",   color: "bg-violet-100 text-violet-700 border-violet-200" },
  { id: "propuesta",       label: "Propuesta",       color: "bg-amber-100 text-amber-700 border-amber-200"  },
  { id: "cerrado",         label: "Cerrado / Ganado",color: "bg-green-100 text-green-700 border-green-200"  },
  { id: "perdido",         label: "Perdido",         color: "bg-red-100 text-red-600 border-red-200"       },
];

function avatarColor(name: string): string {
  const palette = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-pink-500", "bg-indigo-600"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-zinc-100 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{title}</span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface LeadDetailPanelProps {
  lead: InboxLead;
  onClose: () => void;
  onStageChange: (leadId: string, stage: PipelineStage) => void;
  autopilotActive?: boolean;
  autopilotMode?: "auto" | "review";
  onToggleAutopilot?: (active: boolean) => void;
  onChangeAutopilotMode?: (mode: "auto" | "review") => void;
}

// Timeline de actividad real construida desde los mensajes de la conversación
function buildActivityFromMessages(messages: Message[]) {
  if (messages.length === 0) return [];
  return messages.slice(-4).map((m) => ({
    text: m.sender === "ai"   ? "Autopilot envió mensaje"
        : m.sender === "user" ? "Tú enviaste mensaje"
        : "Prospecto respondió",
    time: new Date(m.timestamp).toLocaleDateString("es", { day: "numeric", month: "short" }),
    dot:  m.sender === "ai"   ? "bg-purple-400"
        : m.sender === "user" ? "bg-blue-400"
        : "bg-green-400",
  }));
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
}: LeadDetailPanelProps & { messages?: Message[] }) {
  const [notes, setNotes] = useState(lead.notes);
  const [stage, setStage] = useState<PipelineStage>(lead.pipeline);
  const [stageOpen, setStageOpen] = useState(false);

  const currentStage = STAGES.find((s) => s.id === stage) ?? STAGES[0];

  const activity = buildActivityFromMessages(messages ?? []);

  function handleStageSelect(s: PipelineStage) {
    setStage(s);
    setStageOpen(false);
    onStageChange(lead.id, s);
  }

  return (
    <div className="flex w-80 flex-shrink-0 flex-col overflow-hidden border-l border-border bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Perfil del Lead</span>
        <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Avatar + Name */}
        <div className="flex flex-col items-center px-4 py-5 text-center">
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-md ${avatarColor(lead.name)}`}>
            {initials(lead.name)}
          </div>
          <h3 className="mt-3 text-sm font-bold text-zinc-900">{lead.name}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{lead.title}</p>
          <p className="text-xs font-medium text-zinc-700">{lead.company}</p>

          {/* Value */}
          <div className="mt-2 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
            ${lead.value >= 1000 ? `${(lead.value / 1000).toFixed(0)}K` : lead.value} USD
          </div>

          {/* Tags */}
          <div className="mt-2.5 flex flex-wrap justify-center gap-1">
            {lead.tags.map((t) => (
              <span key={t.label} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t.color}`}>{t.label}</span>
            ))}
          </div>
        </div>

        {/* Pipeline Stage — Quick Signal */}
        <div className="border-t border-zinc-100 px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
            <Zap className="h-3.5 w-3.5" /> Etapa del pipeline
          </p>
          <div className="relative">
            <button
              onClick={() => setStageOpen((o) => !o)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${currentStage.color}`}
            >
              {currentStage.label}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${stageOpen ? "rotate-180" : ""}`} />
            </button>
            {stageOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStageOpen(false)} />
                <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
                  {STAGES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleStageSelect(s.id)}
                      className={[
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-50",
                        stage === s.id ? "font-bold text-zinc-900 bg-zinc-50" : "text-zinc-700",
                      ].join(" ")}
                    >
                      {stage === s.id && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
                      {stage !== s.id && <span className="h-1.5 w-1.5 rounded-full bg-transparent" />}
                      {s.label}
                      {stage === s.id && <span className="ml-auto text-indigo-500">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Autopilot mode toggle */}
        {onToggleAutopilot && (
          <div className="border-t border-zinc-100 px-4 py-3">
            <div className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-600" />
                <div>
                  <p className="text-xs font-semibold text-zinc-800">Autopilot IA</p>
                  <p className="text-[10px] text-zinc-500">
                    {autopilotMode === "auto" ? "Envío automático" : "Revisar antes de enviar"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <button
                  onClick={() => onToggleAutopilot(!autopilotActive)}
                  className={[
                    "relative h-5 w-9 rounded-full transition-colors",
                    autopilotActive ? "bg-violet-600" : "bg-zinc-300",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                      autopilotActive ? "translate-x-4" : "translate-x-0.5",
                    ].join(" ")}
                  />
                </button>
                {autopilotActive && onChangeAutopilotMode && (
                  <select
                    value={autopilotMode}
                    onChange={(e) => onChangeAutopilotMode(e.target.value as "auto" | "review")}
                    className="rounded border border-violet-200 bg-white px-1 py-0.5 text-[10px] text-violet-700 focus:outline-none"
                  >
                    <option value="review">Revisar antes</option>
                    <option value="auto">Auto-enviar</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Contact Info */}
        <Section title="Contacto" icon={User}>
          <div className="space-y-2">
            {lead.email && (
              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <Mail className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
                <a href={`mailto:${lead.email}`} className="truncate hover:text-indigo-600 hover:underline">{lead.email}</a>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <Phone className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
                <a href={`tel:${lead.phone}`} className="hover:text-indigo-600">{lead.phone}</a>
              </div>
            )}
            {lead.linkedinUrl && (
              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
                <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-indigo-600 hover:underline">
                  LinkedIn <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Globe className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
              <span className="capitalize">{lead.source}</span>
            </div>
          </div>
        </Section>

        {/* Notes */}
        <Section title="Notas internas" icon={MessageSquare}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Añade una nota sobre este lead..."
            className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-indigo-300 focus:bg-white focus:outline-none"
          />
        </Section>

        {/* Quick Actions */}
        <Section title="Acciones rápidas" icon={Zap}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Agendar demo",    icon: Calendar,     color: "text-violet-600 bg-violet-50 border-violet-200" },
              { label: "Enviar email",    icon: Mail,         color: "text-sky-600    bg-sky-50    border-sky-200"    },
              { label: "Añadir a campaña",icon: ArrowRight,   color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
              { label: "Activar Autopilot",icon: Bot,         color: "text-purple-600 bg-purple-50 border-purple-200"},
            ].map((a) => {
              const Icon = a.icon;
              return (
                <button key={a.label} className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-colors hover:shadow-sm ${a.color}`}>
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] font-medium leading-tight">{a.label}</span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Activity timeline */}
        <Section title="Actividad reciente" icon={Calendar}>
          <div className="space-y-2">
            {activity.length === 0 ? (
              <p className="text-[11px] text-zinc-400 italic">Sin actividad registrada aún.</p>
            ) : activity.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${a.dot}`} />
                <div>
                  <p className="text-[11px] text-zinc-700">{a.text}</p>
                  <p className="text-[10px] text-zinc-400">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
