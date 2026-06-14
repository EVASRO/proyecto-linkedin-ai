"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, AlertCircle, Ban } from "lucide-react";
import { addToBlacklist, removeFromBlacklist } from "@/app/dashboard/settings/actions";
import type { BlacklistEntry } from "@/app/dashboard/settings/actions";

const inputCls =
  "flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:ring-1 focus:ring-[rgba(37,99,235,0.3)] transition-all";

type Props = { initial: BlacklistEntry[] };

export function BlacklistSettings({ initial }: Props) {
  const [entries, setEntries] = useState<BlacklistEntry[]>(initial);
  const [input, setInput]     = useState("");
  const [reason, setReason]   = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [addPending, startAdd]    = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isLinkedIn = input.includes("linkedin.com") || input.includes("/in/");
  const isEmail    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);

  async function handleAdd() {
    if (!input.trim()) return;
    setError(null);
    startAdd(async () => {
      const payload = isLinkedIn
        ? { linkedin_url: input.trim(), reason: reason || undefined }
        : { email: input.trim(), reason: reason || undefined };

      const res = await addToBlacklist(payload);
      if (res.success && res.data) {
        setEntries((prev) => [res.data!, ...prev]);
        setInput("");
        setReason("");
      } else {
        setError(res.error ?? "Error al agregar");
      }
    });
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    const res = await removeFromBlacklist(id);
    if (res.success) setEntries((prev) => prev.filter((e) => e.id !== id));
    else setError(res.error ?? "Error al eliminar");
    setRemovingId(null);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Blacklist</h2>
        <p className="text-sm text-[var(--foreground-muted)]">Perfiles y emails que el motor nunca contactará</p>
      </div>

      {/* Add form */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
        <p className="text-sm font-medium text-[var(--foreground)]">Agregar a blacklist</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="URL de LinkedIn o email"
            className={inputCls}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={addPending || (!isLinkedIn && !isEmail && input.trim().length > 0) || !input.trim()}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-3 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
          >
            {addPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar
          </button>
        </div>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional)"
          className={`${inputCls} flex-none w-full`}
        />
        {input.trim() && !isLinkedIn && !isEmail && (
          <p className="text-xs text-[#F59E0B]">Ingresa una URL de LinkedIn válida o un email</p>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-sm text-[#EF4444]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* List */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-[var(--foreground-faint)]">
            <Ban className="h-8 w-8 opacity-40" />
            <p className="text-sm">Blacklist vacía</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {entry.linkedin_url ?? entry.email ?? "—"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {entry.linkedin_url && (
                      <span className="rounded-full bg-[rgba(37,99,235,0.12)] px-2 py-0.5 text-[10px] font-medium text-[#2563EB] border border-[rgba(37,99,235,0.3)]">
                        LinkedIn
                      </span>
                    )}
                    {entry.email && (
                      <span className="rounded-full bg-[rgba(6,182,212,0.12)] px-2 py-0.5 text-[10px] font-medium text-[#06B6D4] border border-[rgba(6,182,212,0.3)]">
                        Email
                      </span>
                    )}
                    {entry.reason && (
                      <span className="text-xs text-[var(--foreground-faint)] truncate">{entry.reason}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(entry.id)}
                  disabled={removingId === entry.id}
                  className="shrink-0 rounded-lg p-1.5 text-[var(--foreground-faint)] hover:bg-[rgba(239,68,68,0.1)] hover:text-[#EF4444] transition-colors disabled:opacity-50"
                >
                  {removingId === entry.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />
                  }
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-[var(--foreground-faint)]">
        {entries.length} entrada{entries.length !== 1 ? "s" : ""} en la blacklist
      </p>
    </div>
  );
}
