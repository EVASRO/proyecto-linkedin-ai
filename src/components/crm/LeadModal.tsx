"use client";

import { useState } from "react";
import { ArrowUpRight, Bot, Link2, X } from "lucide-react";
import type { CrmLead, TagColor } from "./types";
import type {
  AISuggestion, Conversation, InboxLead, Message, PipelineStage,
} from "@/components/smart-inbox/types";
import { MOCK_CONVERSATIONS } from "@/components/smart-inbox/mock-data";
import { ChatView }        from "@/components/smart-inbox/ChatView";
import { LeadDetailPanel } from "@/components/smart-inbox/LeadDetailPanel";
import { useDemoMode }     from "@/components/providers/demo-mode-provider";

// ── Bridge helpers ────────────────────────────────────────────────────────────

const TAG_COLOR_MAP: Record<TagColor, string> = {
  blue:   "bg-blue-100 text-blue-700",
  violet: "bg-violet-100 text-violet-700",
  green:  "bg-green-100 text-green-700",
  amber:  "bg-amber-100 text-amber-700",
  red:    "bg-red-100 text-red-700",
  pink:   "bg-pink-100 text-pink-700",
  sky:    "bg-sky-100 text-sky-700",
  gray:   "bg-zinc-100 text-zinc-600",
  indigo: "bg-indigo-100 text-indigo-700",
};

function toInboxSource(s: string): "linkedin" | "email" {
  return s.toLowerCase() === "email" ? "email" : "linkedin";
}

function buildInboxLead(lead: CrmLead): InboxLead {
  return {
    id:          lead.id,
    name:        lead.name,
    company:     lead.company,
    title:       "Contacto de LinkedIn",
    email:       lead.email,
    phone:       lead.phone,
    source:      toInboxSource(lead.source),
    pipeline:    lead.status as PipelineStage,
    tags:        lead.tags.map((t) => ({ label: t.label, color: TAG_COLOR_MAP[t.color] ?? "bg-zinc-100 text-zinc-600" })),
    value:       lead.value,
    notes:       lead.nextTask ?? "",
    createdAt:   lead.createdAt,
  };
}

const DEFAULT_SUGGESTIONS: AISuggestion[] = [
  { id: "d1", text: "Solo quería hacer un seguimiento rápido — ¿tuviste oportunidad de revisar lo que te compartí? Con gusto te agendo una demo de 20 minutos.", intent: "follow_up" },
  { id: "d2", text: "¿Cuántos SDRs tiene tu equipo actualmente? Dependiendo del volumen, NexusAI puede multiplicar vuestra capacidad de prospección 5x.",           intent: "qualify"   },
  { id: "d3", text: "Tenemos un caso de éxito con una empresa similar. ¿Te lo comparto? Puede ser muy relevante para lo que buscan.",                              intent: "value_prop"},
];

function buildConversation(lead: CrmLead, useDemo = true): Conversation {
  // En modo demo: busca conversación mock por nombre
  if (useDemo) {
    const found = MOCK_CONVERSATIONS.find(
      (c) => c.lead.name.toLowerCase() === lead.name.toLowerCase()
    );
    if (found) {
      return { ...found, lead: { ...found.lead, pipeline: lead.status as PipelineStage } };
    }
  }

  // Modo real o sin match: conversación vacía (sin mensajes demo)
  const inboxLead = buildInboxLead(lead);
  const msgs: Message[] = useDemo ? [
    {
      id: "auto_1",
      sender: "ai",
      text: `Hola ${lead.name.split(" ")[0]}, vi tu perfil y me gustaría conectar para mostrarte cómo NexusAI puede ayudar a ${lead.company} a escalar su prospección B2B.`,
      timestamp: `${lead.createdAt}T09:00:00Z`,
      read: true,
    },
  ] : [];

  return {
    id:              `modal_conv_${lead.id}`,
    lead:            inboxLead,
    status:          "active",
    autopilotActive: false,
    unreadCount:     0,
    messages:        msgs,
    aiSuggestions:   DEFAULT_SUGGESTIONS,
  };
}

// ── Avatar helpers ────────────────────────────────────────────────────────────

const PALETTE = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-pink-500", "bg-indigo-600"];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

// ── Main component ────────────────────────────────────────────────────────────

interface LeadModalProps {
  lead: CrmLead;
  onClose: () => void;
  onStageChange: (leadId: string, newStatus: string) => void;
}

export function LeadModal({ lead, onClose, onStageChange }: LeadModalProps) {
  const { demoMode } = useDemoMode();
  const [conv, setConv] = useState<Conversation>(() => buildConversation(lead, demoMode));
  const [detailOpen, setDetailOpen] = useState(true);

  function handleToggleAutopilot(id: string, active: boolean) {
    setConv((prev) => ({
      ...prev,
      autopilotActive: active,
      status: active ? "ai_handling" : "human",
    }));
  }

  function handleSendMessage(_convId: string, text: string) {
    const msg: Message = {
      id:        `m_${Date.now()}`,
      sender:    "user",
      text,
      timestamp: new Date().toISOString(),
      read:      true,
    };
    setConv((prev) => ({
      ...prev,
      messages: [...prev.messages, msg],
      status: "human",
    }));
  }

  function handleStageChange(leadId: string, stage: PipelineStage) {
    setConv((prev) => ({
      ...prev,
      lead: { ...prev.lead, pipeline: stage },
    }));
    onStageChange(leadId, stage);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div
        className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        style={{ height: "calc(100vh - 80px)" }}
      >
        {/* ── Modal Header ── */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-zinc-100 bg-white px-5 py-3.5">
          {/* Avatar */}
          <div className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarColor(lead.name)}`}>
            {initials(lead.name)}
          </div>

          {/* Name + company */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-zinc-900 leading-tight">{lead.name}</p>
            <p className="text-[11px] text-zinc-500">{lead.company}</p>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2">
            {conv.autopilotActive && (
              <div className="flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-bold text-purple-700">
                <Bot className="h-3 w-3" />
                Autopilot activo
              </div>
            )}
            <a
              href={lead.email ? `mailto:${lead.email}` : "#"}
              className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              onClick={(e) => !lead.email && e.preventDefault()}
            >
              <Link2 className="h-3.5 w-3.5" />
              Ver perfil
              <ArrowUpRight className="h-3 w-3 opacity-60" />
            </a>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="ml-2 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Chat */}
          <ChatView
            conversation={conv}
            onToggleAutopilot={handleToggleAutopilot}
            onSendMessage={handleSendMessage}
            onShowDetail={() => setDetailOpen((o) => !o)}
          />

          {/* Lead detail panel */}
          {detailOpen && (
            <LeadDetailPanel
              lead={conv.lead}
              messages={conv.messages}
              onClose={() => setDetailOpen(false)}
              onStageChange={handleStageChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
