"use client";

import { useState, useEffect, useTransition } from "react";
import type { Conversation, Message, PipelineStage } from "./types";
import { ConversationList } from "./ConversationList";
import { ChatView }         from "./ChatView";
import { LeadDetailPanel }  from "./LeadDetailPanel";
import { MessageSquare }    from "lucide-react";
import { createClient }     from "@/lib/supabase/browser";
import {
  sendInboxMessage,
  generateAISuggestion,
  toggleAutopilot as toggleAutopilotAction,
  markConversationRead,
} from "@/app/dashboard/smart-inbox/actions";

interface InboxLayoutProps {
  initialConversations: Conversation[];
}

export function InboxLayout({ initialConversations }: InboxLayoutProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [selectedId, setSelectedId]       = useState<string | null>(initialConversations[0]?.id ?? null);
  const [detailOpen, setDetailOpen]       = useState(true);
  const [isPending, startTransition]      = useTransition();

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

  // ── Autopilot ────────────────────────────────────────────────────────────────
  function toggleAutopilot(id: string, active: boolean) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, autopilotActive: active, status: active ? "ai_handling" : "human" }
          : c
      )
    );
    startTransition(async () => {
      await toggleAutopilotAction(id, active);

      if (active) {
        const conv = conversations.find((c) => c.id === id);
        if (conv) {
          const history = conv.messages.slice(-6).map((m) => ({ sender: m.sender, text: m.text }));
          const result  = await generateAISuggestion({
            lead_name:            conv.lead.name,
            conversation_history: history,
          });
          if (result.success && result.data?.suggestion) {
            await sendInboxMessage({
              conversation_id: id,
              lead_id:         conv.lead.id,
              text:            result.data.suggestion,
              linkedin_url:    conv.lead.linkedinUrl ?? "",
            });
          }
        }
      }
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

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={selectConversation}
      />

      {selected ? (
        <ChatView
          conversation={selected}
          onToggleAutopilot={toggleAutopilot}
          onSendMessage={sendMessage}
          onShowDetail={() => setDetailOpen((o) => !o)}
          onArchive={archiveConversation}
          onRequestAISuggestion={() => requestAISuggestion(selected.id)}
          isPending={isPending}
        />
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
