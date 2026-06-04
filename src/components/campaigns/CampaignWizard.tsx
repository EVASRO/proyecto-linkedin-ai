"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft, ArrowRight, Check, Link2, Loader2, Mail, X, FileText,
  Sparkles, Users,
} from "lucide-react";
import type { CampaignType, WizardData, Template } from "./types";

// chrome.runtime is only available inside a Chrome extension content/popup context.
// When the wizard runs inside Next.js (web), it falls back to the manual flow.
type ChromeRuntime = { sendMessage: (msg: unknown) => Promise<unknown> };
declare const chrome: { runtime: ChromeRuntime } | undefined;

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: {
  type: CampaignType;
  label: string;
  sub: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}[] = [
  { type: "linkedin",       label: "LinkedIn",       sub: "Perfil estándar · hasta 30 conexiones/día",   icon: Link2,    color: "text-blue-700",  bg: "bg-blue-50 border-blue-200 hover:border-blue-400"   },
  { type: "sales_navigator",label: "Sales Navigator",sub: "Búsqueda avanzada · filtros premium",          icon: Sparkles, color: "text-violet-700",bg: "bg-violet-50 border-violet-200 hover:border-violet-400"},
  { type: "email",          label: "Email",          sub: "Campaña masiva · outreach por correo",         icon: Mail,     color: "text-sky-700",   bg: "bg-sky-50 border-sky-200 hover:border-sky-400"      },
];

const EMPTY_WIZARD: WizardData = {
  campaignType: null,
  campaignName: "",
  segmentationUrl: "",
  crmSegment: null,
  segmentName: "",
  automationName: "",
  selectedTemplateId: null,
  estimatedLeads: 0,
};

// ── Step 1 — Identity ─────────────────────────────────────────────────────────

