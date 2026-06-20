"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle, ArrowLeft, Bot, BookOpen, CalendarCheck,
  CheckCircle2, ChevronDown, ChevronRight, Circle, Clock,
  Copy, Edit2, ExternalLink,
  Link2, Mail, MessageSquare, MessageSquareText, Pause, Play, Plus, RefreshCw, Trash2,
  Sparkles, Upload, UserPlus, Users, XCircle, Zap,
} from "lucide-react";
import { getLeadCountsByCrmColumn } from "@/app/dashboard/campanas/actions";
import type { LeadCountsByCrm } from "@/app/dashboard/campanas/actions";
import type { Campaign, CampaignType, Segment, SegmentStatus, Template } from "./types";
import { CampaignStatusBanner } from "./CampaignStatusBanner";
import { SegmentImport } from "./SegmentImport";
import { SequenceAnalytics } from "./SequenceAnalytics";
import { AbTestEditor } from "./AbTestEditor";


// -- Helpers -------------------------------------------------------------------

function pct(a: number, b: number): string {
  if (!b) return "0%";
  return `${Math.round((a / b) * 100)}%`;
}

function fmtN(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

const TYPE_ICON: Record<CampaignType, React.ElementType> = {
  linkedin:        Link2,
  sales_navigator: Sparkles,
  email:           Mail,
};

const TYPE_COLOR: Record<CampaignType, string> = {
  linkedin:        "text-[#2563EB] bg-[rgba(37,99,235,0.12)]",
  sales_navigator: "text-[#06B6D4] bg-[rgba(6,182,212,0.12)]",
  email:           "text-[#2563EB] bg-[rgba(37,99,235,0.08)]",
};

const TYPE_LABEL: Record<CampaignType, string> = {
  linkedin:        "LinkedIn",
  sales_navigator: "Sales Navigator",
  email:           "Email",
};

const SEG_STATUS: Record<SegmentStatus, { label: string; dot: string; text: string }> = {
  active:    { label: "Activo",    dot: "bg-[#10B981]",               text: "text-[#10B981]"                },
  paused:    { label: "Pausado",   dot: "bg-[#F59E0B]",               text: "text-[#F59E0B]"                },
  closed:    { label: "Cerrado",   dot: "bg-[var(--foreground-faint)]", text: "text-[var(--foreground-muted)]" },
  completed: { label: "Completado",dot: "bg-[#2563EB]",               text: "text-[#2563EB]"                },
  draft:     { label: "Borrador",  dot: "bg-[var(--foreground-faint)]", text: "text-[var(--foreground-muted)]" },
};

// -- Metric chip ---------------------------------------------------------------

function Chip({ icon: Icon, label, value, sub, color = "text-[var(--foreground)]" }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--background)]">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
      </div>
      <div>
        <p className={`text-sm font-bold tabular-nums ${color}`}>{typeof value === "number" ? fmtN(value) : value}</p>
        <p className="text-[10px] text-[var(--foreground-faint)]">{sub ?? label}</p>
      </div>
    </div>
  );
}

// -- Progress bar --------------------------------------------------------------

