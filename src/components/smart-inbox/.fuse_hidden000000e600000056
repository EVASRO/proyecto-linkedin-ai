"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Archive, Bot, Check, Globe, Link2, MoreVertical, User } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Conversation, ConvStatus } from "./types";
import { archiveConversation, markConversationRead } from "@/app/dashboard/smart-inbox/actions";

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

// ── Row menu ──────────────────────────────────────────────────────────────────

interface RowMenuProps {
  conv: Conversation;
  onArchived: (id: string) => void;
}

function RowMenu({ conv, onArchived }: RowMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleMarkRead() {
    setOpen(false);
    startTransition(async () => {
      await markConversationRead(conv.id);
      router.refresh();
    });
  }

  function handleArchive() {
    setOpen(false);
    startTransition(async () => {
      await archiveConversation(conv.id);
      onArchived(conv.id);
      router.refresh();
    });
  }

  function handleViewLead() {
    setOpen(false);
    router.push(`/dashboard/crm?lead=${conv.lead.id}`);
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        disabled={isPending}
        className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
          <button
            onClick={(e) => { e.stopPropagation(); handleMarkRead(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            <Check className="h-3.5 w-3.5 text-zinc-400" />
            Marcar como leído
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleViewLead(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            <User className="h-3.5 w-3.5 text-zinc-400" />
            Ver lead en CRM
          </button>
          <div className="my-1 h-px bg-zinc-100" />
          <button
            onClick={(e) => { e.stopPropagation(); handleArchive(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-700 hover:bg-amber-50"
          >
            <Archive className="h-3.5 w-3.5 text-zinc-400" />
            Archivar conversación
          </button>
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [localConvs, setLocalConvs] = useState(conversations);

  useEffect(() => { setLocalConvs(conversations); }, [conversations]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
        {localConvs.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-zinc-400">Sin conversaciones</p>
        )}
        {localConvs.map((conv) => {
          const lastMsg    = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
          const selected   = conv.id === selectedId;
          const status     = STATUS_CONFIG[conv.status] ?? STATUS_CONFIG.active;
          const SourceIcon = conv.lead.source === "linkedin" ? Link2 : Globe;

          return (
            <div
              key={conv.id}
              className={[
                "group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors cursor-pointer",
                selected ? "bg-indigo-50 border-l-2 border-indigo-500" : "hover:bg-zinc-50 border-l-2 border-transparent",
              ].join(" ")}
              onClick={() => onSelect(conv.id)}
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
                  <span className="flex-shrink-0 text-[10px] text-zinc-400 group-hover:hidden">
                    {lastMsg ? fmtTime(lastMsg.timestamp) : conv.lead.createdAt ?? ""}
                  </span>
                  <div className="hidden group-hover:flex flex-shrink-0">
                    <RowMenu
                      conv={conv}
                      onArchived={(id) => setLocalConvs((prev) => prev.filter((c) => c.id !== id))}
                    />
                  </div>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
