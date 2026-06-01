"use client";

import { useState, useEffect, useTransition } from "react";
import type { Conversation, Message, PipelineStage } from "./types";
import { ConversationList } from "./ConversationList";
import { ChatView }         from "./ChatView";
import { LeadDetailPanel }  from "./LeadDetailPanel";
import { Bot, ChevronDown, MessageSquare, X } from "lucide-react";
import { createClient }     from "@/lib/supabase/browser";
import {
  sendInboxMessage,
  generateAISuggestion,
  toggleAutopilot as toggleAutopilotAction,
  markConversationRead,
} from "@/app/dashboard/smart-inbox/actions";
import {
  getAgents,
  assignAgentToConversation,
  type AgentRow,
} from "@/app/dashboard/agentes-ia/actions";

interface InboxLayoutProps {
  initialConversations: Conversation[];
}

// ── Agent selector dropdown ───────────────────────────────────────────────────

function AgentSelector({ agents, onSelect, onClose }: {
  agents: AgentRow[];
  onSelect: (agentId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-zinc-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
        <span className="text-[11px] font-bold text-zinc-600">Seleccionar agente</span>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {agents.length === 0 ? (
        <p className="px-3 py-3 text-[11px] text-zinc-400">Sin agentes activos</p>
      ) : (
        <div className="max-h-48 overflow-y-auto py-1">
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => { onSelect(a.id); onClose(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-indigo-50 transition-colors"
            >
              <span className="text-base">{a.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-800 truncate">{a.name}</p>
                <p className="text-[10px] text-zinc-400 capitalize">{a.tone}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function InboxLayout({ initialConversations }: InboxLayoutProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [selectedId, setSelectedId]       = useState<string | null>(initialConversations[0]?.id ?? null);
  const [detailOpen, setDetailOpen]       = useState(true);
  const [isPending, startTransition]      = useTransition();
  const [agents, setAgents]               = useState<AgentRow[]>([]);
  const [agentSelectorId, setAgentSelectorId] = useState<string | null>(null);

  // Load active agents once
  useEffect(() => {
    getAgents().then((r) => {
      if (r.success && r.data) {
        setAgents(r.data.filter((a) => a.status === "active"));
      }
    });
  }, []);

  // ── Supabase Realtime ────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("inbox-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Record<string, unknown>;
          const incoming: Message = {
            id:        String(m.id),
            text:      String(m.message_text ?? ""),
            sender:    m.sender === "prospect" ? "lead" : (m.sender as Message["sender"]),
            timestamp: String(m.timestamp ?? m.created_at),
            read:      false,
            status:    "delivered",
          };
          setConversations((prev) =>
            prev.map((c) =>
              c.lead.id === String(m.lead_id)
                ? {
                    ...c,
                    messages:    [...c.messages, incoming],
                    unreadCount: c.id === selectedId ? 0 : c.unreadCount + 1,
                  }
                : c
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          setConversations((prev) =>
            prev.map((c) =>
              c.lead.id === String(updated.lead_id)
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === String(updated.id)
                        ? { ...m, status: updated.status as Message["status"] }
                        : m
                    ),
                  }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedId]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // ── Select + mark read ───────────────────────────────────────────────────────
  function selectConversation(id: string) {
    setSelectedId(id);
    setAgentSelectorId(null);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, unreadCount: 0, messages: c.messages.map((m) => ({ ...m, read: true })) }
          : c
      )
    );
    startTransition(async () => {
      await markConversationRead(id);
    });
  }

  // ── Autopilot: toggle + show agent picker ────────────────────────────────────
  function toggleAutopilot(id: string, active: boolean) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, autopilotActive: active, status: active ? "ai_handling" : "human" }
          : c
      )
    );

    if (active) {
      // Show agent selector instead of immediately sending
      setAgentSelectorId(id);
      startTransition(async () => {
        await toggleAutopilotAction(id, active);
      });
    } else {
      setAgentSelectorId(null);
      startTransition(async () => {
        await toggleAutopilotAction(id, false);
      });
    }
  }

  // ── Assign agent to conversation ─────────────────────────────────────────────
  function handleAssignAgent(agentId: string) {
    const conv = conversations.find((c) => c.id === agentSelectorId);
    if (!conv || !agentSelectorId) return;

    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      // Show the assigned agent name as a badge (stored locally for now)
      setConversations((prev) =>
        prev.map((c) =>
          c.id === agentSelectorId
            ? { ...c, assignedAgentName: agent.name, assignedAgentEmoji: agent.emoji } as Conversation & { assignedAgentName: string; assignedAgentEmoji: string }
            : c
        )
      );
    }

    setAgentSelectorId(null);

    startTransition(async () => {
      await assignAgentToConversation(agentId, agentSelectorId);
    });
  }

  // ── Send message ─────────────────────────────────────────────────────────────
  function sendMessage(convId: string, text: string) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;

    const tempId  = `temp_${Date.now()}`;
    const tempMsg: Message = {
      id:        tempId,
      text,
      sender:    "user",
      timestamp: new Date().toISOString(),
      read:      true,
      status:    "sending",
    };

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
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === tempId
                      ? { ...m, id: result.data!.message_id, status: "sent" }
                      : m
                  ),
                }
              : c
          )
        );
      }
    });
  }

  // ── AI suggestion for ChatView ───────────────────────────────────────────────
  async function requestAISuggestion(convId: string): Promise<string> {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return "";
    const history = conv.messages.slice(-6).map((m) => ({ sender: m.sender, text: m.text }));
    const result  = await generateAISuggestion({
      lead_name:            conv.lead.name,
      conversation_history: history,
    });
    return result.success ? (result.data?.suggestion ?? "") : "";
  }

  // ── Other local mutations ────────────────────────────────────────────────────
  function changeLeadStage(leadId: string, stage: PipelineStage) {
    setConversations((prev) =>
      prev.map((c) => c.lead.id === leadId ? { ...c, lead: { ...c.lead, pipeline: stage } } : c)
    );
  }

  function archiveConversation(id: string) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: "archived", resolvedAt: new Date().toISOString() } : c
      )
    );
  }

  // ── Assigned agent badge for a conversation ──────────────────────────────────
  function getAssignedAgent(conv: Conversation) {
    const extended = conv as Conversation & { assignedAgentName?: string; assignedAgentEmoji?: string };
    return extended.assignedAgentName
      ? { name: extended.assignedAgentName, emoji: extended.assignedAgentEmoji ?? "🤖" }
      : null;
  }

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={selectConversation}
      />

      {selected ? (
        <div className="flex flex-1 flex-col overflow-hidden min-h-0">
          {/* Agent badge + selector */}
          {selected.autopilotActive && (
            <div className="relative flex flex-shrink-0 items-center gap-2 border-b border-purple-100 bg-purple-50 px-4 py-1.5">
              <Bot className="h-3.5 w-3.5 text-purple-500" />
              {(() => {
                const assigned = getAssignedAgent(selected);
                return assigned ? (
                  <span className="text-[11px] font-semibold text-purple-700">
                    {assigned.emoji} {assigned.name} está manejando esta conversación
                  </span>
                ) : (
                  <span className="text-[11px] text-purple-600">Autopilot activo — sin agente asignado</span>
                );
              })()}
              <button
                onClick={() => setAgentSelectorId(agentSelectorId === selected.id ? null : selected.id)}
                className="ml-auto flex items-center gap-1 rounded-full border border-purple-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-purple-600 hover:bg-purple-100"
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
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100">
            <MessageSquare className="h-6 w-6 text-zinc-400" />
          </div>
          <p className="mt-3 text-sm font-semibold text-zinc-700">Selecciona una conversación</p>
          <p className="mt-1 text-xs text-zinc-400">Elige un lead de la lista para ver el hilo</p>
        </div>
      )}

      {selected && detailOpen && (
        <LeadDetailPanel
          lead={selected.lead}
          onClose={() => setDetailOpen(false)}
          onStageChange={changeLeadStage}
        />
      )}
    </div>
  );
}
