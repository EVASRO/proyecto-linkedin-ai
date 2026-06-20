"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, ArrowRight, Check, Link2, Loader2, Mail, X, FileText,
  Sparkles, Users,
} from "lucide-react";
import type { CampaignType, WizardData, Template } from "./types";
import { CAMPAIGN_TEMPLATES } from "./campaignTemplates";

// chrome.runtime is only available inside a Chrome extension content/popup context.
// When the wizard runs inside Next.js (web), it falls back to the manual flow.
type ChromeRuntime = { sendMessage: (msg: unknown) => Promise<unknown> };
declare const chrome: { runtime: ChromeRuntime } | undefined;

// -- Helpers -------------------------------------------------------------------

const TYPE_OPTIONS: {
  type: CampaignType;
  label: string;
  sub: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}[] = [
  { type: "linkedin",        label: "LinkedIn",        sub: "Perfil estándar · hasta 30 conexiones/día",  icon: Link2,    color: "text-[#2563EB]", bg: "bg-[rgba(37,99,235,0.12)] border-[rgba(37,99,235,0.3)] hover:border-[#2563EB]"   },
  { type: "sales_navigator", label: "Sales Navigator", sub: "Búsqueda avanzada · filtros premium",         icon: Sparkles, color: "text-[#06B6D4]", bg: "bg-[rgba(6,182,212,0.12)] border-[rgba(6,182,212,0.3)] hover:border-[#06B6D4]"   },
  { type: "email",           label: "Email",           sub: "Campaña masiva · outreach por correo",        icon: Mail,     color: "text-[#2563EB]", bg: "bg-[rgba(37,99,235,0.08)] border-[rgba(37,99,235,0.2)] hover:border-[#2563EB]"   },
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
  maxLeads: null,
};

// -- Step 1 — Identity ---------------------------------------------------------

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
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
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
                    : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]",
                ].join(" ")}
              >
                {selected && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4]">
                    <Check className="h-3 w-3 text-white" />
                  </span>
                )}
                <div className={["flex h-10 w-10 items-center justify-center rounded-xl", selected ? opt.bg.split(" ")[0] : "bg-[var(--border)]"].join(" ")}>
                  <Icon className={["h-5 w-5", selected ? opt.color : "text-[var(--foreground-muted)]"].join(" ")} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--foreground-muted)] leading-snug">{opt.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
          Nombre de la campaña
        </label>
        <input
          autoFocus
          value={data.campaignName}
          onChange={(e) => onChange({ campaignName: e.target.value })}
          placeholder="Ej: Directores IT Lima — Q3 2026"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)] transition-colors"
        />
      </div>
    </div>
  );
}

// -- Helpers -------------------------------------------------------------------

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

