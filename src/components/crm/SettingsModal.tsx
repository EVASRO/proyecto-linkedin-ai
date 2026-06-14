"use client";

import { Download, Plus, Trash2, Upload, X } from "lucide-react";
import type { CrmLead } from "./types";

const CUSTOM_FIELDS = [
  "Nombre",
  "Empresa",
  "Email",
  "Teléfono",
  "Valor del deal",
  "Fuente de adquisición",
  "Etiquetas",
  "Siguiente tarea",
  "Notas internas",
];

function exportCSV(leads: CrmLead[]) {
  const headers = [
    "ID", "Nombre", "Empresa", "Valor", "Fuente", "Estado", "Siguiente tarea",
  ];
  const rows = leads.map((l) => [
    l.id, l.name, l.company, l.value, l.source, l.status, l.nextTask ?? "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map(String).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cazary_leads_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface SettingsModalProps {
  leads: CrmLead[];
  onClose: () => void;
}

export function SettingsModal({ leads, onClose }: SettingsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Configuración del CRM
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--foreground-muted)]">
              Gestiona datos, importa y configura campos
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--foreground-faint)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--foreground-muted)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Export / Import */}
          <section>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
              Importar / Exportar
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => exportCSV(leads)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
              >
                <Download className="h-4 w-4 text-[var(--foreground-faint)]" />
                Exportar CSV
              </button>
              <button className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:bg-[rgba(255,255,255,0.06)]">
                <Upload className="h-4 w-4 text-[var(--foreground-faint)]" />
                Importar CSV
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[var(--foreground-faint)]">
              {leads.length} lead{leads.length !== 1 ? "s" : ""} activos ·{" "}
              {(() => { const t = leads.reduce((s, l) => s + l.value, 0); return t >= 1000 ? `$${(t / 1000).toFixed(0)}K` : `$${t}`; })()} en pipeline
            </p>
          </section>

          {/* Custom fields */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                Campos personalizados
              </h3>
              <button className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90">
                <Plus className="h-3 w-3" />
                Añadir campo
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
              {CUSTOM_FIELDS.map((field) => (
                <div
                  key={field}
                  className="group flex items-center justify-between px-3 py-2.5 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                >
                  <span className="text-sm text-[var(--foreground-muted)]">{field}</span>
                  <button className="hidden h-6 w-6 items-center justify-center rounded text-[var(--foreground-faint)] transition-colors hover:text-[#EF4444] group-hover:flex">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex justify-end rounded-b-2xl border-t border-[var(--border)] bg-[var(--background)] px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
