"use client";

import { useState, useRef, useEffect } from "react";
import {
  Archive, Bot, BotOff, Check, CheckCheck, ChevronDown,
  Clock, Info, LayoutTemplate, Paperclip, Send, Sparkles, User, X,
} from "lucide-react";
import type { AISuggestion, Conversation, Message, QuickReplyTemplate } from "./types";

// ── Quick Reply Templates ─────────────────────────────────────────────────────

const QUICK_REPLIES: QuickReplyTemplate[] = [
  { id: "q1", label: "Seguimiento 48h",    category: "seguimiento",  text: "Hola {{nombre}}, quería hacer un seguimiento a lo que conversamos. ¿Tuviste oportunidad de revisar la info que te compartí?" },
  { id: "q2", label: "Solicitar reunión",  category: "seguimiento",  text: "¿Tienes 20 minutos esta semana para una llamada rápida? Me gustaría mostrarte cómo NexusAI puede ayudar a {{empresa}}." },
  { id: "q3", label: "Propuesta de valor", category: "propuesta",    text: "Nuestros clientes en {{industria}} logran 3x más reuniones en el mismo tiempo. ¿Te gustaría ver los números?" },
  { id: "q4", label: "Respuesta a precio", category: "calificacion", text: "Entiendo la preocupación por el precio. El ROI promedio que ven nuestros clientes es de 8-10x en el primer trimestre. ¿Lo revisamos juntos?" },
  { id: "q5", label: "Agendar demo",       category: "cierre",       text: "Tengo disponibilidad el {{dia}} a las {{hora}}. ¿Te funciona para una demo de 30 minutos?" },
  { id: "q6", label: "Caso de éxito",      category: "propuesta",    text: "Déjame compartirte un caso de una empresa similar a {{empresa}} que logró resultados en 2 semanas con NexusAI." },
  { id: "q7", label: "No es el momento",   category: "general",      text: "Perfecto, lo entiendo completamente. ¿Puedo contactarte en {{tiempo}} cuando sea un mejor momento?" },
  { id: "q8", label: "Confirmar reunión",  category: "cierre",       text: "Confirmado! Te envío la invitación al calendario. Hablaremos el {{dia}} a las {{hora}}. ¡Hasta pronto!" },
];