// -- Step 2 — Segmentación -----------------------------------------------------

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
      const resp = await chrome!.runtime.sendMessage({
        type: "NEXUSAI_COUNT_LEADS",
        searchUrl: data.segmentationUrl,
      }) as {
        count: number | null;
        needsNavigation?: boolean;
        error?: string;
      };
      if (resp.needsNavigation || resp.error === 'NO_URL') {
        setCountState({ status: "manual" });
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
        <p className="text-sm text-[var(--foreground-muted)]">
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
                  ? "border-[#2563EB] bg-[rgba(37,99,235,0.08)] text-[#2563EB]"
                  : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]",
              ].join(" ")}
            >
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 opacity-60" />
                <span className="text-sm font-medium">{seg.label}</span>
              </div>
              <span className="text-xs text-[var(--foreground-faint)]">{seg.count} leads</span>
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
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
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
            "w-full rounded-xl border bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:outline-none focus:ring-1 transition-colors",
            urlError
              ? "border-red-400 focus:border-red-400 focus:ring-red-400/30"
              : urlValid
              ? "border-green-400 focus:border-green-400 focus:ring-green-400/30"
              : "border-[var(--border)] focus:border-[#2563EB] focus:ring-[rgba(37,99,235,0.3)]",
          ].join(" ")}
        />
        {urlError && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
            <span>✕</span>
            {data.campaignType === "sales_navigator"
              ? "Debe ser una URL de Sales Navigator (linkedin.com/sales/...)"
              : "Debe ser una URL válida de LinkedIn (linkedin.com/search/... o linkedin.com/in/...)"}
          </p>
        )}
      </div>

      {/* How-to hint */}
      <div className="rounded-xl border border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.08)] p-4 text-sm">
        <p className="font-semibold mb-2 text-[#2563EB]">¿Cómo obtener la URL?</p>
        <ol className="list-decimal space-y-1 pl-4 text-[12px] leading-relaxed text-[var(--foreground-muted)]">
          <li>Ve a {data.campaignType === "sales_navigator" ? "Sales Navigator" : "LinkedIn"} → Buscar personas</li>
          <li>Aplica tus filtros: sector, cargo, ubicación, empresa</li>
          <li>Copia la URL completa del navegador y pégala aquí</li>
        </ol>
      </div>

      {/* Máximo de leads a contactar */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-[var(--foreground-muted)]">
          Máximo de leads a contactar
          <span className="ml-1 text-[var(--foreground-muted)] font-normal">(opcional — deja vacío para usar todos)</span>
        </label>
        <input
          type="number"
          min={1}
          max={data.estimatedLeads > 0 ? data.estimatedLeads : undefined}
          placeholder={data.estimatedLeads > 0 ? `Máx: ${data.estimatedLeads}` : "Ej: 100"}
          value={data.maxLeads ?? ""}
          onChange={(e) => {
            const val = e.target.value ? parseInt(e.target.value, 10) : null;
            onChange({ maxLeads: val });
          }}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {data.maxLeads !== null && data.estimatedLeads > 0 && data.maxLeads > data.estimatedLeads && (
          <p className="text-xs text-amber-500">El máximo supera los leads estimados</p>
        )}
      </div>

      {/* Count leads panel */}
      {urlValid && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--foreground-muted)]">Número estimado de leads</p>
            {countState.status === "idle" && (
              <button
                onClick={handleCount}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-bold text-[var(--foreground-muted)] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
              >
                Contar leads
              </button>
            )}
          </div>

          {countState.status === "counting" && (
            <div className="flex items-center gap-2 text-[#2563EB]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-[11px]">Consultando LinkedIn…</span>
            </div>
          )}

          {countState.status === "done" && (
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-xl font-black tabular-nums text-[var(--foreground)]">~{countState.count.toLocaleString("es-PE")}</span>
                <span className="text-[10px] text-[var(--foreground-muted)]">leads estimados</span>
              </div>
              {estimatedDays && (
                <>
                  <div className="h-8 w-px bg-[var(--border)]" />
                  <div className="flex flex-col">
                    <span className="text-xl font-black tabular-nums text-[var(--foreground)]">~{estimatedDays}d</span>
                    <span className="text-[10px] text-[var(--foreground-muted)]">duración estimada</span>
                  </div>
                  <div className="h-8 w-px bg-[var(--border)]" />
                  <div className="flex flex-col">
                    <span className="text-xl font-black tabular-nums text-[var(--foreground)]">{DAILY_RATE}/día</span>
                    <span className="text-[10px] text-[var(--foreground-muted)]">velocidad segura</span>
                  </div>
                </>
              )}
              <button
                onClick={() => setCountState({ status: "idle" })}
                className="ml-auto text-[10px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] underline"
              >
                Recontar
              </button>
            </div>
          )}

          {countState.status === "needs_nav" && (
            <div className="space-y-2">
              <p className="text-[11px] text-[#F59E0B] bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] rounded-lg px-3 py-2 leading-relaxed">
                Abre la URL del segmento en LinkedIn y vuelve a hacer click en "Contar leads", o ingresa el número manualmente.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Nº estimado de leads"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
                />
                <button
                  onClick={applyManual}
                  disabled={!manualInput}
                  className="rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-40"
                >
                  Aplicar
                </button>
                <button onClick={handleCount} className="text-[11px] text-[#2563EB] hover:underline">Reintentar</button>
              </div>
            </div>
          )}

          {(countState.status === "manual" || countState.status === "error") && (
            <div className="space-y-2">
              <p className="text-[11px] text-[var(--foreground-muted)]">
                La extensión no pudo leer el conteo automáticamente. Ingresa el número estimado:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Ej: 1500"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
                />
                <button
                  onClick={applyManual}
                  disabled={!manualInput}
                  className="rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-40"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-[var(--foreground-faint)] italic">
            Número estimado — la extensión contará con precisión al lanzar la campaña.
          </p>
        </div>
      )}
    </div>
  );
}

// -- Step 3 — Estructura -------------------------------------------------------