function Step1({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (d: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Tipo de campaña
        </p>
        <div className="grid grid-cols-3 gap-3">
          {TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = data.campaignType === opt.type;
            return (
              <button
                key={opt.type}
                onClick={() => onChange({ campaignType: opt.type })}
                className={[
                  "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all",
                  selected
                    ? `${opt.bg} ${opt.color} font-semibold shadow-sm`
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
                ].join(" ")}
              >
                {selected && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900">
                    <Check className="h-3 w-3 text-white" />
                  </span>
                )}
                <div className={["flex h-10 w-10 items-center justify-center rounded-xl", selected ? opt.bg : "bg-zinc-100"].join(" ")}>
                  <Icon className={["h-5 w-5", selected ? opt.color : "text-zinc-500"].join(" ")} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500 leading-snug">{opt.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Nombre de la campaña
        </label>
        <input
          autoFocus
          value={data.campaignName}
          onChange={(e) => onChange({ campaignName: e.target.value })}
          placeholder="Ej: Directores IT Lima — Q3 2026"
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidLinkedInUrl(url: string, type: CampaignType | null): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("linkedin.com")) return false;
    if (type === "sales_navigator") return u.pathname.startsWith("/sales");
    return (
      u.pathname.startsWith("/search/results/") ||
      u.pathname.startsWith("/in/") ||
      u.pathname.startsWith("/company/")
    );
  } catch {
    return false;
  }
}

// ── Step 2 — Segmentación ─────────────────────────────────────────────────────

type CountState =
  | { status: "idle" }
  | { status: "counting" }
  | { status: "done"; count: number }
  | { status: "needs_nav" }
  | { status: "manual" }
  | { status: "error"; msg: string };

function Step2({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (d: Partial<WizardData>) => void;
}) {
  const [countState, setCountState] = useState<CountState>({ status: "idle" });
  const [manualInput, setManualInput] = useState("");
  const DAILY_RATE = 30;

  const urlValid   = isValidLinkedInUrl(data.segmentationUrl, data.campaignType);
  const urlTouched = data.segmentationUrl.length > 0;
  const urlError   = urlTouched && !urlValid;

  // Reset count state when URL changes
  useEffect(() => {
    setCountState({ status: "idle" });
  }, [data.segmentationUrl]);

  async function handleCount() {
    setCountState({ status: "counting" });
    try {
      if (typeof chrome === "undefined" || !chrome?.runtime?.sendMessage) {
        setCountState({ status: "manual" });
        return;
      }
      const resp = await chrome!.runtime.sendMessage({ type: "NEXUSAI_COUNT_LEADS" }) as {
        count: number | null;
        needsNavigation?: boolean;
        error?: string;
      };
      if (resp.needsNavigation) {
        setCountState({ status: "needs_nav" });
        return;
      }
      if (resp.count && resp.count > 0) {
        setCountState({ status: "done", count: resp.count });
        onChange({ estimatedLeads: resp.count });
      } else {
        setCountState({ status: "manual" });
      }
    } catch {
      setCountState({ status: "manual" });
    }
  }

  function applyManual() {
    const n = parseInt(manualInput.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(n) && n > 0) {
      onChange({ estimatedLeads: n });
      setCountState({ status: "done", count: n });
    }
  }

  const estimatedLeads = countState.status === "done" ? countState.count : (data.estimatedLeads ?? 0);
  const estimatedDays  = estimatedLeads > 0 ? Math.ceil(estimatedLeads / DAILY_RATE) : null;

  if (data.campaignType === "email") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600">
          Selecciona el segmento de contactos del CRM que recibirá esta campaña:
        </p>
        <div className="space-y-2">
          {([] as { id: string; label: string; count: number }[]).map((seg) => (
            <button
              key={seg.id}
              onClick={() => onChange({ crmSegment: seg.id })}
              className={[
                "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                data.crmSegment === seg.id
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
              ].join(" ")}
            >
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 opacity-60" />
                <span className="text-sm font-medium">{seg.label}</span>
              </div>
              <span className="text-xs text-zinc-400">{seg.count} leads</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* URL input */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
          URL de segmentación
        </label>
        <input
          value={data.segmentationUrl}
          onChange={(e) => onChange({ segmentationUrl: e.target.value })}
          placeholder={
            data.campaignType === "sales_navigator"
              ? "https://www.linkedin.com/sales/search/people?..."
              : "https://www.linkedin.com/search/results/people/..."
          }
          className={[
            "w-full rounded-xl border bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 transition-colors",
            urlError
              ? "border-red-400 focus:border-red-400 focus:ring-red-100"
              : urlValid
              ? "border-green-400 focus:border-green-400 focus:ring-green-100"
              : "border-zinc-200 focus:border-indigo-400 focus:ring-indigo-100",
          ].join(" ")}
        />
        {urlError && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
            <span>✕</span>
            {data.campaignType === "sales_navigator"
              ? "Debe ser una URL de Sales Navigator (linkedin.com/sales/...)"
              : "Debe ser una URL válida de LinkedIn (linkedin.com/search/... o linkedin.com/in/...)"}
          </p>
        )}
      </div>

      {/* How-to hint */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">¿Cómo obtener la URL?</p>
        <ol className="list-decimal space-y-1 pl-4 text-[12px] leading-relaxed text-blue-700">
          <li>Ve a {data.campaignType === "sales_navigator" ? "Sales Navigator" : "LinkedIn"} → Buscar personas</li>
          <li>Aplica tus filtros: sector, cargo, ubicación, empresa</li>
          <li>Copia la URL completa del navegador y pégala aquí</li>
        </ol>
      </div>

      {/* Count leads panel */}
      {urlValid && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-700">Número estimado de leads</p>
            {countState.status === "idle" && (
              <button
                onClick={handleCount}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                Contar leads
              </button>
            )}
          </div>

          {countState.status === "counting" && (
            <div className="flex items-center gap-2 text-indigo-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-[11px]">Consultando LinkedIn…</span>
            </div>
          )}

          {countState.status === "done" && (
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-xl font-black tabular-nums text-zinc-900">~{countState.count.toLocaleString("es-PE")}</span>
                <span className="text-[10px] text-zinc-500">leads estimados</span>
              </div>
              {estimatedDays && (
                <>
                  <div className="h-8 w-px bg-zinc-200" />
                  <div className="flex flex-col">
                    <span className="text-xl font-black tabular-nums text-zinc-900">~{estimatedDays}d</span>
                    <span className="text-[10px] text-zinc-500">duración estimada</span>
                  </div>
                  <div className="h-8 w-px bg-zinc-200" />
                  <div className="flex flex-col">
                    <span className="text-xl font-black tabular-nums text-zinc-900">{DAILY_RATE}/día</span>
                    <span className="text-[10px] text-zinc-500">velocidad segura</span>
                  </div>
                </>
              )}
              <button
                onClick={() => setCountState({ status: "idle" })}
                className="ml-auto text-[10px] text-zinc-400 hover:text-zinc-600 underline"
              >
                Recontar
              </button>
            </div>
          )}

          {countState.status === "needs_nav" && (
            <div className="space-y-2">
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                Abre la URL del segmento en LinkedIn y vuelve a hacer click en "Contar leads", o ingresa el número manualmente.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Nº estimado de leads"
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  onClick={applyManual}
                  disabled={!manualInput}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-zinc-700 disabled:opacity-40"
                >
                  Aplicar
                </button>
                <button onClick={handleCount} className="text-[11px] text-indigo-600 hover:underline">Reintentar</button>
              </div>
            </div>
          )}

          {(countState.status === "manual" || countState.status === "error") && (
            <div className="space-y-2">
              <p className="text-[11px] text-zinc-500">
                La extensión no pudo leer el conteo automáticamente. Ingresa el número estimado:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Ej: 1500"
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  onClick={applyManual}
                  disabled={!manualInput}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-zinc-700 disabled:opacity-40"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-zinc-400 italic">
            Número estimado — la extensión contará con precisión al lanzar la campaña.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Step 3 — Estructura ───────────────────────────────────────────────────────

function Step3({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (d: Partial<WizardData>) => void;
}) {
  const compatibleTemplates: import("./types").Template[] = [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Nombre del segmento
          </label>
          <input
            value={data.segmentName}
            onChange={(e) => onChange({ segmentName: e.target.value })}
            placeholder="Ej: Directores IT Lima"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Nombre de la automatización
          </label>
          <input
            value={data.automationName}
            onChange={(e) => onChange({ automationName: e.target.value })}
            placeholder="Ej: Secuencia de conexión"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Plantilla de automatización
        </p>
        <div className="grid grid-cols-2 gap-2">
          {/* From scratch */}
          <button
            onClick={() => onChange({ selectedTemplateId: null })}
            className={[
              "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
              data.selectedTemplateId === null
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
            ].join(" ")}
          >
            <Sparkles className="h-5 w-5" />
            <div className="text-center">
              <p className="text-xs font-semibold">Desde cero</p>
              <p className="text-[10px] opacity-70">Lienzo en blanco</p>
            </div>
          </button>

          {/* Templates */}
          {compatibleTemplates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onChange({ selectedTemplateId: tpl.id })}
              className={[
                "flex flex-col items-start gap-1.5 rounded-xl border-2 p-3.5 text-left transition-all",
                data.selectedTemplateId === tpl.id
                  ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
              ].join(" ")}
            >
              <div className="flex w-full items-start justify-between">
                <FileText className="h-4 w-4 mt-0.5 opacity-60" />
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold text-zinc-500">
                  {tpl.nodeCount} nodos
                </span>
              </div>
              <p className="text-xs font-semibold leading-tight">{tpl.name}</p>
              <p className="text-[10px] leading-snug opacity-70">{tpl.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Wizard ───────────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: "Identidad"    },
  { num: 2, label: "Segmentación" },
  { num: 3, label: "Estructura"   },
];

interface CampaignWizardProps {
  onComplete: (data: WizardData, template: Template | null) => void;
  onClose: () => void;
}

function canAdvance(step: number, data: WizardData): boolean {
  if (step === 1) return !!(data.campaignType && data.campaignName.trim());
  if (step === 2) {
    if (data.campaignType === "email") return !!data.crmSegment;
    return isValidLinkedInUrl(data.segmentationUrl, data.campaignType);
  }
  if (step === 3) return !!(data.segmentName.trim() && data.automationName.trim());
  return false;
}

export function CampaignWizard({ onComplete, onClose }: CampaignWizardProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(EMPTY_WIZARD);

  function patch(partial: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  function handleComplete() {
    const template = null;
    onComplete(data, template);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-6">
            {STEPS.map((s) => (
              <div key={s.num} className="flex items-center gap-2">
                <span
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    step > s.num
                      ? "bg-green-500 text-white"
                      : step === s.num
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-400",
                  ].join(" ")}
                >
                  {step > s.num ? <Check className="h-3 w-3" /> : s.num}
                </span>
                <span className={["text-xs font-medium", step >= s.num ? "text-zinc-800" : "text-zinc-400"].join(" ")}>
                  {s.label}
                </span>
                {s.num < 3 && <span className="text-zinc-300">—</span>}
              </div>
            ))}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <h2 className="mb-4 text-lg font-bold text-zinc-900">
            {step === 1 && "Configura tu campaña"}
            {step === 2 && "Define el segmento"}
            {step === 3 && "Nombra la estructura"}
          </h2>
          {step === 1 && <Step1 data={data} onChange={patch} />}
          {step === 2 && <Step2 data={data} onChange={patch} />}
          {step === 3 && <Step3 data={data} onChange={patch} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <button
            onClick={() => (step > 1 ? setStep((s) => s - 1) : onClose())}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {step > 1 ? "Atrás" : "Cancelar"}
          </button>

          {step < 3 ? (
            <button
              disabled={!canAdvance(step, data)}
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continuar
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              disabled={!canAdvance(3, data)}
              onClick={handleComplete}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Sparkles className="h-4 w-4" />
              Crear y abrir Flow Builder
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
