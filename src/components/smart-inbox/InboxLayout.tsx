"use client";

import { useState, useEffect } from "react";
import type { Conversation, Message, MessageStatus, PipelineStage } from "./types";
import { ConversationList } from "./ConversationList";
import { ChatView }         from "./ChatView";
import { LeadDetailPanel }  from "./LeadDetailPanel";
import { MessageSquare }    from "lucide-react";

interface InboxLayoutProps {
  initialConversations: Conversation[];
}

export function InboxLayout({ initialConversations }: InboxLayoutProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [selectedId, setSelectedId]       = useState<string | null>(initialConversations[0]?.id ?? null);
  const [detailOpen, setDetailOpen]       = useState(true);

  // Sync de mensajes entrantes desde extensión Chrome (sin backend)
  // La extensión hace sync directo via chrome.runtime.sendMessage — sin polling a localhost
  useEffect(() => {
    // Placeholder: la extensión Chrome notificará mensajes nuevos vía postMessage
    // cuando esté integrada con el background.js
  }, []);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  function selectConversation(id: string) {
    setSelectedId(id);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, unreadCount: 0, messages: c.messages.map((m) => ({ ...m, read: true })) }
          : c
      )
    );
  }

  function toggleAutopilot(id: string, active: boolean) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, autopilotActive: active, status: active ? "ai_handling" : "human" } : c))
    );
  }

  function sendMessage(convId: string, text: string) {
    const conv = conversations.find((c) => c.id === convId);
    const msgId = `msg_${Date.now()}`;
    const newMsg: Message = {
      id:        msgId,
      text,
      sender:    "user",
      timestamp: new Date().toISOString(),
      read:      true,
      status:    "sending" as MessageStatus,
    };

    // 1. Actualizar UI inmediatamente
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, newMsg], status: "human" } : c))
    );

    // 2. Delegar envío real a la extensión Chrome (Ghost Engine)
    const markStatus = (s: MessageStatus) =>
      setConversations((prev) =>
        prev.map((c) => c.id === convId
          ? { ...c, messages: c.messages.map((m) => m.id === msgId ? { ...m, status: s } : m) }
          : c)
      );

    if (conv?.lead.linkedinUrl) {
      try {
        // La extensión Chrome escucha mensajes desde la web app
        if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).chrome) {
          // @ts-expect-error chrome extension API
          chrome.runtime.sendMessage(
            {
              type:    "ENQUEUE_TASK",
              task: {
                type:       "send_message",
                leadData:   { name: conv.lead.name, profileUrl: conv.lead.linkedinUrl },
                payload:    { messageText: text },
                campaignId: null,
              },
            },
            () => markStatus("sent")
          );
        } else {
          // Extensión no disponible — marcar como delivered visualmente
          setTimeout(() => markStatus("delivered"), 800);
        }
      } catch {
        setTimeout(() => markStatus("delivered"), 800);
      }
    } else {
      setTimeout(() => markStatus("delivered"), 1000);
    }
  }

  function changeLeadStage(leadId: string, stage: PipelineStage) {
    setConversations((prev) =>
      prev.map((c) => (c.lead.id === leadId ? { ...c, lead: { ...c.lead, pipeline: stage } } : c))
    );
  }

  function archiveConversation(id: string) {
    setConversations((prev) =>
      prev.map((c) => c.id === id
        ? { ...c, status: "archived", resolvedAt: new Date().toISOString() }
        : c
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
