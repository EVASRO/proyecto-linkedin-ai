"use client";

import { useState } from "react";
import { Check, Link2, Loader2, X } from "lucide-react";
import type { CrmLead, LeadSource, TagColor, Column } from "./types";

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

export function CreateLeadModal({ columns, onClose, onCreate }: CreateLeadModalProps) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [extracting, setExtracting]   = useState(false);
  const [extractError, setExtractError] = useState("");
  const [extracted, setExtracted]     = useState(false);

  const [name, setName]         = useState("");
  const [company, setCompany]   = useState("");
  const [headline, setHeadline] = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");
  const [value, setValue]       = useState("");
  const [source, setSource]     = useState<LeadSource>("LinkedIn");
  const [status, setStatus]     = useState(columns[0]?.id ?? "leads_entrantes");
  const [nextTask, setNextTask] = useState("");
  const [selectedTags, setSelectedTags] = useState<typeof QUICK_TAGS>([]);
  const [customTag, setCustomTag] = useState("");

  const urlValid   = isLinkedInProfileUrl(linkedinUrl);
  const urlTouched = linkedinUrl.length > 0;

  async function handleExtract() {
    if (!urlValid) return;
    setExtracting(true);
    setExtractError("");

    // REGLA DE SEGURIDAD: NUNCA usar Playwright/headless para scraping.
    // Usar SOLO la extensión Chrome que ya tiene la sesión real de LinkedIn.
    // Playwright es detectado por LinkedIn como bot y cierra la sesión.
    try {
      // Opción 1: extensión Chrome instalada → extrae el perfil sin riesgo de ban
      const extResult = await new Promise<{ name?: string; company?: string; headline?: string } | null>((resolve) => {
        // Intentar comunicación con la extensión NexusAI
        if (typeof window === "undefined" || !(window as unknown as Record<string, unknown>).chrome) {
          resolve(null);
          return;
        }
        // Pedir a la extensión que extraiga el perfil de la URL dada
        // La extensión abre/navega al perfil en una pestaña temporal
        const timeout = setTimeout(() => resolve(null), 8000);
        try {
          // @ts-expect-error chrome extension API
          chrome.runtime.sendMessage(
            { type: "EXTRACT_PROFILE_URL", url: linkedinUrl },
            (response: { success?: boolean; data?: { name?: string; company?: string; headline?: string } }) => {
              clearTimeout(timeout);
              if (response?.success && response.data) resolve(response.data);
              else resolve(null);
            }
          );
        } catch {
          clearTimeout(timeout);
          resolve(null);
        }
      });

      if (extResult?.name) {
        setName(extResult.name);
        if (extResult.company) setCompany(extResult.company);
        if (extResult.headline) setHeadline(extResult.headline);
        setExtracted(true);
        return;
      }
    } catch { /* extensión no disponible */ }

    // Opción 2: fallback seguro — extraer nombre solo desde el slug de la URL
    // (sin hacer ninguna petición a LinkedIn)
    const slugMatch = linkedinUrl.match(/\/in\/([^/?#]+)/);
    if (slugMatch) {
      const slug = slugMatch[1];
      // Limpiar sufijos de ID tipo "-4592ba251"
      const cleanSlug = slug.replace(/-[a-f0-9]{6,}$/i, "");
      const nameFromUrl = cleanSlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      setName(nameFromUrl);
      setExtracted(true);
      setExtractError("Nombre extraído de la URL. Completa empresa y cargo manualmente.");
    } else {
      setExtractError("Instala la extensión NexusAI en Chrome para extracción automática completa.");
      setExtracted(true);
    }
    setExtracting(false);
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

  function handleCreate() {
    if (!name.trim()) return;
    const lead: CrmLead = {
      id: `lead_${Date.now()}`,
      name: name.trim(),
      company: company.trim() || "—",
      value: parseInt(value) || 0,
      source,
      tags: selectedTags,
      nextTask: nextTask.trim() || null,
      status,
      createdAt: new Date().toISOString().split("T")[0],
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      linkedinUrl: linkedinUrl.trim() || undefined,
    };
    onCreate(lead);
    onClose();
  }

  const canCreate = name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Nuevo lead</h2>
            <p className="text-[11px] text-zinc-400">Pega el perfil de LinkedIn para autocompletar</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* LinkedIn URL — primer campo */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
              URL del perfil LinkedIn <span className="text-indigo-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  autoFocus
                  value={linkedinUrl}
                  onChange={(e) => { setLinkedinUrl(e.target.value); setExtracted(false); setExtractError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && urlValid && !extracting && handleExtract()}
                  placeholder="https://linkedin.com/in/nombre-apellido"
                  className={[
                    "w-full rounded-xl border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-colors",
                    urlTouched && !urlValid
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : extracted
                      ? "border-green-400 focus:border-green-400 focus:ring-green-100"
                      : "border-zinc-200 focus:border-indigo-400 focus:ring-indigo-100",
                  ].join(" ")}
                />
              </div>
              <button
                onClick={handleExtract}
                disabled={!urlValid || extracting}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {extracting ? "Extrayendo…" : "Extraer"}
              </button>
            </div>
            {urlTouched && !urlValid && (
              <p className="mt-1 text-[11px] text-red-500">Debe ser un perfil de LinkedIn (/in/...) o Sales Navigator (/sales/people/...)</p>
            )}
            {extractError && (
              <p className="mt-1 text-[11px] text-amber-600">{extractError}</p>
            )}
            {extracted && !extractError && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-green-600 font-medium">
                <Check className="h-3 w-3" /> Perfil extraído correctamente
              </p>
            )}
          </div>

          {/* Divider con instrucción */}
          {!extracted && (
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-100" />
              <span className="text-[11px] text-zinc-400">o completa manualmente</span>
              <div className="h-px flex-1 bg-zinc-100" />
            </div>
          )}

          {/* Name + company */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Nombre *</label>
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Juan Pérez"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Empresa</label>
              <input
                value={company} onChange={(e) => setCompany(e.target.value)}
                placeholder="Empresa SAC"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {/* Headline */}
          {(extracted || headline) && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Titular / Cargo</label>
              <input
                value={headline} onChange={(e) => setHeadline(e.target.value)}
                placeholder="CEO en Empresa SAC"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          )}

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@empresa.com"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Teléfono</label>
              <input
                value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+51 999 000 000"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {/* Value + Source + Stage */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Valor (USD)</label>
              <input
                type="number" value={value} onChange={(e) => setValue(e.target.value)}
                placeholder="5000"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Fuente</label>
              <select
                value={source} onChange={(e) => setSource(e.target.value as LeadSource)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none"
              >
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Etapa</label>
              <select
                value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none"
              >
                {columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-zinc-700">Etiquetas</label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => {
                const active = selectedTags.some((t) => t.label === tag.label);
                return (
                  <button
                    key={tag.label}
                    onClick={() => toggleTag(tag)}
                    className={[
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                      active ? "border-indigo-400 bg-indigo-100 text-indigo-700" : "border-zinc-200 text-zinc-600 hover:border-zinc-300",
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
                className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs focus:border-indigo-400 focus:outline-none"
              />
              <button
                onClick={addCustomTag}
                className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Next task */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700">Próxima tarea</label>
            <input
              value={nextTask} onChange={(e) => setNextTask(e.target.value)}
              placeholder="Ej: Llamar el lunes 10:00 AM"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-zinc-100 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            Crear lead
          </button>
        </div>
      </div>
    </div>
  );
}
