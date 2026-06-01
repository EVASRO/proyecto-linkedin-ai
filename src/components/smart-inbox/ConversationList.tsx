"use client";

import { useState } from "react";
import { Bot, Globe, Link2, Search } from "lucide-react";
import type { Conversation, ConvStatus } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (diff < 604800000) {
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    return days[d.getDay()];
  }
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function avatarColor(name: string): string {
  const palette = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-pink-500", "bg-indigo-600", "bg-sky-500", "bg-orange-500"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const STATUS_CONFIG: Record<ConvStatus, { label: string; dot: string }> = {
  new:         { label: "Nuevo",       dot: "bg-blue-500"   },
  active:      { label: "Activo",      dot: "bg-green-400"  },
  ai_handling: { label: "Autopilot",   dot: "bg-purple-500" },
  human:       { label: "Manual",      dot: "bg-amber-400"  },
  archived:    { label: "Archivado",   dot: "bg-zinc-400"   },
};

const FILTERS: { id: ConvStatus | "all"; label: string }[] = [
  { id: "all",         label: "Todo"      },
  { id: "new",         label: "Nuevos"    },
  { id: "ai_handling", label: "Autopilot" },
  { id: "human",       label: "Manual"    },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ConvStatus | "all">("all");

  const visible = conversations.filter((c) => {
    const matchFilter = filter === "all" || c.status === filter;
    const matchQuery  = !query || c.lead.name.toLowerCase().includes(query.toLowerCase()) || c.lead.company.toLowerCase().includes(query.toLowerCase());
    return matchFilter && matchQuery;
  });

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <div className="flex w-72 flex-shrink-0 flex-col border-r border-border bg-white">
      {/* Header */}
      <div className="border-b border-border px-4 py-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900">Smart Inbox</h2>
          {totalUnread > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white">
              {totalUnread}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative mt-2.5">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversación..."
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-300 focus:bg-white focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="mt-2.5 flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={[
                "flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors",
                filter === f.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
        {visible.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-zinc-400">Sin conversaciones</p>
        )}
        {visible.map((conv) => {
          const lastMsg  = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
          const selected = conv.id === selectedId;
          const status   = STATUS_CONFIG[conv.status] ?? STATUS_CONFIG.active;
          const SourceIcon = conv.lead.source === "linkedin" ? Link2 : Globe;

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={[
                "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                selected ? "bg-indigo-50 border-l-2 border-indigo-500" : "hover:bg-zinc-50 border-l-2 border-transparent",
              ].join(" ")}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarColor(conv.lead.name)}`}>
                  {initials(conv.lead.name)}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${status.dot}`} />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1">
                  <p className={`truncate text-xs ${conv.unreadCount > 0 ? "font-bold text-zinc-900" : "font-medium text-zinc-700"}`}>
                    {conv.lead.name}
                  </p>
                  <span className="flex-shrink-0 text-[10px] text-zinc-400">
                    {lastMsg ? fmtTime(lastMsg.timestamp) : conv.lead.createdAt ?? ""}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <SourceIcon className="h-2.5 w-2.5 flex-shrink-0 text-zinc-400" />
                  <p className="truncate text-[10px] text-zinc-400">{conv.lead.company}</p>
                </div>

                <div className="mt-1 flex items-center justify-between gap-1">
                  <p className={`truncate text-[11px] ${conv.unreadCount > 0 ? "font-medium text-zinc-700" : "text-zinc-500"}`}>
                    {lastMsg
                      ? <>{lastMsg.sender === "ai" ? "🤖 " : lastMsg.sender === "user" ? "Tú: " : ""}{lastMsg.text.slice(0, 55)}{lastMsg.text.length > 55 ? "…" : ""}</>
                      : <span className="italic text-zinc-400">Sin mensajes aún</span>}
                  </p>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {conv.autopilotActive && <Bot className="h-3 w-3 text-purple-500" />}
                    {conv.unreadCount > 0 && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