const CATEGORY_COLOR: Record<string, string> = {
  seguimiento:  "bg-blue-50 text-blue-700 border-blue-200",
  propuesta:    "bg-violet-50 text-violet-700 border-violet-200",
  calificacion: "bg-amber-50 text-amber-700 border-amber-200",
  cierre:       "bg-green-50 text-green-700 border-green-200",
  general:      "bg-zinc-50 text-zinc-600 border-zinc-200",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function avatarColor(name: string): string {
  const palette = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-pink-500", "bg-indigo-600"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

const INTENT_LABEL: Record<string, string> = {
  follow_up:  "Seguimiento",
  qualify:    "Calificar",
  schedule:   "Agendar",
  value_prop: "Propuesta de valor",
  close:      "Cerrar",
};

const INTENT_COLOR: Record<string, string> = {
  follow_up:  "bg-blue-50   text-blue-700   border-blue-200",
  qualify:    "bg-amber-50  text-amber-700  border-amber-200",
  schedule:   "bg-green-50  text-green-700  border-green-200",
  value_prop: "bg-violet-50 text-violet-700 border-violet-200",
  close:      "bg-red-50    text-red-600    border-red-200",
};

// ── Message Status Icon ───────────────────────────────────────────────────────

function StatusIcon({ status }: { status?: string }) {
  if (!status) return null;
  if (status === "sending")   return <Clock className="h-3 w-3 text-white/40" />;
  if (status === "sent")      return <Check className="h-3 w-3 text-white/60" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 text-white/60" />;
  if (status === "read")      return <CheckCheck className="h-3 w-3 text-blue-400" />;
  return null;
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function Bubble({ msg, leadName }: { msg: Message; leadName: string }) {
  const isOutbound = msg.sender === "user" || msg.sender === "ai";

  return (
    <div className={`flex items-end gap-2 ${isOutbound ? "flex-row-reverse" : "flex-row"}`}>
      <div className={[
        "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
        msg.sender === "ai"   ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white" :
        msg.sender === "user" ? "bg-zinc-700 text-white" :
        `${avatarColor(leadName)} text-white`,
      ].join(" ")}>
        {msg.sender === "ai"   ? <Bot className="h-3.5 w-3.5"  /> :
         msg.sender === "user" ? <User className="h-3.5 w-3.5" /> :
         initials(leadName)}
      </div>

      <div className={`max-w-[72%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
        isOutbound
          ? "rounded-br-sm bg-zinc-900 text-white"
          : "rounded-bl-sm bg-white border border-zinc-200 text-zinc-800"
      }`}>
        <p className="text-[12px] leading-relaxed">{msg.text}</p>
        <div className={`mt-1 flex items-center gap-1.5 ${isOutbound ? "justify-end" : "justify-start"}`}>
          <span className={`text-[9px] ${isOutbound ? "text-white/60" : "text-zinc-400"}`}>
            {fmtTime(msg.timestamp)}
          </span>
          {msg.sender === "ai" && (
            <span className="flex items-center gap-0.5 rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[8px] font-bold text-purple-300">
              <Sparkles className="h-2 w-2" /> IA
            </span>
          )}
          {isOutbound && <StatusIcon status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

// ── Quick Replies Panel ───────────────────────────────────────────────────────

function QuickRepliesPanel({ onSelect, onClose }: {
  onSelect: (text: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch]   = useState("");
  const [category, setCategory] = useState<string>("all");

  const filtered = QUICK_REPLIES.filter((r) => {
    if (category !== "all" && r.category !== category) return false;
    if (search && !r.label.toLowerCase().includes(search.toLowerCase()) &&
        !r.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const cats = ["all", "seguimiento", "propuesta", "calificacion", "cierre", "general"];

  return (
    <div className="flex-shrink-0 border-t border-zinc-100 bg-white">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-700">
          <LayoutTemplate className="h-3.5 w-3.5 text-zinc-400" />
          Plantillas rápidas
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-4 pb-2">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar plantilla..."
          className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs focus:border-indigo-400 focus:outline-none"
          autoFocus
        />
      </div>
      <div className="flex gap-1 overflow-x-auto px-4 pb-2">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={[
              "flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize transition-colors",
              category === c ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-500 hover:bg-zinc-50",
            ].join(" ")}
          >
            {c === "all" ? "Todas" : c}
          </button>
        ))}
      </div>
      <div className="max-h-40 overflow-y-auto px-4 pb-3 space-y-1.5">
        {filtered.length === 0 ? (
          <p className="py-3 text-center text-[11px] text-zinc-400">Sin resultados</p>
        ) : (
          filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => { onSelect(r.text); onClose(); }}
              className={`flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition-all hover:shadow-sm ${CATEGORY_COLOR[r.category]}`}
            >
              <span className="mt-0.5 flex-shrink-0 rounded-full bg-white/60 px-1.5 py-0.5 text-[9px] font-bold">
                {r.label}
              </span>
              <p className="text-[11px] leading-snug opacity-80">
                {r.text.slice(0, 100)}{r.text.length > 100 ? "…" : ""}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main ChatView ─────────────────────────────────────────────────────────────

interface ChatViewProps {
  conversation: Conversation;
  onToggleAutopilot: (id: string, active: boolean) => void;
  onSendMessage: (id: string, text: string) => void;
  onShowDetail: () => void;
  onArchive?: (id: string) => void;
  onRequestAISuggestion?: () => Promise<string>;
  isPending?: boolean;
}

export function ChatView({
  conversation: conv,
  onToggleAutopilot,
  onSendMessage,
  onShowDetail,
  onArchive,
  onRequestAISuggestion,
  isPending,
}: ChatViewProps) {
  const [input, setInput]                 = useState("");
  const [showSugg, setShowSugg]           = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [aiLoading, setAiLoading]         = useState(false);
  const bottomRef                     = useRef<HTMLDivElement>(null);
  const lastMsg                       = conv.messages[conv.messages.length - 1];
  const hasUnreplied                  = lastMsg?.sender === "lead";
  const isArchived                    = conv.status === "archived";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv.messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || isArchived) return;
    onSendMessage(conv.id, text);
    setInput("");
  }

  function useSuggestion(s: AISuggestion) {
    setInput(s.text);
    setShowSugg(false);
  }

  async function handleAISuggest() {
    if (!onRequestAISuggestion || aiLoading) return;
    setAiLoading(true);
    try {
      const suggestion = await onRequestAISuggestion();
      if (suggestion) setInput(suggestion);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0 bg-zinc-50/30">
      {/* ── Chat Header ── */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-border bg-white px-4 py-3">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarColor(conv.lead.name)}`}>
          {initials(conv.lead.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-zinc-900">{conv.lead.name}</p>
            {isArchived && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold text-zinc-500">ARCHIVADO</span>
            )}
          </div>
          <p className="text-[10px] text-zinc-400">{conv.lead.title} · {conv.lead.company}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Autopilot toggle */}
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${
            conv.autopilotActive ? "bg-purple-100 text-purple-700" : "bg-zinc-100 text-zinc-500"
          }`}>
            {conv.autopilotActive ? <Bot className="h-3 w-3" /> : <BotOff className="h-3 w-3" />}
            {conv.autopilotActive ? "Autopilot ON" : "Autopilot OFF"}
          </div>
          <button
            onClick={() => onToggleAutopilot(conv.id, !conv.autopilotActive)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${conv.autopilotActive ? "bg-purple-600" : "bg-zinc-300"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${conv.autopilotActive ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>

          {/* Archive button */}
          {onArchive && !isArchived && (
            <button
              onClick={() => onArchive(conv.id)}
              title="Archivar conversación"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}

          {/* Info button */}
          <button
            onClick={onShowDetail}
            title="Ver detalle del lead"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Archived banner */}
      {isArchived && (
        <div className="flex flex-shrink-0 items-center gap-2 bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-500">
          <Archive className="h-3.5 w-3.5" />
          Esta conversación está archivada. No se pueden enviar mensajes.
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {conv.messages.map((msg) => (
          <Bubble key={msg.id} msg={msg} leadName={conv.lead.name} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── AI Suggestions ── */}
      {hasUnreplied && conv.aiSuggestions.length > 0 && showSugg && !isArchived && (
        <div className="flex-shrink-0 border-t border-zinc-100 bg-white px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600">
              <Sparkles className="h-3 w-3" />
              Sugerencias IA — Copiloto
            </div>
            <button onClick={() => setShowSugg(false)} className="text-zinc-400 hover:text-zinc-600">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {conv.aiSuggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => useSuggestion(s)}
                className={`flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition-colors hover:shadow-sm ${INTENT_COLOR[s.intent] ?? "bg-zinc-50 text-zinc-700 border-zinc-200"}`}
              >
                <span className="mt-0.5 flex-shrink-0 rounded-full bg-white/60 px-1.5 py-0.5 text-[9px] font-bold">
                  {INTENT_LABEL[s.intent] ?? s.intent}
                </span>
                <p className="text-[11px] leading-snug">{s.text.slice(0, 120)}{s.text.length > 120 ? "…" : ""}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Reply Templates ── */}
      {showTemplates && !isArchived && (
        <QuickRepliesPanel
          onSelect={(text) => setInput(text)}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* ── Input ── */}
      {!isArchived && (
        <div className="flex-shrink-0 border-t border-border bg-white px-4 py-3">
          {!showSugg && hasUnreplied && (
            <button onClick={() => setShowSugg(true)} className="mb-2 flex items-center gap-1 text-[10px] text-purple-500 hover:text-purple-700">
              <Sparkles className="h-3 w-3" />
              Ver sugerencias IA
            </button>
          )}
          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowTemplates((v) => !v)}
              title="Plantillas rápidas"
              className={`flex-shrink-0 transition-colors ${showTemplates ? "text-indigo-600" : "text-zinc-400 hover:text-zinc-600"}`}
            >
              <LayoutTemplate className="h-4 w-4" />
            </button>
            <button className="flex-shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors">
              <Paperclip className="h-4 w-4" />
            </button>
            {onRequestAISuggestion && (
              <button
                onClick={handleAISuggest}
                disabled={aiLoading || isPending}
                title="Sugerir con IA"
                className="flex-shrink-0 transition-colors disabled:opacity-40 text-purple-400 hover:text-purple-600"
              >
                {aiLoading
                  ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                  : <Sparkles className="h-4 w-4" />
                }
              </button>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              rows={2}
              placeholder="Escribe un mensaje… (Enter para enviar)"
              className="flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
