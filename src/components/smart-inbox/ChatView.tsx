"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot, Check, CheckCheck, ChevronDown,
  ExternalLink, LayoutTemplate, Loader2, Send, Sparkles, User, X, XCircle,
} from "lucide-react";
import type { AISuggestion, Conversation, Message, QuickReplyTemplate } from "./types";
import { approveDraft, rejectDraft } from "@/app/dashboard/smart-inbox/actions";

// -- Quick Reply Templates -----------------------------------------------------

const QUICK_REPLIES: QuickReplyTemplate[] = [
  { id: "q1", label: "Seguimiento 48h",    category: "seguimiento",  text: "Hola {{nombre}}, quería hacer un seguimiento a lo que conversamos. ¿Tuviste oportunidad de revisar la info que te compartí?" },
  { id: "q2", label: "Solicitar reunión",  category: "seguimiento",  text: "¿Tienes 20 minutos esta semana para una llamada rápida? Me gustaría mostrarte cómo cazary.ai puede ayudar a {{empresa}}." },
  { id: "q3", label: "Propuesta de valor", category: "propuesta",    text: "Nuestros clientes en {{industria}} logran 3x más reuniones en el mismo tiempo. ¿Te gustaría ver los números?" },
  { id: "q4", label: "Respuesta a precio", category: "calificacion", text: "Entiendo la preocupación por el precio. El ROI promedio que ven nuestros clientes es de 8-10x en el primer trimestre. ¿Lo revisamos juntos?" },
  { id: "q5", label: "Agendar demo",       category: "cierre",       text: "Tengo disponibilidad el {{dia}} a las {{hora}}. ¿Te funciona para una demo de 30 minutos?" },
  { id: "q6", label: "Caso de éxito",      category: "propuesta",    text: "Déjame compartirte un caso de una empresa similar a {{empresa}} que logró resultados en 2 semanas con cazary.ai." },
  { id: "q7", label: "No es el momento",   category: "general",      text: "Perfecto, lo entiendo completamente. ¿Puedo contactarte en {{tiempo}} cuando sea un mejor momento?" },
  { id: "q8", label: "Confirmar reunión",  category: "cierre",       text: "Confirmado! Te envío la invitación al calendario. Hablaremos el {{dia}} a las {{hora}}. ¡Hasta pronto!" },
];

const CATEGORY_COLOR: Record<string, string> = {
  seguimiento:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  propuesta:    "bg-violet-500/10 text-violet-400 border-violet-500/20",
  calificacion: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  cierre:       "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  general:      "bg-[var(--surface-hover)] text-[var(--foreground-muted)] border-[var(--border)]",
};

// -- Helpers -------------------------------------------------------------------