function Step3({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (d: Partial<WizardData>) => void;
}) {
  const compatibleTemplates = CAMPAIGN_TEMPLATES.filter(
    (t) => !data.campaignType || t.types.includes(data.campaignType)
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            Nombre del segmento
          </label>
          <input
            value={data.segmentName}
            onChange={(e) => onChange({ segmentName: e.target.value })}
            placeholder="Ej: Directores IT Lima"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)] transition-colors"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            Nombre de la automatización
          </label>
          <input
            value={data.automationName}
            onChange={(e) => onChange({ automationName: e.target.value })}
            placeholder="Ej: Secuencia de conexión"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)] transition-colors"
          />
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
          Plantilla de automatización
        </p>
        <div className="grid grid-cols-2 gap-2">
          {/* From scratch */}
          <button
            onClick={() => onChange({ selectedTemplateId: null })}
            className={[
              "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
              data.selectedTemplateId === null
                ? "border-[#2563EB] bg-[rgba(37,99,235,0.08)] text-[var(--foreground)]"
                : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]",
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
              onClick={() => onChange({ selectedTemplateId: tpl.id, _selectedTemplate: tpl })}
              className={[
                "flex flex-col items-start gap-1.5 rounded-xl border-2 p-3.5 text-left transition-all",
                data.selectedTemplateId === tpl.id
                  ? "border-[#2563EB] bg-[rgba(37,99,235,0.05)] text-[var(--foreground)]"
                  : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground-muted)] hover:border-[rgba(37,99,235,0.4)]",
              ].join(" ")}
            >
              <div className="flex w-full items-start justify-between gap-1">
                <FileText className="h-4 w-4 mt-0.5 shrink-0 opacity-60" />
                <span className="rounded-full bg-[var(--border)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--foreground-muted)]">
                  {tpl.nodeCount} pasos
                </span>
              </div>
              <p className="text-xs font-semibold leading-tight text-[var(--foreground)]">{tpl.name}</p>
              <p className="text-[10px] leading-snug text-[var(--foreground-muted)]">{tpl.description}</p>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {tpl.types.map((type) => (
                  <span
                    key={type}
                    className="rounded-full bg-[var(--border)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--foreground-muted)]"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// -- Main Wizard ---------------------------------------------------------------

const STEPS = [
  { num: 1, label: "Identidad"    },
  { num: 2, label: "Segmentación" },
  { num: 3, label: "Estructura"   },
];

interface CampaignWizardProps {
  onComplete: (data: WizardData, template: Template | null) => Promise<void>;
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
  const isSubmitting = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  function patch(partial: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  async function handleComplete() {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setSubmitting(true);
    try {
      const template = CAMPAIGN_TEMPLATES.find((t) => t.id === data.selectedTemplateId) ?? null;
      await onComplete(data, template);
    } finally {
      isSubmitting.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4 bg-[var(--background)]">
          <div className="flex items-center gap-6">
            {STEPS.map((s) => (
              <div key={s.num} className="flex items-center gap-2">
                <span
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    step > s.num
                      ? "bg-green-500 text-white"
                      : step === s.num
                      ? "bg-gradient-to-r from-[#2563EB] to-[#06B6D4] text-white"
                      : "bg-[var(--border)] text-[var(--foreground-muted)]",
                  ].join(" ")}
                >
                  {step > s.num ? <Check className="h-3 w-3" /> : s.num}
                </span>
                <span className={["text-xs font-medium", step >= s.num ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"].join(" ")}>
                  {s.label}
                </span>
                {s.num < 3 && <span className="text-[var(--border)]">—</span>}
              </div>
            ))}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">
            {step === 1 && "Configura tu campaña"}
            {step === 2 && "Define el segmento"}
            {step === 3 && "Nombra la estructura"}
          </h2>
          {step === 1 && <Step1 data={data} onChange={patch} />}
          {step === 2 && <Step2 data={data} onChange={patch} />}
          {step === 3 && <Step3 data={data} onChange={patch} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
          <button
            onClick={() => (step > 1 ? setStep((s) => s - 1) : onClose())}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {step > 1 ? "Atrás" : "Cancelar"}
          </button>

          {step < 3 ? (
            <button
              disabled={!canAdvance(step, data)}
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Continuar
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              disabled={!canAdvance(3, data) || submitting}
              onClick={handleComplete}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-5 py-2 text-sm font-semibold text-white shadow-[0_0_16px_rgba(37,99,235,0.35)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Creando...
                </span>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Crear y abrir Flow Builder
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