function ProgressBar({ value, color = "bg-[#2563EB]" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

// -- Pipeline Status -----------------------------------------------------------

const PIPELINE_STAGES = [
  { key: "extraido"          as keyof LeadCountsByCrm, label: "Extraídos",   color: "bg-[var(--border)]" },
  { key: "conexion_enviada"  as keyof LeadCountsByCrm, label: "Contactados", color: "bg-[#2563EB]"       },
  { key: "conexion_aceptada" as keyof LeadCountsByCrm, label: "Aceptados",   color: "bg-[#2563EB]"       },
  { key: "en_conversacion"   as keyof LeadCountsByCrm, label: "Conversando", color: "bg-[#06B6D4]"       },
  { key: "reunion_agendada"  as keyof LeadCountsByCrm, label: "Reunión",     color: "bg-[#10B981]"       },
];

function PipelineStatus({ campaignId }: { campaignId: string }) {
  const [counts, setCounts] = useState<LeadCountsByCrm | null>(null);

  useEffect(() => {
    getLeadCountsByCrmColumn(campaignId).then((res) => {
      if (res.success && res.data) setCounts(res.data);
    }).catch(() => {});
    const interval = setInterval(() => {
      getLeadCountsByCrmColumn(campaignId).then((res) => {
        if (res.success && res.data) setCounts(res.data);
      }).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, [campaignId]);

  const total = counts
    ? Object.values(counts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold text-[var(--foreground)]">Pipeline de automatización</p>
        <p className="text-[10px] text-[var(--foreground-muted)]">{total} leads en total</p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {PIPELINE_STAGES.map((stage) => {
          const count = counts?.[stage.key] ?? 0;
          const pctVal = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={stage.key} className="flex flex-col items-center gap-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className={`h-full rounded-full transition-all ${count > 0 ? stage.color : "bg-[var(--border)]"}`}
                  style={{ width: `${pctVal}%` }}
                />
              </div>
              <span className={`text-sm font-bold tabular-nums ${count > 0 ? "text-[var(--foreground)]" : "text-[var(--foreground-faint)]"}`}>
                {count}
              </span>
              <span className="text-center text-[10px] text-[var(--foreground-muted)] leading-tight">{stage.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -- Automation Sequence -------------------------------------------------------

type WfJson = Record<string, unknown>;

type StepStatus = "active" | "waiting" | "disabled";

function AutomationSequence({ wf }: { wf: WfJson }) {
  const connectionNote  = (wf.connection_note       as string)  || "";
  const followUpMessage = (wf.follow_up_message      as string)  || "";
  const followUpDays    = (wf.follow_up_delay_days   as number)  ?? 1;
  const autopilotOn     = !!(wf.autopilot_enabled);

  const steps: {
    id: number;
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    title: string;
    detail: string;
    status: StepStatus;
  }[] = [
    {
      id:     1,
      icon:   UserPlus,
      color:  "text-[#2563EB]",
      bg:     "bg-[rgba(37,99,235,0.12)]",
      border: "border-[rgba(37,99,235,0.3)]",
      title:  "Enviar solicitud de conexión",
      detail: connectionNote
        ? `Con nota: "${connectionNote.slice(0, 60)}${connectionNote.length > 60 ? "…" : ""}"`
        : "Sin nota personalizada",
      status: "active",
    },
    {
      id:     2,
      icon:   Clock,
      color:  "text-[var(--foreground-muted)]",
      bg:     "bg-[var(--surface)]",
      border: "border-[var(--border)]",
      title:  "Esperar aceptación",
      detail: "Detección automática cada 2 horas",
      status: "waiting",
    },
    {
      id:     3,
      icon:   MessageSquare,
      color:  followUpMessage ? "text-[#2563EB]"         : "text-[var(--foreground-faint)]",
      bg:     followUpMessage ? "bg-[rgba(37,99,235,0.12)]" : "bg-[var(--surface)]",
      border: followUpMessage ? "border-[rgba(37,99,235,0.3)]" : "border-[var(--border)]",
      title:  "Mensaje de seguimiento",
      detail: followUpMessage
        ? `En ${followUpDays} día(s): "${followUpMessage.slice(0, 60)}${followUpMessage.length > 60 ? "…" : ""}"`
        : "Sin mensaje configurado",
      status: followUpMessage ? "active" : "disabled",
    },
    {
      id:     4,
      icon:   RefreshCw,
      color:  "text-[#F59E0B]",
      bg:     "bg-[rgba(245,158,11,0.12)]",
      border: "border-[rgba(245,158,11,0.3)]",
      title:  "Detectar respuesta",
      detail: "Verificación cada 15 minutos",
      status: "active",
    },
    {
      id:     5,
      icon:   Bot,
      color:  autopilotOn ? "text-[#06B6D4]"               : "text-[var(--foreground-faint)]",
      bg:     autopilotOn ? "bg-[rgba(6,182,212,0.12)]"    : "bg-[var(--surface)]",
      border: autopilotOn ? "border-[rgba(6,182,212,0.3)]" : "border-[var(--border)]",
      title:  "Autopilot IA",
      detail: autopilotOn
        ? "Claude responde automáticamente"
        : "Desactivado — respuesta manual",
      status: autopilotOn ? "active" : "disabled",
    },
  ];

  const STATUS_STYLES: Record<StepStatus, string> = {
    active:   "opacity-100",
    waiting:  "opacity-70",
    disabled: "opacity-40 grayscale",
  };

  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] font-bold text-[var(--foreground-muted)] uppercase tracking-wide">Secuencia</p>
      <div className="space-y-0">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.id} className="relative">
              {i < steps.length - 1 && (
                <div className="absolute left-[17px] top-[44px] h-2 w-px bg-[var(--border)] z-0" />
              )}
              <div className={`relative z-10 flex items-center gap-2.5 rounded-xl border p-2.5 mb-2
                               ${step.border} ${STATUS_STYLES[step.status]}
                               ${step.status !== "disabled" ? "bg-[var(--surface)]" : "bg-[var(--background)]"}`}>
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center
                                 rounded-full border-2 ${step.border} ${step.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${step.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-semibold text-[var(--foreground)] leading-snug">{step.title}</p>
                    {step.status === "active" && (
                      <span className="rounded-full bg-[rgba(16,185,129,0.15)] px-1.5 py-0.5 text-[9px] font-bold text-[#10B981] flex-shrink-0">
                        ACTIVO
                      </span>
                    )}
                    {step.status === "disabled" && (
                      <span className="rounded-full bg-[var(--border)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--foreground-faint)] flex-shrink-0">
                        INACTIVO
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--foreground-faint)] truncate">{step.detail}</p>
                </div>
                <span className="flex-shrink-0 text-[10px] font-bold text-[var(--foreground-faint)]">#{step.id}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -- Segment Card --------------------------------------------------------------

function SegmentCard({
  segment,
  campaignId,
  campaignActive,
  campaignWf,
  onOpenFlow,
  onStatusChange,
  onRename,
  onDelete,
}: {
  segment: Segment;
  campaignId: string;
  campaignActive: boolean;
  campaignWf: WfJson;
  onOpenFlow: (seg: Segment) => void;
  onStatusChange: (id: string, status: SegmentStatus) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded]       = useState(true);
  const [editing, setEditing]         = useState(false);
  const [editName, setEditName]       = useState(segment.name);
  const [importOpen, setImportOpen]   = useState(false);
  const status    = SEG_STATUS[segment.status];
  const m         = segment.metrics;
  const progressPct = m.totalLeads > 0 ? Math.round((m.contacted / m.totalLeads) * 100) : 0;
  const isClosed  = segment.status === "closed" || segment.status === "completed";

  function commitRename() {
    if (editName.trim() && editName !== segment.name) onRename(segment.id, editName.trim());
    setEditing(false);
  }

  return (
    <div className={`overflow-hidden rounded-2xl border transition-all ${isClosed ? "border-[var(--border)] opacity-75" : "border-[var(--border)] bg-[var(--surface)] shadow-sm"}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setExpanded((e) => !e)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {editing ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditing(false); }}
                className="rounded-lg border border-[#2563EB] px-2 py-0.5 text-sm font-semibold text-[var(--foreground)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[rgba(37,99,235,0.3)]"
              />
            ) : (
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">{segment.name}</p>
            )}
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${status.text} bg-[var(--surface)]`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
            {m.duplicates > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-[rgba(239,68,68,0.12)] px-2 py-0.5 text-[10px] font-bold text-[#EF4444]">
                <AlertTriangle className="h-3 w-3" />
                {m.duplicates} dup.
              </span>
            )}
            {/* Tamaño real o estado de extracción */}
            {m.totalLeads > 0 ? (
              <span className="rounded-full bg-[rgba(37,99,235,0.12)] px-2 py-0.5 text-[10px] font-semibold text-[#2563EB]">
                {fmtN(m.totalLeads)} leads
              </span>
            ) : segment.searchUrl && campaignActive && segment.status === "active" ? (
              <span className="rounded-full bg-[rgba(16,185,129,0.12)] px-2 py-0.5 text-[10px] font-semibold text-[#10B981]">
                Extrayendo leads...
              </span>
            ) : segment.searchUrl && segment.status === "draft" ? (
              <span className="rounded-full bg-[rgba(245,158,11,0.12)] px-2 py-0.5 text-[10px] font-semibold text-[#F59E0B]">
                Pendiente de extracción
              </span>
            ) : null}
          </div>
          <div className="mt-1">
            <ProgressBar value={progressPct} color={isClosed ? "bg-[var(--foreground-faint)]" : "bg-[#2563EB]"} />
          </div>
          <p className="mt-0.5 text-[10px] text-[var(--foreground-muted)]">
            {m.totalLeads > 0
              ? `${progressPct}% contactados · ${fmtN(m.contacted)}/${fmtN(m.totalLeads)} leads`
              : segment.searchUrl
              ? "Activa el Ghost Engine para extraer leads de la URL"
              : "Sin leads aún — añade una URL de búsqueda"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Editar nombre */}
          <button
            onClick={() => { setEditing(true); setEditName(segment.name); }}
            title="Renombrar segmento"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--foreground-muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)] transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>

          {!isClosed && (
            <>
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                title="Importar leads desde CSV"
              >
                <Upload className="h-3 w-3" />
                Importar CSV
              </button>
              <button
                onClick={() => onOpenFlow(segment)}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90 transition-opacity"
              >
                <Zap className="h-3 w-3" />
                Automatización
              </button>
              <button
                onClick={() => onStatusChange(segment.id, segment.status === "active" ? "paused" : "active")}
                title={segment.status === "active" ? "Pausar" : "Reanudar"}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[rgba(245,158,11,0.08)] hover:border-[rgba(245,158,11,0.4)] hover:text-[#F59E0B] transition-colors"
              >
                {segment.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => onStatusChange(segment.id, "closed")}
                title="Cerrar segmento"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[rgba(16,185,129,0.08)] hover:border-[rgba(16,185,129,0.4)] hover:text-[#10B981] transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          {/* Eliminar segmento */}
          <button
            onClick={() => { if (confirm(`¿Eliminar el segmento "${segment.name}"?`)) onDelete(segment.id); }}
            title="Eliminar segmento"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--foreground-muted)] hover:bg-[rgba(239,68,68,0.08)] hover:text-[#EF4444] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {isClosed && (
            <button
              onClick={() => onStatusChange(segment.id, "active")}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]"
            >
              Reabrir
            </button>
          )}
        </div>
      </div>

      {/* Import CSV modal */}
      {importOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setImportOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2
                          rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div>
                <p className="text-sm font-bold text-[var(--foreground)]">Importar leads desde CSV / Excel</p>
                <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">Segmento: {segment.name}</p>
              </div>
              <button
                onClick={() => setImportOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <SegmentImport
                segmentId={segment.id}
                campaignId={campaignId}
                onClose={() => setImportOpen(false)}
                onImportComplete={(count) => {
                  setImportOpen(false);
                  // Brief toast is shown by the result step before closing
                  void count;
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Expanded metrics */}
      {expanded && (
        <div className="border-t border-[var(--border)] bg-[var(--background)] px-4 py-3">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Chip icon={Users}              label="Total"       value={m.totalLeads}  />
            <Chip icon={UserPlus}           label="Conectados"  value={m.connected}   color="text-[#2563EB]"   sub={pct(m.connected, m.totalLeads)}  />
            <Chip icon={MessageSquareText}  label="Respondieron"value={m.replied}     color="text-[#06B6D4]" sub={pct(m.replied, m.contacted)}      />
            <Chip icon={CalendarCheck}      label="Reuniones"   value={m.meetings}    color="text-[#10B981]"  sub={pct(m.meetings, m.replied)}       />
            <Chip icon={Copy}               label="Duplicados"  value={m.duplicates}  color="text-[#EF4444]"    sub="en otras camp."                   />
            <Chip icon={XCircle}            label="Rebotados"   value={m.bounced}     color="text-[var(--foreground-muted)]"   sub="no entregados"                    />
          </div>

          {/* Secuencia de automatización */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] font-semibold text-[var(--foreground-muted)]">{segment.automationName}</span>
            </div>
            {segment.searchUrl && (
              <a href={segment.searchUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-[#2563EB] hover:underline">
                Ver búsqueda <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <AutomationSequence wf={campaignWf} />
        </div>
      )}
    </div>
  );
}

// -- Saved automation type -----------------------------------------------------

type SavedAutomation = {
  id: string;
  name: string;
  flow_config: Record<string, unknown>;
  is_template: boolean;
  status: string;
  campaign_id?: string;
  created_at: string;
};

// -- Template Library ----------------------------------------------------------

type LibTab = "predefinidas" | "creadas" | "por_campana";

function TemplateLibrary({
  campaignType,
  campaignId,
  onUse,
}: {
  campaignType: CampaignType;
  campaignId: string;
  onUse: (tpl: Template) => void;
}) {
  const [tab, setTab]                         = useState<LibTab>("predefinidas");
  const [saved, setSaved]                     = useState<SavedAutomation[]>([]);
  const [byCampaign, setByCampaign]           = useState<SavedAutomation[]>([]);
  const [loadingSaved, setLoadingSaved]       = useState(false);
  const [loadingCampaign, setLoadingCampaign] = useState(false);

  useEffect(() => {
    // Las automatizaciones guardadas se cargan desde localStorage (custom templates)
    if (tab === "creadas" && saved.length === 0) {
      setLoadingSaved(true);
      try {
        const stored = JSON.parse(localStorage.getItem("cazary_custom_templates") ?? "[]");
        setSaved(Array.isArray(stored) ? stored : []);
      } catch { /* ignore */ }
      setLoadingSaved(false);
    }
  }, [tab, saved.length]);

  useEffect(() => {
    // Las automatizaciones por campaña vienen del workflow_json — no hay endpoint separado
    if (tab === "por_campana") {
      setLoadingCampaign(true);
      setByCampaign([]);
      setLoadingCampaign(false);
    }
  }, [tab, campaignId]);

  function handleDeleteSaved(id: string) {
    setSaved((prev) => prev.filter((a) => a.id !== id));
    try {
      const stored = JSON.parse(localStorage.getItem("cazary_custom_templates") ?? "[]");
      localStorage.setItem("cazary_custom_templates",
        JSON.stringify((stored as SavedAutomation[]).filter((a) => a.id !== id))
      );
    } catch { /* ignore */ }
  }

  function handleDeleteByCampaign(id: string) {
    setByCampaign((prev) => prev.filter((a) => a.id !== id));
  }

  const TAB_LABELS: Record<LibTab, string> = {
    predefinidas: "Predefinidas",
    creadas:      "Creadas",
    por_campana:  "Por campaña",
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Header + tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3.5">
        <BookOpen className="h-4 w-4 text-[#2563EB]" />
        <h3 className="text-sm font-bold text-[var(--foreground)]">Biblioteca de Automatizaciones</h3>
        <div className="ml-auto flex gap-1">
          {(["predefinidas", "creadas", "por_campana"] as LibTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors",
                tab === t
                  ? "bg-gradient-to-r from-[#2563EB] to-[#06B6D4] text-white"
                  : "bg-[var(--border)] text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.1)]",
              ].join(" ")}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Predefinidas */}
      {tab === "predefinidas" && (
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {([] as import("./types").Template[]).map((tpl) => {
            const isCompatible = tpl.types.includes(campaignType);
            return (
              <div
                key={tpl.id}
                className={`relative flex flex-col gap-2 rounded-xl border p-4 transition-all ${
                  isCompatible
                    ? "border-[var(--border)] bg-[var(--background)] hover:border-[rgba(37,99,235,0.4)] hover:shadow-sm"
                    : "border-[var(--border)] bg-[var(--background)] opacity-60"
                }`}
              >
                {isCompatible && (
                  <span className="absolute right-3 top-3 rounded-full bg-[rgba(16,185,129,0.12)] px-1.5 py-0.5 text-[9px] font-bold text-[#10B981]">
                    Compatible
                  </span>
                )}
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(37,99,235,0.12)]">
                    <Bot className="h-4 w-4 text-[#2563EB]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[var(--foreground)] leading-snug">{tpl.name}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--foreground-muted)] leading-snug">{tpl.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 flex-wrap">
                    {tpl.types.map((t) => (
                      <span key={t} className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${TYPE_COLOR[t]}`}>
                        {TYPE_LABEL[t]}
                      </span>
                    ))}
                    <span className="rounded-full bg-[var(--border)] px-1.5 py-0.5 text-[9px] text-[var(--foreground-muted)]">
                      {tpl.nodeCount} nodos
                    </span>
                  </div>
                  {isCompatible && (
                    <button
                      onClick={() => onUse(tpl)}
                      className="rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-2.5 py-1 text-[10px] font-bold text-white hover:opacity-90 transition-opacity"
                    >
                      Usar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Creadas (guardadas como plantilla) */}
      {tab === "creadas" && (
        <div className="p-4">
          {loadingSaved ? (
            <p className="text-center text-xs text-[var(--foreground-muted)] py-6">Cargando automatizaciones...</p>
          ) : saved.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-[var(--foreground-muted)]">
              <Bot className="h-8 w-8 opacity-30" />
              <p className="text-xs font-medium">No hay automatizaciones guardadas</p>
              <p className="text-[11px] text-center">Guarda un flujo desde el Flow Builder para verlo aquí</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {saved.map((auto) => (
                <div key={auto.id} className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 hover:border-[rgba(37,99,235,0.4)] hover:shadow-sm transition-all">
                  <div className="flex items-start gap-2">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(6,182,212,0.12)]">
                      <Bot className="h-4 w-4 text-[#06B6D4]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[var(--foreground)] leading-snug">{auto.name}</p>
                      <p className="text-[10px] text-[var(--foreground-faint)]">{auto.created_at?.slice(0, 10)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="rounded-full bg-[rgba(6,182,212,0.12)] px-1.5 py-0.5 text-[9px] font-semibold text-[#06B6D4]">
                      Plantilla guardada
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onUse({ id: auto.id, name: auto.name, description: "", types: [campaignType], nodeCount: 0, flowConfig: auto.flow_config as unknown as import("./types").FlowConfig })}
                        className="rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-2.5 py-1 text-[10px] font-bold text-white hover:opacity-90 transition-opacity"
                      >
                        Usar
                      </button>
                      <button
                        onClick={() => handleDeleteSaved(auto.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--foreground-muted)] hover:bg-[rgba(239,68,68,0.08)] hover:text-[#EF4444] transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Por campaña */}
      {tab === "por_campana" && (
        <div className="p-4">
          {loadingCampaign ? (
            <p className="text-center text-xs text-[var(--foreground-muted)] py-6">Cargando automatizaciones de esta campaña...</p>
          ) : byCampaign.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-[var(--foreground-muted)]">
              <Zap className="h-8 w-8 opacity-30" />
              <p className="text-xs font-medium">Sin automatizaciones en esta campaña</p>
              <p className="text-[11px] text-center">Las automatizaciones activas de esta campaña aparecerán aquí</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {byCampaign.map((auto) => (
                <div key={auto.id} className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 hover:border-[rgba(37,99,235,0.4)] hover:shadow-sm transition-all">
                  <div className="flex items-start gap-2">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(37,99,235,0.12)]">
                      <Zap className="h-4 w-4 text-[#2563EB]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[var(--foreground)] leading-snug">{auto.name}</p>
                      <p className="text-[10px] text-[var(--foreground-faint)]">{auto.created_at?.slice(0, 10)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={[
                      "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                      auto.status === "active" ? "bg-[rgba(16,185,129,0.12)] text-[#10B981]" : "bg-[var(--border)] text-[var(--foreground-muted)]",
                    ].join(" ")}>
                      {auto.status === "active" ? "Activa" : auto.status === "draft" ? "Borrador" : auto.status}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onUse({ id: auto.id, name: auto.name, description: "", types: [campaignType], nodeCount: 0, flowConfig: auto.flow_config as unknown as import("./types").FlowConfig })}
                        className="rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-2.5 py-1 text-[10px] font-bold text-white hover:opacity-90 transition-opacity"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteByCampaign(auto.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--foreground-muted)] hover:bg-[rgba(239,68,68,0.08)] hover:text-[#EF4444] transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -- Autopilot Status Banner ---------------------------------------------------

function AutopilotBanner({ segmentCount }: { segmentCount: number }) {
  const [active, setActive] = useState(false);
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
      active ? "border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.06)]" : "border-[var(--border)] bg-[var(--surface)]"
    }`}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-[#2563EB]" : "bg-[var(--border)]"}`}>
        <Bot className={`h-4 w-4 ${active ? "text-white" : "text-[var(--foreground-muted)]"}`} />
      </div>
      <div className="flex-1">
        <p className={`text-xs font-bold ${active ? "text-[#2563EB]" : "text-[var(--foreground)]"}`}>
          Autopilot IA {active ? "— Activado" : "— Desactivado"}
        </p>
        <p className="text-[10px] text-[var(--foreground-muted)]">
          {active
            ? `Claude está gestionando conversaciones en ${segmentCount} segmento${segmentCount !== 1 ? "s" : ""}`
            : "Activa el Autopilot para que Claude negocie y agende reuniones de forma autónoma"}
        </p>
      </div>
      <button
        onClick={() => setActive((a) => !a)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${active ? "bg-[#2563EB]" : "bg-[var(--border)]"}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

// -- Ghost Engine Progress Panel -----------------------------------------------

function GhostEngineProgress({ campaignId: _ }: { campaignId: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[11px] text-[var(--foreground-muted)] flex items-center gap-2">
      <Zap className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
      Ghost Engine procesa los leads en segundo plano via la extensión de Chrome. El progreso se actualiza cada 30 segundos.
    </div>
  );
}

// -- Main Detail View ----------------------------------------------------------

interface CampaignDetailViewProps {
  campaign: Campaign;
  segments: Segment[];
  onBack: () => void;
  onOpenFlow: (campaign: Campaign, segment: Segment) => void;
  onSegmentStatusChange: (segId: string, status: SegmentStatus) => void;
  onSegmentRename: (segId: string, name: string) => void;
  onSegmentDelete: (segId: string) => void;
  onSegmentAdd: (seg: Segment) => void;
  onLaunch?: (campaignId: string) => void;
  onDeleteCampaign?: (id: string, name: string) => void;
}

export function CampaignDetailView({
  campaign,
  segments,
  onBack,
  onOpenFlow,
  onSegmentStatusChange,
  onSegmentRename,
  onSegmentDelete,
  onSegmentAdd,
  onLaunch,
  onDeleteCampaign,
}: CampaignDetailViewProps) {
  const TypeIcon = TYPE_ICON[campaign.type];
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }


  // Summary totals — use live campaign count as floor for leads so it's never 0 when DB has data
  const campaignLeadsTotal = campaign.totalLeads || campaign.leadsTotal || 0;
  const totals = segments.reduce(
    (acc, s) => ({
      leads:    acc.leads    + s.metrics.totalLeads,
      connected:acc.connected+ s.metrics.connected,
      replied:  acc.replied  + s.metrics.replied,
      meetings: acc.meetings + s.metrics.meetings,
      dupes:    acc.dupes    + s.metrics.duplicates,
    }),
    { leads: 0, connected: 0, replied: 0, meetings: 0, dupes: 0 }
  );
  // Si los segmentos aún no tienen el count hidratado, usar el valor de la campaña
  const displayLeads = totals.leads || campaignLeadsTotal;

  const [newSegName, setNewSegName] = useState("");
  const [addingSegment, setAddingSegment] = useState(false);

  function handleAddSegment() {
    if (!newSegName.trim()) return;
    const newSeg: Segment = {
      id:             `seg_new_${Date.now()}`,
      campaignId:     campaign.id,
      name:           newSegName.trim(),
      source:         "external_link",
      status:         "draft" as SegmentStatus,
      metrics:        { totalLeads: 0, contacted: 0, connected: 0, replied: 0, meetings: 0, duplicates: 0, bounced: 0 },
      automationId:   `auto_new_${Date.now()}`,
      automationName: "Sin automatización",
      createdAt:      new Date().toISOString().slice(0, 10),
    };
    onSegmentAdd(newSeg);
    setNewSegName("");
    setAddingSegment(false);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* -- Header -- */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3.5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Campañas
        </button>
        <div className="h-4 w-px bg-[var(--border)]" />
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${TYPE_COLOR[campaign.type]}`}>
          <TypeIcon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--foreground)]">{campaign.name}</p>
          <p className="text-[10px] text-[var(--foreground-muted)]">{TYPE_LABEL[campaign.type]}</p>
        </div>
        {onLaunch && campaign.status !== "paused" && campaign.status !== "completed" && (
          <button
            onClick={() => onLaunch(campaign.id)}
            className={`ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-opacity ${
              campaign.status === "active"
                ? "bg-[#10B981] cursor-default opacity-80"
                : "bg-[#10B981] hover:opacity-90"
            }`}
          >
            <Play className="h-4 w-4" />
            {campaign.status === "active" ? "Campaña activa" : "Lanzar campaña"}
          </button>
        )}
        {onDeleteCampaign && (
          <button
            title="Eliminar campaña"
            onClick={() => onDeleteCampaign(campaign.id, campaign.name)}
            className={`${onLaunch && campaign.status !== "paused" && campaign.status !== "completed" ? "" : "ml-auto"} flex items-center gap-1.5 rounded-xl border border-[rgba(239,68,68,0.3)] px-3 py-2 text-xs font-medium text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] transition-colors`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </button>
        )}
      </div>

      {/* -- Toast -- */}
      {toast && (
        <div className="flex items-center gap-2 border-b border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-5 py-2 text-xs font-semibold text-[#F59E0B]">
          <span className="flex-1">{toast}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* -- Scrollable body -- */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Status banner */}
        <CampaignStatusBanner
          campaign={campaign}
          leadsQueued={campaign.leadsQueued ?? 0}
          leadsTotal={campaign.leadsTotal ?? campaign.totalLeads ?? displayLeads}
        />

        {/* Summary row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-sm">
            <p className="text-2xl font-bold tabular-nums text-[var(--foreground)]">{fmtN(displayLeads)}</p>
            <p className="mt-0.5 text-[11px] text-[var(--foreground-muted)]">Leads totales</p>
          </div>
          <div className="rounded-xl border border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.08)] p-3.5">
            <p className="text-2xl font-bold tabular-nums text-[#2563EB]">{fmtN(totals.connected)}</p>
            <p className="mt-0.5 text-[11px] text-[rgba(37,99,235,0.7)]">{pct(totals.connected, displayLeads)} conectados</p>
          </div>
          <div className="rounded-xl border border-[rgba(6,182,212,0.25)] bg-[rgba(6,182,212,0.08)] p-3.5">
            <p className="text-2xl font-bold tabular-nums text-[#06B6D4]">{fmtN(totals.replied)}</p>
            <p className="mt-0.5 text-[11px] text-[rgba(6,182,212,0.7)]">{pct(totals.replied, totals.connected)} respondieron</p>
          </div>
          <div className="rounded-xl border border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.08)] p-3.5">
            <p className="text-2xl font-bold tabular-nums text-[#10B981]">{fmtN(totals.meetings)}</p>
            <p className="mt-0.5 text-[11px] text-[rgba(16,185,129,0.7)]">{pct(totals.meetings, totals.replied)} reuniones</p>
          </div>
          <div className="rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] p-3.5">
            <p className="text-2xl font-bold tabular-nums text-[#EF4444]">{totals.dupes}</p>
            <p className="mt-0.5 text-[11px] text-[rgba(239,68,68,0.7)]">duplicados totales</p>
          </div>
        </div>

        {/* Pipeline visual */}
        <PipelineStatus campaignId={campaign.id} />

        {/* Ghost Engine progress */}
        <GhostEngineProgress campaignId={campaign.id} />

        {/* Sequence analytics funnel */}
        <SequenceAnalytics campaignId={campaign.id} />

        {/* Autopilot banner */}
        <AutopilotBanner segmentCount={segments.filter((s: Segment) => s.status === "active").length} />

        {/* A/B Test editor */}
        <AbTestEditor campaignId={campaign.id} />

        {/* Segments */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--foreground)]">
              Segmentos
              <span className="ml-2 text-xs font-normal text-[var(--foreground-muted)]">({segments.length})</span>
            </h2>
            <button
              onClick={() => setAddingSegment((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground-muted)] hover:border-[rgba(37,99,235,0.4)] hover:text-[#2563EB] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo segmento
            </button>
          </div>

          {/* Formulario inline — sin prompt() */}
          {addingSegment && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-[rgba(37,99,235,0.3)] bg-[rgba(37,99,235,0.06)] p-3">
              <input
                autoFocus
                value={newSegName}
                onChange={(e) => setNewSegName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddSegment(); if (e.key === "Escape") setAddingSegment(false); }}
                placeholder="Nombre del segmento (ej: CEOs Lima SaaS)"
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.4)] focus:border-[#2563EB]"
              />
              <button
                onClick={handleAddSegment}
                disabled={!newSegName.trim()}
                className="rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Crear
              </button>
              <button
                onClick={() => setAddingSegment(false)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]"
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="space-y-3">
            {segments.map((seg) => (
              <SegmentCard
                key={seg.id}
                segment={seg}
                campaignId={campaign.id}
                campaignActive={campaign.status === "active"}
                campaignWf={(campaign.workflow_json as WfJson) ?? {}}
                onOpenFlow={(s) => onOpenFlow(campaign, s)}
                onStatusChange={(id, status) => {
                  if (campaign.status !== "active") {
                    showToast("Primero lanza la campaña para modificar segmentos");
                    return;
                  }
                  onSegmentStatusChange(id, status);
                }}
                onRename={onSegmentRename}
                onDelete={onSegmentDelete}
              />
            ))}
          </div>
        </div>

        {/* Template library */}
        <TemplateLibrary
          campaignType={campaign.type}
          campaignId={campaign.id}
          onUse={(tpl) => {
            const firstActive = segments.find((s) => s.status === "active");
            if (firstActive) onOpenFlow(campaign, { ...firstActive, automationName: tpl.name });
          }}
        />
      </div>
    </div>
  );
}
