"use client";

import { useState } from "react";
import { Check, Link2, Loader2, X } from "lucide-react";
import type { CrmLead, LeadSource, TagColor, Column } from "./types";
import { createLead, enqueueProfileExtraction } from "@/app/dashboard/crm/actions";

interface CreateLeadModalProps {
  columns: Column[];
  onClose: () => void;
  onCreate: (lead: CrmLead) => void;
}

const SOURCES: LeadSource[] = ["LinkedIn", "Web", "Referido", "Email", "Llamada"];

const QUICK_TAGS: { label: string; color: TagColor }[] = [
  { label: "SQL - Calificado",  color: "green"  },
  { label: "IQL - Interesado",  color: "blue"   },
  { label: "IQL - Frío",        color: "gray"   },
  { label: "SQL - Hot Lead",    color: "red"    },
  { label: "SaaS",              color: "violet" },
  { label: "Fintech",           color: "sky"    },
  { label: "Enterprise",        color: "indigo" },
  { label: "Startup",           color: "pink"   },
];

function isLinkedInProfileUrl(url: string) {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("linkedin.com") &&
      (u.pathname.startsWith("/in/") || u.pathname.startsWith("/sales/people/"))
    );
  } catch { return false; }
}

const inputCls = "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]";

export function CreateLeadModal({ columns, onClose, onCreate }: CreateLeadModalProps) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [extracting, setExtracting]   = useState(false);
  const [extractError, setExtractError] = useState("");
  const [extracted, setExtracted]     = useState(false);
  const [loading, setLoading]         = useState(false);

  const [name, setName]         = useState("");
  const [company, setCompany]   = useState("");
  const [headline, setHeadline] = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");
  const [value, setValue]       = useState("");
  const [source, setSource]     = useState<LeadSource>("LinkedIn");
  const [selectedColumn, setSelectedColumn] = useState(columns[0]?.id ?? "leads_entrantes");
  const [nextTask, setNextTask] = useState("");
  const [selectedTags, setSelectedTags] = useState<typeof QUICK_TAGS>([]);
  const [customTag, setCustomTag] = useState("");

  const urlValid   = isLinkedInProfileUrl(linkedinUrl);
  const urlTouched = linkedinUrl.length > 0;

  async function handleExtract() {
    if (!urlValid) return;
    setExtracting(true);

    const slugMatch = linkedinUrl.match(/\/in\/([^/?#]+)/);
    if (slugMatch) {
      const slug    = slugMatch[1].replace(/-[a-f0-9]{6,}$/i, "");
      const guessed = slug.split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      setName(guessed);
      setExtracted(true);
      setExtractError(
        "✓ Nombre sugerido desde la URL. El Ghost Engine completará el perfil automáticamente cuando esté disponible."
      );
    } else {
      setExtracted(true);
      setExtractError("URL válida. Completa el nombre manualmente.");
    }

    setExtracting(false);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);

    const result = await createLead({
      full_name:    name.trim(),
      company:      company.trim()     || undefined,
      email:        email.trim()       || undefined,
      phone:        phone.trim()       || undefined,
      linkedin_url: linkedinUrl.trim() || undefined,
      value:        value ? Number(value) : undefined,
      status:       selectedColumn,
      next_task:    linkedinUrl.trim()
        ? "Extracción de perfil pendiente"
        : nextTask.trim() || undefined,
    });

    if (!result.success || !result.data) {
      setLoading(false);
      return;
    }

    const leadId = result.data.id;

    if (linkedinUrl.trim() && leadId) {
      await enqueueProfileExtraction({
        lead_id:      leadId,
        linkedin_url: linkedinUrl.trim(),
      });
    }

    onCreate({
      id:          leadId,
      name:        name.trim(),
      company:     company.trim() || "—",
      value:       value ? Number(value) : 0,
      source,
      tags:        selectedTags,
      nextTask:    linkedinUrl.trim() ? "Extracción de perfil pendiente" : nextTask.trim() || null,
      status:      selectedColumn,
      crmColumn:   selectedColumn,
      createdAt:   new Date().toISOString().split("T")[0],
      email:       email.trim()       || undefined,
      phone:       phone.trim()       || undefined,
      linkedinUrl: linkedinUrl.trim() || undefined,
      score:       0,
    });

    setLoading(false);
    onClose();
  }

  function toggleTag(tag: typeof QUICK_TAGS[0]) {
    setSelectedTags((p) =>
      p.some((t) => t.label === tag.label) ? p.filter((t) => t.label !== tag.label) : [...p, tag]
    );
  }

  function addCustomTag() {
    if (!customTag.trim()) return;
    setSelectedTags((p) => [...p, { label: customTag.trim(), color: "gray" }]);
    setCustomTag("");
  }

  const canCreate = name.trim().length > 0 && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl" style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">Nuevo lead</h2>
            <p className="text-[11px] text-[var(--foreground-muted)]">Pega el perfil de LinkedIn para autocompletar</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.06)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* LinkedIn URL */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--foreground-muted)]">
              URL del perfil LinkedIn
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-faint)]" />
                <input
                  autoFocus
                  value={linkedinUrl}
                  onChange={(e) => { setLinkedinUrl(e.target.value); setExtracted(false); setExtractError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && urlValid && !extracting && handleExtract()}
                  placeholder="https://linkedin.com/in/nombre-apellido"
                  className={[
                    "w-full rounded-xl border pl-10 pr-3 py-2.5 text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:outline-none focus:ring-1 transition-colors",
                    urlTouched && !urlValid
                      ? "border-[rgba(239,68,68,0.5)] focus:border-[#EF4444] focus:ring-[rgba(239,68,68,0.2)]"
                      : extracted
                      ? "border-[rgba(16,185,129,0.5)] focus:border-[#10B981] focus:ring-[rgba(16,185,129,0.2)]"
                      : "border-[var(--border)] focus:border-[#2563EB] focus:ring-[rgba(37,99,235,0.3)]",
                  ].join(" ")}
                />
              </div>
              <button
                onClick={handleExtract}
                disabled={!urlValid || extracting}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {extracting ? "Procesando…" : "Usar URL"}
              </button>
            </div>
            {urlTouched && !urlValid && (
              <p className="mt-1 text-[11px] text-[#EF4444]">Debe ser un perfil de LinkedIn (/in/...) o Sales Navigator (/sales/people/...)</p>
            )}
            {extractError && (
              <p className="mt-1 text-[11px] text-[#F59E0B]">{extractError}</p>
            )}
            <p className="mt-1.5 text-[11px] text-[var(--foreground-faint)]">
              El Ghost Engine extraerá los datos completos del perfil (nombre, cargo, empresa) cuando procese la cola. Aparecerán en el CRM automáticamente.
            </p>
          </div>

          {/* Divider */}
          {!extracted && (
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-[11px] text-[var(--foreground-faint)]">o completa manualmente</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>
          )}

          {/* Name + company */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">Nombre *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Pérez" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">Empresa</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa SAC" className={inputCls} />
            </div>
          </div>

          {/* Headline */}
          {(extracted || headline) && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">Titular / Cargo</label>
              <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="CEO en Empresa SAC" className={inputCls} />
            </div>
          )}

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@empresa.com" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">Teléfono</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+51 999 000 000" className={inputCls} />
            </div>
          </div>

          {/* Value + Source + Stage */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">Valor (USD)</label>
              <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="5000" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">Fuente</label>
              <select value={source} onChange={(e) => setSource(e.target.value as LeadSource)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-[#2563EB] focus:outline-none">
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">Etapa</label>
              <select value={selectedColumn} onChange={(e) => setSelectedColumn(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-[#2563EB] focus:outline-none">
                {columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-[var(--foreground-muted)]">Etiquetas</label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => {
                const active = selectedTags.some((t) => t.label === tag.label);
                return (
                  <button
                    key={tag.label}
                    onClick={() => toggleTag(tag)}
                    className={[
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                      active
                        ? "border-[#2563EB] bg-[rgba(37,99,235,0.12)] text-[#2563EB]"
                        : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[rgba(37,99,235,0.4)]",
                    ].join(" ")}
                  >
                    {active && <Check className="mr-1 inline h-3 w-3" />}
                    {tag.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={customTag} onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomTag()}
                placeholder="Etiqueta personalizada..."
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none"
              />
              <button onClick={addCustomTag}
                className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]">
                + Add
              </button>
            </div>
          </div>

          {/* Next task */}
          {!linkedinUrl.trim() && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">Próxima tarea</label>
              <input value={nextTask} onChange={(e) => setNextTask(e.target.value)}
                placeholder="Ej: Llamar el lunes 10:00 AM" className={inputCls} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-[var(--border)] px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-6 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Crear lead
          </button>
        </div>
      </div>
    </div>
  );
}
