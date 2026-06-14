"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, AlertCircle, Ban } from "lucide-react";
import { addToBlacklist, removeFromBlacklist } from "@/app/dashboard/settings/actions";
import type { BlacklistEntry } from "@/app/dashboard/settings/actions";

const inputCls =
  "flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";

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
        <h2 className="text-lg font-semibold text-zinc-100">Blacklist</h2>
        <p className="text-sm text-zinc-400">Perfiles y emails que el motor nunca contactará</p>
      </div>

      {/* Add form */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
        <p className="text-sm font-medium text-zinc-300">Agregar a blacklist</p>
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
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
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
          <p className="text-xs text-yellow-500">Ingresa una URL de LinkedIn válida o un email</p>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* List */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-zinc-500">
            <Ban className="h-8 w-8 opacity-40" />
            <p className="text-sm">Blacklist vacía</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200">
                    {entry.linkedin_url ?? entry.email ?? "—"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {entry.linkedin_url && (
                      <span className="rounded-full bg-blue-900/30 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-800/50">
                        LinkedIn
                      </span>
                    )}
                    {entry.email && (
                      <span className="rounded-full bg-purple-900/30 px-2 py-0.5 text-[10px] font-medium text-purple-400 border border-purple-800/50">
                        Email
                      </span>
                    )}
                    {entry.reason && (
                      <span className="text-xs text-zinc-500 truncate">{entry.reason}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(entry.id)}
                  disabled={removingId === entry.id}
                  className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-red-900/30 hover:text-red-400 transition-colors disabled:opacity-50"
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

      <p className="text-xs text-zinc-600">
        {entries.length} entrada{entries.length !== 1 ? "s" : ""} en la blacklist
      </p>
    </div>
  );
}