function avatarColor(name: string): string {
  const palette = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#DB2777", "#0891B2"];
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

// -- Message Status Icon -------------------------------------------------------

function StatusIcon({ status }: { status?: string }) {
  if (status === "sending")   return <Loader2    className="h-3 w-3 animate-spin opacity-50" />;
  if (status === "sent")      return <Check      className="h-3 w-3 opacity-60" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 opacity-60" />;
  if (status === "read")      return <CheckCheck className="h-3 w-3 text-[#06B6D4]" />;
  if (status === "failed")    return <XCircle    className="h-3 w-3 text-[var(--danger)]" />;
  return null;
}

// -- Message Bubble ------------------------------------------------------------

function Bubble({ msg, leadName }: { msg: Message; leadName: string }) {
  const isOutbound = msg.sender === "user" || msg.sender === "ai";

  return (
    <div className={`flex items-end gap-2 ${isOutbound ? "flex-row-reverse" : "flex-row"}`}>
      {/* Mini avatar */}
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{
          background: msg.sender === "ai"
            ? "linear-gradient(135deg, #7C3AED, #2563EB)"
            : msg.sender === "user"
            ? "var(--surface-hover)"
            : avatarColor(leadName),
        }}
      >
        {msg.sender === "ai"   ? <Bot  className="h-3.5 w-3.5" /> :
         msg.sender === "user" ? <User className="h-3.5 w-3.5" style={{ color: "var(--foreground-muted)" }} /> :
         initials(leadName)}
      </div>

      <div
        className="max-w-[72%] rounded-2xl px-3.5 py-2.5"
        style={
          isOutbound
            ? { background: "linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)", color: "#fff" }
            : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }
        }
        // rounded corner towards avatar
      >
        <p className="text-[12.5px] leading-relaxed">{msg.text}</p>
        <div className={`mt-1 flex items-center gap-1.5 ${isOutbound ? "justify-end" : "justify-start"}`}>
          <span
            className="text-[9px]"
            style={{ color: isOutbound ? "rgba(255,255,255,0.65)" : "var(--foreground-faint)" }}
          >
            {fmtTime(msg.timestamp)}
          </span>
          {msg.sender === "ai" && (
            <span className="flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[8px] font-bold text-white">
              <Sparkles className="h-2 w-2" /> Enviado por IA
            </span>
          )}
          {isOutbound && <StatusIcon status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

// -- Draft Bubble --------------------------------------------------------------

function DraftBubble({
  msg,
  onApprove,
  onReject,
}: {
  msg: Message;
  onApprove: (id: string, text: string) => Promise<void>;
  onReject:  (id: string) => Promise<void>;
}) {
  const [text, setText]       = useState(msg.text);
  const [working, setWorking] = useState(false);

  async function handleApprove() {
    setWorking(true);
    await onApprove(msg.id, text);
    setWorking(false);
  }

  async function handleReject() {
    setWorking(true);
    await onReject(msg.id);
    setWorking(false);
  }

  if (msg.status === "rejected") {
    return (
      <div
        className="mx-2 flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] italic"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground-faint)" }}
      >
        <X className="h-3 w-3 flex-shrink-0" />
        Respuesta IA descartada
      </div>
    );
  }

  if (msg.status === "approved" || msg.status === "pending_send") {
    return (
      <div className="flex items-end gap-2 flex-row-reverse">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg, #7C3AED, #2563EB)" }}>
          <Bot className="h-3.5 w-3.5" />
        </div>
        <div className="max-w-[72%] rounded-2xl px-3.5 py-2.5" style={{ background: "linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)", color: "#fff" }}>
          <p className="text-[12.5px] leading-relaxed">{msg.text}</p>
          <div className="mt-1 flex items-center justify-end gap-1.5">
            <span className="text-[9px] text-white/65">{fmtTime(msg.timestamp)}</span>
            <span className="flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[8px] font-bold text-white">
              <Sparkles className="h-2 w-2" /> IA · Encolado
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-2 rounded-xl p-3"
      style={{ border: "2px solid #7C3AED", background: "rgba(124,58,237,0.06)" }}
    >
      <div className="mb-2 flex items-center gap-2">
        <Bot className="h-4 w-4 text-violet-400" />
        <span className="text-[11px] font-bold text-violet-400">Respuesta sugerida por IA</span>
        <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-bold text-violet-300">
          PENDIENTE APROBACIÓN
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        disabled={working}
        className="w-full resize-none rounded-lg px-3 py-2 text-xs focus:outline-none disabled:opacity-60"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={handleApprove}
          disabled={working || !text.trim()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #7C3AED, #2563EB)" }}
        >
          {working ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Enviar
        </button>
        <button
          onClick={handleReject}
          disabled={working}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs transition-colors disabled:opacity-50"
          style={{ border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
        >
          <X className="h-3 w-3" />
          Descartar
        </button>
      </div>
    </div>
  );
}

// -- Quick Replies Panel -------------------------------------------------------

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
    <div
      className="flex-shrink-0 border-t"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "var(--foreground-muted)" }}>
          <LayoutTemplate className="h-3.5 w-3.5" style={{ color: "var(--foreground-faint)" }} />
          Plantillas rápidas
        </div>
        <button onClick={onClose} style={{ color: "var(--foreground-faint)" }}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-4 pb-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar plantilla..."
          className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none"
          style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          autoFocus
        />
      </div>
      <div className="flex gap-1 overflow-x-auto px-4 pb-2">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className="flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize transition-colors"
            style={
              category === c
                ? { background: "#2563EB", color: "#fff" }
                : { border: "1px solid var(--border)", color: "var(--foreground-faint)" }
            }
          >
            {c === "all" ? "Todas" : c}
          </button>
        ))}
      </div>
      <div className="max-h-40 overflow-y-auto px-4 pb-3 space-y-1.5">
        {filtered.length === 0 ? (
          <p className="py-3 text-center text-[11px]" style={{ color: "var(--foreground-faint)" }}>Sin resultados</p>
        ) : (
          filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => { onSelect(r.text); onClose(); }}
              className={`flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition-all hover:opacity-90 ${CATEGORY_COLOR[r.category]}`}
            >
              <span className="mt-0.5 flex-shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold">
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

// -- Main ChatView -------------------------------------------------------------

interface ChatViewProps {
  conversation: Conversation;
  onToggleAutopilot: (id: string, active: boolean) => void;
  onSendMessage: (id: string, text: string) => void;
  onShowDetail: () => void;
  onArchive?: (id: string) => void;
  onRequestAISuggestion?: () => Promise<string>;
  isPending?: boolean;
  onDraftStatusChange?: (msgId: string, status: "approved" | "rejected", text?: string) => void;
}

export function ChatView({
  conversation: conv,
  onToggleAutopilot,
  onSendMessage,
  onShowDetail,
  onArchive,
  onRequestAISuggestion,
  isPending,
  onDraftStatusChange,
}: ChatViewProps) {
  const [input, setInput]                 = useState("");
  const [showSugg, setShowSugg]           = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [aiLoading, setAiLoading]         = useState(false);
  const bottomRef                         = useRef<HTMLDivElement>(null);
  const lastMsg                           = conv.messages[conv.messages.length - 1];
  const hasUnreplied                      = lastMsg?.sender === "lead";
  const isArchived                        = conv.status === "archived";

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

  async function handleApproveDraft(msgId: string, text: string) {
    await approveDraft(msgId, text);
    onDraftStatusChange?.(msgId, "approved", text);
  }

  async function handleRejectDraft(msgId: string) {
    await rejectDraft(msgId);
    onDraftStatusChange?.(msgId, "rejected");
  }

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden min-h-0"
      style={{ background: "var(--background)" }}
    >
      {/* -- Header -- */}
      <div
        className="flex flex-shrink-0 items-center gap-3 border-b px-4 py-3"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
          style={{ background: avatarColor(conv.lead.name) }}
        >
          {initials(conv.lead.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{conv.lead.name}</p>
            {conv.source === "salesnav" ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-400">Sales Nav</span>
            ) : (
              <span className="rounded-full bg-[#2563EB]/15 px-2 py-0.5 text-[9px] font-bold text-[#2563EB]">LinkedIn</span>
            )}
            {isArchived && (
              <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[9px] font-bold" style={{ color: "var(--foreground-faint)" }}>ARCHIVADO</span>
            )}
          </div>
          <p className="text-[11px]" style={{ color: "var(--foreground-faint)" }}>
            {conv.lead.title ? `${conv.lead.title} · ` : ""}{conv.lead.company}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Ver perfil completo */}
          <button
            onClick={onShowDetail}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors"
            style={{ background: "var(--surface-hover)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver perfil
          </button>
        </div>
      </div>

      {/* Archived banner */}
      {isArchived && (
        <div
          className="flex flex-shrink-0 items-center gap-2 px-4 py-2 text-xs font-medium"
          style={{ background: "var(--surface-hover)", color: "var(--foreground-muted)" }}
        >
          Esta conversación está archivada. No se pueden enviar mensajes.
        </div>
      )}

      {/* -- Messages area -- */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-3">
          {conv.messages.map((msg) =>
            msg.sender === "ai" &&
            (msg.status === "draft" || msg.status === "rejected" || msg.status === "approved" || msg.status === "pending_send") ? (
              <DraftBubble
                key={msg.id}
                msg={msg}
                onApprove={handleApproveDraft}
                onReject={handleRejectDraft}
              />
            ) : (
              <Bubble key={msg.id} msg={msg} leadName={conv.lead.name} />
            )
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* -- AI Suggestions strip -- */}
      {hasUnreplied && conv.aiSuggestions.length > 0 && showSugg && !isArchived && (
        <div
          className="flex-shrink-0 border-t px-4 py-3"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-violet-400">
              <Sparkles className="h-3 w-3" />
              Sugerencias IA
            </div>
            <button onClick={() => setShowSugg(false)} style={{ color: "var(--foreground-faint)" }}>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {conv.aiSuggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => useSuggestion(s)}
                className="flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition-colors"
                style={{ background: "var(--surface-hover)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
              >
                <p className="text-[11px] leading-snug">{s.text.slice(0, 120)}{s.text.length > 120 ? "…" : ""}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* -- Quick Replies -- */}
      {showTemplates && !isArchived && (
        <QuickRepliesPanel
          onSelect={(text) => setInput(text)}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* -- Composer -- */}
      {!isArchived && (
        <div
          className="flex-shrink-0 border-t px-4 py-3"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {!showSugg && hasUnreplied && (
            <button
              onClick={() => setShowSugg(true)}
              className="mb-2 flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300"
            >
              <Sparkles className="h-3 w-3" />
              Ver sugerencias IA
            </button>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            rows={3}
            placeholder="Escribe un mensaje… (Enter para enviar, Shift+Enter para nueva línea)"
            className="w-full resize-none rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:ring-1 transition-colors"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#2563EB"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = ""; }}
          />
          <div className="mt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Templates button */}
              <button
                onClick={() => setShowTemplates((v) => !v)}
                title="Plantillas rápidas"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors"
                style={
                  showTemplates
                    ? { background: "rgba(37,99,235,0.15)", color: "#2563EB", border: "1px solid rgba(37,99,235,0.25)" }
                    : { background: "var(--surface-hover)", color: "var(--foreground-faint)", border: "1px solid var(--border)" }
                }
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                Plantillas
              </button>

              {/* AI Suggest button */}
              {onRequestAISuggestion && (
                <button
                  onClick={handleAISuggest}
                  disabled={aiLoading || isPending}
                  title="Sugerir con IA"
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40"
                  style={{
                    background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(37,99,235,0.15))",
                    color: "#7C3AED",
                    border: "1px solid rgba(124,58,237,0.25)",
                  }}
                >
                  {aiLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Bot className="h-3.5 w-3.5" />
                  }
                  Sugerir con IA
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Autopilot toggle label */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium" style={{ color: "var(--foreground-faint)" }}>Autopilot</span>
                <button
                  onClick={() => onToggleAutopilot(conv.id, !conv.autopilotActive)}
                  className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
                  style={{ background: conv.autopilotActive ? "#7C3AED" : "var(--border)" }}
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
                    style={{ transform: conv.autopilotActive ? "translateX(14px)" : "translateX(1px)" }}
                  />
                </button>
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)" }}
              >
                <Send className="h-3.5 w-3.5" />
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
