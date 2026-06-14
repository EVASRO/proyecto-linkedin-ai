"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Archive, Check, MoreVertical, User } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Conversation, ConvStatus } from "./types";
import { archiveConversation, markConversationRead } from "@/app/dashboard/smart-inbox/actions";

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
  const palette = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#DB2777", "#0891B2"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const STATUS_DOT: Record<ConvStatus, string> = {
  new:         "bg-[#2563EB]",
  active:      "bg-[#10B981]",
  ai_handling: "bg-violet-500",
  human:       "bg-[#F59E0B]",
  archived:    "bg-[var(--foreground-faint)]",
};

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
        className="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
        style={{ color: "var(--foreground-faint)" }}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl shadow-xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); handleMarkRead(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--foreground-muted)" }}
          >
            <Check className="h-3.5 w-3.5" style={{ color: "var(--foreground-faint)" }} />
            Marcar como leído
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleViewLead(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--foreground-muted)" }}
          >
            <User className="h-3.5 w-3.5" style={{ color: "var(--foreground-faint)" }} />
            Ver lead en CRM
          </button>
          <div className="my-1 h-px" style={{ background: "var(--border)" }} />
          <button
            onClick={(e) => { e.stopPropagation(); handleArchive(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--foreground-muted)" }}
          >
            <Archive className="h-3.5 w-3.5" style={{ color: "var(--foreground-faint)" }} />
            Archivar conversación
          </button>
        </div>
      )}
    </div>
  );
}

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
      <div className="flex-1 overflow-y-auto">
        {localConvs.length === 0 && (
          <p className="px-4 py-8 text-center text-xs" style={{ color: "var(--foreground-faint)" }}>
            Sin conversaciones
          </p>
        )}
        {localConvs.map((conv) => {
          const lastMsg  = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
          const isSelected = conv.id === selectedId;
          const isUnread   = conv.unreadCount > 0;

          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className="group relative flex w-full cursor-pointer items-start gap-3 px-3 py-3 transition-colors"
              style={{
                background: isSelected ? "var(--primary-soft)" : undefined,
                borderLeft: isSelected ? "2px solid #2563EB" : "2px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "var(--surface-hover)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "";
              }}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: avatarColor(conv.lead.name) }}
                >
                  {initials(conv.lead.name)}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 ${STATUS_DOT[conv.status]}`}
                  style={{ borderColor: "var(--surface)" }}
                />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1">
                  <p
                    className="truncate text-[13px]"
                    style={{
                      fontWeight: isUnread ? 700 : 500,
                      color: isUnread ? "var(--foreground)" : "var(--foreground-muted)",
                    }}
                  >
                    {conv.lead.name}
                  </p>
                  <span
                    className="flex-shrink-0 text-[10px] group-hover:hidden"
                    style={{ color: "var(--foreground-faint)" }}
                  >
                    {lastMsg ? fmtTime(lastMsg.timestamp) : ""}
                  </span>
                  <div className="hidden group-hover:flex flex-shrink-0">
                    <RowMenu
                      conv={conv}
                      onArchived={(id) => setLocalConvs((prev) => prev.filter((c) => c.id !== id))}
                    />
                  </div>
                </div>

                <p
                  className="mt-0.5 truncate text-xs leading-snug"
                  style={{ color: "var(--foreground-faint)" }}
                >
                  {conv.lead.company}
                </p>

                <div className="mt-1 flex items-center justify-between gap-1">
                  <p
                    className="truncate text-[11px]"
                    style={{ color: isUnread ? "var(--foreground-muted)" : "var(--foreground-faint)" }}
                  >
                    {lastMsg ? (
                      <>
                        {lastMsg.sender === "ai" ? "🤖 " : lastMsg.sender === "user" ? "Tú: " : ""}
                        {lastMsg.text.slice(0, 50)}{lastMsg.text.length > 50 ? "…" : ""}
                      </>
                    ) : (
                      <span className="italic">Sin mensajes</span>
                    )}
                  </p>
                  {isUnread && (
                    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-[9px] font-bold text-white">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
