"use client";

import { useState, useEffect } from "react";
import { Copy, Check, CheckCircle } from "lucide-react";
import { type Lead } from "@/lib/supabase";
import { updateLeadStatus } from "./actions";
import { createClient } from "@/lib/supabase/browser";

const STATUS_STYLES: Record<string, string> = {
  nuevo:       "bg-blue-50   text-blue-700   ring-blue-600/20",
  contactado:  "bg-green-50  text-green-700  ring-green-600/20",
  respondio:   "bg-purple-50 text-purple-700 ring-purple-600/20",
  demo:        "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cerrado:     "bg-green-100 text-green-800  ring-green-600/20",
  perdido:     "bg-red-50    text-red-700    ring-red-600/20",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status.toLowerCase()] ?? "bg-zinc-100 text-zinc-600 ring-zinc-500/20";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
}

export function LeadsTable({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads]       = useState<Lead[]>(initialLeads);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("crm-leads")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        (payload) => {
          const updated = payload.new as Lead;
          setLeads((prev) =>
            prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (payload) => {
          const newLead = payload.new as Lead;
          setLeads((prev) =>
            prev.some((l) => l.id === newLead.id) ? prev : [newLead, ...prev]
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleCopy(lead: Lead) {
    const text = lead.ai_summary ?? lead.full_name;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(lead.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* clipboard denied */ }
  }

  async function handleContact(lead: Lead) {
    if (lead.status === "contactado" || pendingId === lead.id) return;
    setPendingId(lead.id);
    try {
      await updateLeadStatus(lead.id, "contactado");
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, status: "contactado" } : l))
      );
    } catch { /* server action failed */ } finally {
      setPendingId(null);
    }
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 text-4xl">📭</div>
        <p className="text-sm font-medium text-foreground">Sin leads todavía</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Usa la extensión NexusAI en un perfil de LinkedIn para capturar tu primer prospecto.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <th className="px-6 py-3">Nombre</th>
            <th className="px-6 py-3">Empresa</th>
            <th className="px-6 py-3">Resumen IA</th>
            <th className="px-6 py-3">Estado</th>
            <th className="px-6 py-3">Capturado</th>
            <th className="px-6 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {leads.map((lead) => {
            const isContacted = lead.status === "contactado";
            const isCopied    = copiedId  === lead.id;
            const isPending   = pendingId === lead.id;
            return (
              <tr key={lead.id} className="hover:bg-zinc-50/60 transition-colors">
                <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                  {lead.full_name}
                </td>
                <td className="px-6 py-4 text-muted-foreground max-w-[180px] truncate">
                  {lead.company ?? lead.headline ?? "—"}
                </td>
                <td className="px-6 py-4 text-muted-foreground max-w-[320px]">
                  <p className="line-clamp-2">{lead.ai_summary ?? "—"}</p>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                  {new Date(lead.created_at).toLocaleDateString("es-PE", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(lead)}
                      title="Copiar resumen IA"
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
                    >
                      {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      <span>{isCopied ? "Copiado" : "Copiar"}</span>
                    </button>
                    <button
                      onClick={() => handleContact(lead)}
                      disabled={isContacted || isPending}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                        isContacted  ? "text-green-600 cursor-default" :
                        isPending    ? "text-zinc-400 cursor-wait"      :
                        "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                      }`}
                    >
                      <CheckCircle size={14} className={isContacted ? "text-green-500" : ""} />
                      <span>{isContacted ? "Contactado" : isPending ? "…" : "Contactar"}</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
