"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import type { Conversation, Message, MessageStatus, PipelineStage } from "./types";
import { ConversationList } from "./ConversationList";
import { ChatView }         from "./ChatView";
import { LeadDetailPanel }  from "./LeadDetailPanel";
import { Bot, ChevronDown, Inbox, MessageSquare, RefreshCw, Search, X } from "lucide-react";
import { createClient }     from "@/lib/supabase/browser";
import {
  sendInboxMessage,
  generateAISuggestion,
  getConversationsWithMessages,
  toggleAutopilot as toggleAutopilotAction,
  markConversationRead,
  setAutopilotMode as setAutopilotModeAction,
} from "@/app/dashboard/smart-inbox/actions";
import {
  getAgents,
  assignAgentToConversation,
  type AgentRow,
} from "@/app/dashboard/agentes-ia/actions";

interface InboxLayoutProps {
  initialConversations: Conversation[];
  workspaceId: string;
}

// -- Agent selector dropdown ---------------------------------------------------

function AgentSelector({ agents, onSelect, onClose }: {
  agents: AgentRow[];
  onSelect: (agentId: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl shadow-lg"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-[11px] font-bold" style={{ color: "var(--foreground-muted)" }}>
          Seleccionar agente
        </span>
        <button onClick={onClose} style={{ color: "var(--foreground-faint)" }}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {agents.length === 0 ? (
        <p className="px-3 py-3 text-[11px]" style={{ color: "var(--foreground-faint)" }}>Sin agentes activos</p>
      ) : (
        <div className="max-h-48 overflow-y-auto py-1">
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => { onSelect(a.id); onClose(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
            >
              <span className="text-base">{a.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--foreground)" }}>{a.name}</p>
                <p className="text-[10px] capitalize" style={{ color: "var(--foreground-faint)" }}>{a.tone}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type InboxFilter = "all" | "unread" | "autopilot" | "waiting";

export function InboxLayout({ initialConversations, workspaceId }: InboxLayoutProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [selectedId, setSelectedId]       = useState<string | null>(initialConversations[0]?.id ?? null);
  const [detailOpen, setDetailOpen]       = useState(true);
  const [isPending, startTransition]      = useTransition();
  const [agents, setAgents]               = useState<AgentRow[]>([]);
  const [agentSelectorId, setAgentSelectorId] = useState<string | null>(null);
  const [filter, setFilter]               = useState<InboxFilter>("all");
  const [searchQuery, setSearchQuery]     = useState("");
  const [syncing, setSyncing]             = useState(false);
  const [lastSync, setLastSync]           = useState<Date | null>(null);
  const [engineStatus, setEngineStatus]   = useState<"idle" | "checking" | "unknown">("unknown");

  useEffect(() => {
    getAgents().then((r) => {
      if (r.success && r.data) setAgents(r.data.filter((a) => a.status === "active"));
    });
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();
    async function checkEngineStatus() {
      const { data } = await supabase
        .from("engine_queue")
        .select("status, created_at")
        .eq("workspace_id", workspaceId)
        .eq("task_type", "check_inbox")
        .in("status", ["pending", "processing"])
        .limit(1);
      setEngineStatus(data?.length ? "checking" : "idle");
    }
    checkEngineStatus();
    const interval = setInterval(checkEngineStatus, 30000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  const filteredConversations = useMemo(() => {
    let result = conversations;
    if (filter === "unread")    result = result.filter((c) => c.unreadCount > 0);
    if (filter === "autopilot") result = result.filter((c) => c.autopilotActive);
    if (filter === "waiting") {
      result = result.filter((c) => {
        const last = c.messages[c.messages.length - 1];
        return last?.sender === "user" || last?.sender === "ai";
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) => c.lead.name.toLowerCase().includes(q) || c.lead.company.toLowerCase().includes(q)
      );
    }
    return result;
  }, [conversations, filter, searchQuery]);

  const unreadTotal = conversations.filter((c) => c.unreadCount > 0).length;

  // -- Supabase Realtime --------------------------------------------------------
  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();

    const channel = supabase
      .channel("inbox-realtime")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        const m = payload.new as Record<string, unknown>;
        const incoming: Message = {
          id:        String(m.id),
          text:      String(m.message_text ?? ""),
          sender:    m.sender === "prospect" ? "lead" : (m.sender as Message["sender"]),
          timestamp: String(m.timestamp ?? m.inserted_at),
          read:      false,
          status:    "delivered",
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.lead.id === String(m.lead_id)
              ? { ...c, messages: [...c.messages, incoming], unreadCount: c.id === selectedId ? 0 : c.unreadCount + 1 }
              : c
          )
        );
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "messages",
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        const updated = payload.new as Record<string, unknown>;
        setConversations((prev) =>
          prev.map((c) =>
            c.lead.id === String(updated.lead_id)
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === String(updated.id) ? { ...m, status: updated.status as Message["status"] } : m
                  ),
                }
              : c
          )
        );
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "conversations",
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        const updated = payload.new as Record<string, unknown>;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === String(updated.id)
              ? { ...c, unreadCount: c.id === selectedId ? 0 : (updated.unread_count as number) ?? c.unreadCount }
              : c
          )
        );
      })
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "conversations",
        filter: `workspace_id=eq.${workspaceId}`,
      }, async (_payload) => {
        const result = await getConversationsWithMessages();
        if (result.success && result.data) {
          setConversations((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newOnes = result.data!.conversations.filter((c) => !existingIds.has(c.id));
            if (newOnes.length === 0) return prev;
            return [...newOnes, ...prev];
          });
        }
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "leads",
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        const updated = payload.new as Record<string, unknown>;
        setConversations((prev) =>
          prev.map((c) =>
            c.lead.id === String(updated.id)
              ? {
                  ...c,
                  lead: {
                    ...c.lead,
                    name:        String(updated.full_name  ?? c.lead.name),
                    company:     String(updated.company    ?? c.lead.company),
                    title:       String(updated.headline   ?? c.lead.title),
                    email:       updated.email        ? String(updated.email)        : c.lead.email,
                    phone:       updated.phone        ? String(updated.phone)        : c.lead.phone,
                    linkedinUrl: updated.linkedin_url ? String(updated.linkedin_url) : c.lead.linkedinUrl,
                  },
                }
              : c
          )
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedId, workspaceId]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  function selectConversation(id: string) {
    setSelectedId(id);
    setAgentSelectorId(null);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, unreadCount: 0, messages: c.messages.map((m) => ({ ...m, read: true })) } : c
      )
    );
    startTransition(async () => { await markConversationRead(id); });
  }

  function toggleAutopilot(id: string, active: boolean) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, autopilotActive: active, status: active ? "ai_handling" : "human" } : c
      )
    );
    if (active) {
      setAgentSelectorId(id);
      startTransition(async () => { await toggleAutopilotAction(id, active); });
    } else {
      setAgentSelectorId(null);
      startTransition(async () => { await toggleAutopilotAction(id, false); });
    }
  }

  function handleAssignAgent(agentId: string) {
    const conv = conversations.find((c) => c.id === agentSelectorId);
    if (!conv || !agentSelectorId) return;
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === agentSelectorId
            ? { ...c, assignedAgentName: agent.name, assignedAgentEmoji: agent.emoji } as Conversation & { assignedAgentName: string; assignedAgentEmoji: string }
            : c
        )
      );
    }
    setAgentSelectorId(null);
    startTransition(async () => { await assignAgentToConversation(agentId, agentSelectorId); });
  }

  function sendMessage(convId: string, text: string) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;
    const tempId  = `temp_${Date.now()}`;
    const tempMsg: Message = { id: tempId, text, sender: "user", timestamp: new Date().toISOString(), read: true, status: "sending" };
    setConversations((prev) =>
      prev.map((c) => c.id === convId ? { ...c, messages: [...c.messages, tempMsg] } : c)
    );
    startTransition(async () => {
      const result = await sendInboxMessage({
        conversation_id: convId,
        lead_id:         conv.lead.id,
        text,
        linkedin_url:    conv.lead.linkedinUrl ?? "",
      });
      if (result.success && result.data?.message_id) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, messages: c.messages.map((m) => m.id === tempId ? { ...m, id: result.data!.message_id, status: "sent" } : m) }
              : c
          )
        );
      } else if (!result.success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, messages: c.messages.map((m) => m.id === tempId ? { ...m, status: "failed" as MessageStatus } : m) }
              : c
          )
        );
      }
    });
  }

  async function requestAISuggestion(convId: string): Promise<string> {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return "";
    const history = conv.messages.slice(-6).map((m) => ({ sender: m.sender, text: m.text }));
    const result  = await generateAISuggestion({ lead_name: conv.lead.name, conversation_history: history });
    return result.success ? (result.data?.suggestion ?? "") : "";
  }

  function changeAutopilotMode(convId: string, mode: "auto" | "review") {
    setConversations((prev) =>
      prev.map((c) => c.id === convId ? { ...c, autopilotMode: mode } : c)
    );
    startTransition(async () => { await setAutopilotModeAction(convId, mode); });
  }

  function handleDraftStatusChange(convId: string, msgId: string, status: "approved" | "rejected", text?: string) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: c.messages.map((m) => m.id === msgId ? { ...m, status, text: text ?? m.text } : m) }
          : c
      )
    );
  }

  function changeLeadStage(leadId: string, stage: PipelineStage) {
    setConversations((prev) =>
      prev.map((c) => c.lead.id === leadId ? { ...c, lead: { ...c.lead, pipeline: stage } } : c)
    );
  }

  function archiveConversation(id: string) {
    setConversations((prev) =>
      prev.map((c) => c.id === id ? { ...c, status: "archived", resolvedAt: new Date().toISOString() } : c)
    );
  }

  function getAssignedAgent(conv: Conversation) {
    const extended = conv as Conversation & { assignedAgentName?: string; assignedAgentEmoji?: string };
    return extended.assignedAgentName
      ? { name: extended.assignedAgentName, emoji: extended.assignedAgentEmoji ?? "🤖" }
      : null;
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const bridgeAvailable = (window as Window & { __cazaryBridgeLoaded?: boolean }).__cazaryBridgeLoaded;

      if (bridgeAvailable) {
        const requestId = Math.random().toString(36).slice(2);
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            window.removeEventListener("message", handler);
            resolve();
          }, 8000);
          function handler(event: MessageEvent) {
            if (event.source !== window) return;
            if (event.data?.type !== `CAZARY_RES_${requestId}`) return;
            clearTimeout(timeout);
            window.removeEventListener("message", handler);
            resolve();
          }
          window.addEventListener("message", handler);
          window.postMessage({ type: "CAZARY_REQ_FORCE_INBOX_SYNC", requestId }, "*");
        });
        // Dar tiempo a Supabase Realtime para entregar los cambios
        await new Promise((r) => setTimeout(r, 1500));
      }

      startTransition(async () => {
        const result = await getConversationsWithMessages();
        if (result.success && result.data) setConversations(result.data.conversations);
      });
      setLastSync(new Date());
    } finally {
      setSyncing(false);
    }
  }

  const INBOX_FILTERS: { key: InboxFilter; label: string }[] = [
    { key: "all",       label: "Todos"     },
    { key: "unread",    label: "No leídos" },
    { key: "autopilot", label: "🤖 Auto"   },
    { key: "waiting",   label: "⏳ Espera"  },
  ];

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* ── PANEL 1: Conversation list ──────────────────────────────────────── */}
      <div
        className="flex w-72 flex-shrink-0 flex-col border-r"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 border-b p-3 space-y-2.5"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>Inbox</h2>
                {unreadTotal > 0 && (
                  <span className="rounded-full bg-[#2563EB] px-2 py-0.5 text-[10px] font-bold text-white">
                    {unreadTotal}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    engineStatus === "checking" ? "bg-[#10B981] animate-pulse" : "bg-[var(--border)]"
                  }`}
                />
                <span className="text-[9px]" style={{ color: "var(--foreground-faint)" }}>
                  {engineStatus === "checking" ? "Escaneando LinkedIn…" : "Sync cada 30min"}
                </span>
              </div>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors disabled:opacity-50"
              style={{ background: "var(--surface-hover)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin text-[#2563EB]" : ""}`} />
              {syncing
                ? "Sync…"
                : lastSync
                ? `${Math.round((Date.now() - lastSync.getTime()) / 60000)}min`
                : "Sync"}
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
              style={{ color: "var(--foreground-faint)" }}
            />
            <input
              type="text"
              placeholder="Buscar conversación..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg py-1.5 pl-8 pr-3 text-xs focus:outline-none"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#2563EB"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {INBOX_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="flex-shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors"
                style={
                  filter === f.key
                    ? { background: "#2563EB", color: "#fff" }
                    : { background: "var(--surface-hover)", color: "var(--foreground-faint)" }
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {filteredConversations.length === 0 && !searchQuery && filter === "all" ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: "rgba(37,99,235,0.1)" }}
            >
              <Inbox className="h-7 w-7" style={{ color: "#2563EB" }} />
            </div>
            <p className="mt-4 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              Tu inbox está vacío
            </p>
            <p className="mt-1.5 text-xs max-w-[200px] leading-relaxed" style={{ color: "var(--foreground-faint)" }}>
              Las conversaciones aparecen aquí cuando tus leads respondan.
            </p>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Buscando…" : "Buscar mensajes"}
            </button>
          </div>
        ) : (
          <ConversationList
            conversations={filteredConversations}
            selectedId={selectedId}
            onSelect={selectConversation}
          />
        )}
      </div>

      {/* ── PANEL 2: Chat thread ────────────────────────────────────────────── */}
      {selected ? (
        <div className="flex flex-1 flex-col overflow-hidden min-h-0">
          {/* Agent / autopilot banner */}
          {selected.autopilotActive && (
            <div
              className="relative flex flex-shrink-0 items-center gap-2 border-b px-4 py-1.5"
              style={{ background: "rgba(124,58,237,0.08)", borderColor: "rgba(124,58,237,0.2)" }}
            >
              <Bot className="h-3.5 w-3.5 text-violet-400" />
              {(() => {
                const assigned = getAssignedAgent(selected);
                return assigned ? (
                  <span className="text-[11px] font-semibold text-violet-300">
                    {assigned.emoji} {assigned.name} está manejando esta conversación
                  </span>
                ) : (
                  <span className="text-[11px] text-violet-400">Autopilot activo — sin agente asignado</span>
                );
              })()}
              <button
                onClick={() => setAgentSelectorId(agentSelectorId === selected.id ? null : selected.id)}
                className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-violet-300 transition-colors"
                style={{ border: "1px solid rgba(124,58,237,0.3)" }}
              >
                Cambiar agente <ChevronDown className="h-3 w-3" />
              </button>
              {agentSelectorId === selected.id && (
                <AgentSelector
                  agents={agents}
                  onSelect={handleAssignAgent}
                  onClose={() => setAgentSelectorId(null)}
                />
              )}
            </div>
          )}

          <ChatView
            conversation={selected}
            onToggleAutopilot={toggleAutopilot}
            onSendMessage={sendMessage}
            onShowDetail={() => setDetailOpen((o) => !o)}
            onArchive={archiveConversation}
            onRequestAISuggestion={() => requestAISuggestion(selected.id)}
            isPending={isPending}
            onDraftStatusChange={(msgId, status, text) =>
              handleDraftStatusChange(selected.id, msgId, status, text)
            }
          />
        </div>
      ) : (
        <div
          className="flex flex-1 flex-col items-center justify-center text-center"
          style={{ background: "var(--background)" }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "var(--surface)" }}
          >
            <MessageSquare className="h-6 w-6" style={{ color: "var(--foreground-faint)" }} />
          </div>
          <p className="mt-3 text-sm font-semibold" style={{ color: "var(--foreground-muted)" }}>
            Selecciona una conversación
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--foreground-faint)" }}>
            Elige un lead de la lista para ver el hilo
          </p>
        </div>
      )}

      {/* ── PANEL 3: Lead profile ───────────────────────────────────────────── */}
      {selected && detailOpen && (
        <LeadDetailPanel
          lead={selected.lead}
          messages={selected.messages}
          onClose={() => setDetailOpen(false)}
          onStageChange={changeLeadStage}
          autopilotActive={selected.autopilotActive}
          autopilotMode={selected.autopilotMode}
          onToggleAutopilot={(active) => toggleAutopilot(selected.id, active)}
          onChangeAutopilotMode={(mode) => changeAutopilotMode(selected.id, mode)}
        />
      )}
    </div>
  );
}
