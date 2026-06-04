"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle, ArrowLeft, Bot, BookOpen, CalendarCheck,
  CheckCircle2, ChevronDown, ChevronRight, Clock, Copy, Edit2, ExternalLink,
  Link2, Mail, MessageSquareText, Pause, Play, Plus, Trash2,
  Sparkles, UserPlus, Users, XCircle, Zap,
} from "lucide-react";
import type { Campaign, CampaignType, Segment, SegmentStatus, Template } from "./types";
import { CampaignStatusBanner } from "./CampaignStatusBanner";


// ── Helpers ───────────────────────────────────────────────────────────────────

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
  linkedin:        "text-blue-600 bg-blue-50",
  sales_navigator: "text-violet-600 bg-violet-50",
  email:           "text-sky-600 bg-sky-50",
};

const TYPE_LABEL: Record<CampaignType, string> = {
  linkedin:        "LinkedIn",
  sales_navigator: "Sales Navigator",
  email:           "Email",
};

const SEG_STATUS: Record<SegmentStatus, { label: string; dot: string; text: string }> = {
  active:    { label: "Activo",    dot: "bg-green-400",  text: "text-green-700"  },
  paused:    { label: "Pausado",   dot: "bg-amber-400",  text: "text-amber-700"  },
  closed:    { label: "Cerrado",   dot: "bg-zinc-400",   text: "text-zinc-600"   },
  completed: { label: "Completado",dot: "bg-blue-400",   text: "text-blue-700"   },
  draft:     { label: "Borrador",  dot: "bg-zinc-300",   text: "text-zinc-500"   },
};

// ── Metric chip ───────────────────────────────────────────────────────────────

function Chip({ icon: Icon, label, value, sub, color = "text-zinc-700" }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
      </div>
      <div>
        <p className={`text-sm font-bold tabular-nums ${color}`}>{typeof value === "number" ? fmtN(value) : value}</p>
        <p className="text-[10px] text-zinc-400">{sub ?? label}</p>
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, color = "bg-indigo-500" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

// ── Segment Card ──────────────────────────────────────────────────────────────

function SegmentCard({
  segment,
  onOpenFlow,
  onStatusChange,
  onRename,
  onDelete,
}: {
  segment: Segment;
  onOpenFlow: (seg: Segment) => void;
  onStatusChange: (id: string, status: SegmentStatus) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded]   = useState(true);
  const [editing, setEditing]     = useState(false);
  const [editName, setEditName]   = useState(segment.name);
  const status    = SEG_STATUS[segment.status];
  const m         = segment.metrics;
  const progressPct = m.totalLeads > 0 ? Math.round((m.contacted / m.totalLeads) * 100) : 0;
  const isClosed  = segment.status === "closed" || segment.status === "completed";

  function commitRename() {
    if (editName.trim() && editName !== segment.name) onRename(segment.id, editName.trim());
    setEditing(false);
  }

  return (
    <div className={`overflow-hidden rounded-2xl border transition-all ${isClosed ? "border-zinc-200 opacity-75" : "border-zinc-200 bg-white shadow-sm"}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setExpanded((e) => !e)} className="text-zinc-400 hover:text-zinc-600">
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
                className="rounded-lg border border-indigo-300 px-2 py-0.5 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            ) : (
              <p className="truncate text-sm font-semibold text-zinc-900">{segment.name}</p>
            )}
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${status.text} bg-zinc-50`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
            {m.duplicates > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                <AlertTriangle className="h-3 w-3" />
                {m.duplicates} dup.
              </span>
            )}
            {/* Tamaño real o pendiente de extracción */}
            {m.totalLeads > 0 ? (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                {fmtN(m.totalLeads)} leads
              </span>
            ) : segment.searchUrl ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                Pendiente de extracción
              </span>
            ) : null}
          </div>
          <div className="mt-1">
            <ProgressBar value={progressPct} color={isClosed ? "bg-zinc-400" : "bg-indigo-500"} />
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-400">
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
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>

          {!isClosed && (
            <>
              <button
                onClick={() => onOpenFlow(segment)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 transition-colors"
              >
                <Zap className="h-3 w-3" />
                Automatización
              </button>
              <button
                onClick={() => onStatusChange(segment.id, segment.status === "active" ? "paused" : "active")}
                title={segment.status === "active" ? "Pausar" : "Reanudar"}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600 transition-colors"
              >
                {segment.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => onStatusChange(segment.id, "closed")}
                title="Cerrar segmento"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-green-50 hover:border-green-300 hover:text-green-600 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          {/* Eliminar segmento */}
          <button
            onClick={() => { if (confirm(`¿Eliminar el segmento "${segment.name}"?`)) onDelete(segment.id); }}
            title="Eliminar segmento"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {isClosed && (
            <button
              onClick={() => onStatusChange(segment.id, "active")}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-[11px] text-zinc-500 hover:bg-zinc-50"
            >
              Reabrir
            </button>
          )}
        </div>
      </div>

      {/* Expanded metrics */}
      {expanded && (
        <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-3">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Chip icon={Users}              label="Total"       value={m.totalLeads}  />
            <Chip icon={UserPlus}           label="Conectados"  value={m.connected}   color="text-blue-600"   sub={pct(m.connected, m.totalLeads)}  />
            <Chip icon={MessageSquareText}  label="Respondieron"value={m.replied}     color="text-violet-600" sub={pct(m.replied, m.contacted)}      />
            <Chip icon={CalendarCheck}      label="Reuniones"   value={m.meetings}    color="text-green-600"  sub={pct(m.meetings, m.replied)}       />
            <Chip icon={Copy}               label="Duplicados"  value={m.duplicates}  color="text-red-500"    sub="en otras camp."                   />
            <Chip icon={XCircle}            label="Rebotados"   value={m.bounced}     color="text-zinc-500"   sub="no entregados"                    />
          </div>

          {/* Automation badge */}
          <div className="mt-3 flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] text-zinc-500">Automatización:</span>
            <span className="text-[11px] font-semibold text-zinc-700">{segment.automationName}</span>
            {segment.searchUrl && (
              <a href={segment.searchUrl} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-[10px] text-indigo-500 hover:underline">
                Ver búsqueda <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Saved automation type ─────────────────────────────────────────────────────

type SavedAutomation = {
  id: string;
  name: string;
  flow_config: Record<string, unknown>;
  is_template: boolean;
  status: string;
  campaign_id?: string;
  created_at: string;
};

// ── Template Library ──────────────────────────────────────────────────────────

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
        const stored = JSON.parse(localStorage.getItem("nexusai_custom_templates") ?? "[]");
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
      const stored = JSON.parse(localStorage.getItem("nexusai_custom_templates") ?? "[]");
      localStorage.setItem("nexusai_custom_templates",
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
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      {/* Header + tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3.5">
        <BookOpen className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-bold text-zinc-900">Biblioteca de Automatizaciones</h3>
        <div className="ml-auto flex gap-1">
          {(["predefinidas", "creadas", "por_campana"] as LibTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors",
                tab === t
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200",
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
                    ? "border-zinc-200 bg-white hover:border-indigo-200 hover:shadow-sm"
                    : "border-zinc-100 bg-zinc-50/50 opacity-60"
                }`}
              >
                {isCompatible && (
                  <span className="absolute right-3 top-3 rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-bold text-green-600">
                    Compatible
                  </span>
                )}
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                    <Bot className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-zinc-900 leading-snug">{tpl.name}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-500 leading-snug">{tpl.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 flex-wrap">
                    {tpl.types.map((t) => (
                      <span key={t} className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${TYPE_COLOR[t]}`}>
                        {TYPE_LABEL[t]}
                      </span>
                    ))}
                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] text-zinc-500">
                      {tpl.nodeCount} nodos
                    </span>
                  </div>
                  {isCompatible && (
                    <button
                      onClick={() => onUse(tpl)}
                      className="rounded-lg bg-zinc-900 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-zinc-700 transition-colors"
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
            <p className="text-center text-xs text-zinc-400 py-6">Cargando automatizaciones...</p>
          ) : saved.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-zinc-400">
              <Bot className="h-8 w-8 opacity-30" />
              <p className="text-xs font-medium">No hay automatizaciones guardadas</p>
              <p className="text-[11px] text-center">Guarda un flujo desde el Flow Builder para verlo aquí</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {saved.map((auto) => (
                <div key={auto.id} className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 hover:border-indigo-200 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-2">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-50">
                      <Bot className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-zinc-900 leading-snug">{auto.name}</p>
                      <p className="text-[10px] text-zinc-400">{auto.created_at?.slice(0, 10)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600">
                      Plantilla guardada
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onUse({ id: auto.id, name: auto.name, description: "", types: [campaignType], nodeCount: 0, flowConfig: auto.flow_config as unknown as import("./types").FlowConfig })}
                        className="rounded-lg bg-zinc-900 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-zinc-700 transition-colors"
                      >
                        Usar
                      </button>
                      <button
                        onClick={() => handleDeleteSaved(auto.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
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
            <p className="text-center text-xs text-zinc-400 py-6">Cargando automatizaciones de esta campaña...</p>
          ) : byCampaign.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-zinc-400">
              <Zap className="h-8 w-8 opacity-30" />
              <p className="text-xs font-medium">Sin automatizaciones en esta campaña</p>
              <p className="text-[11px] text-center">Las automatizaciones activas de esta campaña aparecerán aquí</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {byCampaign.map((auto) => (
                <div key={auto.id} className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 hover:border-indigo-200 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-2">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                      <Zap className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-zinc-900 leading-snug">{auto.name}</p>
                      <p className="text-[10px] text-zinc-400">{auto.created_at?.slice(0, 10)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={[
                      "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                      auto.status === "active" ? "bg-green-50 text-green-600" : "bg-zinc-100 text-zinc-500",
                    ].join(" ")}>
                      {auto.status === "active" ? "Activa" : auto.status === "draft" ? "Borrador" : auto.status}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onUse({ id: auto.id, name: auto.name, description: "", types: [campaignType], nodeCount: 0, flowConfig: auto.flow_config as unknown as import("./types").FlowConfig })}
                        className="rounded-lg bg-zinc-900 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-zinc-700 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteByCampaign(auto.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
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

// ── Autopilot Status Banner ───────────────────────────────────────────────────

function AutopilotBanner({ segmentCount }: { segmentCount: number }) {
  const [active, setActive] = useState(false);
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
      active ? "border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50" : "border-zinc-200 bg-white"
    }`}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-purple-600" : "bg-zinc-100"}`}>
        <Bot className={`h-4 w-4 ${active ? "text-white" : "text-zinc-500"}`} />
      </div>
      <div className="flex-1">
        <p className={`text-xs font-bold ${active ? "text-purple-800" : "text-zinc-700"}`}>
          Autopilot IA {active ? "— Activado" : "— Desactivado"}
        </p>
        <p className="text-[10px] text-zinc-500">
          {active
            ? `Claude está gestionando conversaciones en ${segmentCount} segmento${segmentCount !== 1 ? "s" : ""}`
            : "Activa el Autopilot para que Claude negocie y agende reuniones de forma autónoma"}
        </p>
      </div>
      <button
        onClick={() => setActive((a) => !a)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${active ? "bg-purple-600" : "bg-zinc-300"}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

// ── Ghost Engine Progress Panel ───────────────────────────────────────────────

function GhostEngineProgress({ campaignId: _ }: { campaignId: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[11px] text-zinc-400 flex items-center gap-2">
      <Zap className="h-3.5 w-3.5 flex-shrink-0" />
      Motor no conectado — inicia el backend FastAPI para ver el progreso en tiempo real.
    </div>
  );
}

// ── Main Detail View ──────────────────────────────────────────────────────────

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
  onSegmentStatusGuard?: () => boolean;
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
  onSegmentStatusGuard,
}: CampaignDetailViewProps) {
  const TypeIcon = TYPE_ICON[campaign.type];
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function handleSegmentToggle(segId: string, current: SegmentStatus) {
    if (campaign.status === "draft") {
      showToast("Primero lanza la campaña para activar segmentos");
      return;
    }
    if (onSegmentStatusGuard && !onSegmentStatusGuard()) return;
    const next: SegmentStatus = current === "active" ? "paused" : "active";
    onSegmentStatusChange(segId, next);
  }

  // Summary totals
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
      {/* ── Header ── */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-border bg-white px-5 py-3.5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Campañas
        </button>
        <div className="h-4 w-px bg-zinc-200" />
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${TYPE_COLOR[campaign.type]}`}>
          <TypeIcon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-zinc-900">{campaign.name}</p>
          <p className="text-[10px] text-zinc-400">{TYPE_LABEL[campaign.type]}</p>
        </div>
        {campaign.status !== "active" && onLaunch && (
          <button
            onClick={() => onLaunch(campaign.id)}
            className="ml-auto flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 transition-colors"
          >
            <Play className="h-4 w-4" />
            Lanzar campaña
          </button>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs font-semibold text-amber-800">
          <span className="flex-1">{toast}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Status banner */}
        <CampaignStatusBanner
          campaign={campaign}
          leadsQueued={campaign.leadsQueued ?? 0}
          leadsTotal={campaign.leadsTotal ?? totals.leads}
        />

        {/* Summary row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-zinc-100 bg-white p-3.5 shadow-sm">
            <p className="text-2xl font-bold tabular-nums text-zinc-900">{fmtN(totals.leads)}</p>
            <p className="mt-0.5 text-[11px] text-zinc-400">Leads totales</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3.5">
            <p className="text-2xl font-bold tabular-nums text-blue-700">{fmtN(totals.connected)}</p>
            <p className="mt-0.5 text-[11px] text-blue-500">{pct(totals.connected, totals.leads)} conectados</p>
          </div>
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-3.5">
            <p className="text-2xl font-bold tabular-nums text-violet-700">{fmtN(totals.replied)}</p>
            <p className="mt-0.5 text-[11px] text-violet-500">{pct(totals.replied, totals.connected)} respondieron</p>
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50 p-3.5">
            <p className="text-2xl font-bold tabular-nums text-green-700">{fmtN(totals.meetings)}</p>
            <p className="mt-0.5 text-[11px] text-green-500">{pct(totals.meetings, totals.replied)} reuniones</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 p-3.5">
            <p className="text-2xl font-bold tabular-nums text-red-600">{totals.dupes}</p>
            <p className="mt-0.5 text-[11px] text-red-400">duplicados totales</p>
          </div>
        </div>

        {/* Ghost Engine progress */}
        <GhostEngineProgress campaignId={campaign.id} />

        {/* Autopilot banner */}
        <AutopilotBanner segmentCount={segments.filter((s: Segment) => s.status === "active").length} />

        {/* Segments */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900">
              Segmentos
              <span className="ml-2 text-xs font-normal text-zinc-400">({segments.length})</span>
            </h2>
            <button
              onClick={() => setAddingSegment((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo segmento
            </button>
          </div>

          {/* Formulario inline — sin prompt() */}
          {addingSegment && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <input
                autoFocus
                value={newSegName}
                onChange={(e) => setNewSegName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddSegment(); if (e.key === "Escape") setAddingSegment(false); }}
                placeholder="Nombre del segmento (ej: CEOs Lima SaaS)"
                className="flex-1 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button
                onClick={handleAddSegment}
                disabled={!newSegName.trim()}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                Crear
              </button>
              <button
                onClick={() => setAddingSegment(false)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 hover:bg-white"
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
                onOpenFlow={(s) => onOpenFlow(campaign, s)}
                onStatusChange={(id, status) => {
                  if (campaign.status === "draft" && (status === "active" || status === "paused")) {
                    handleSegmentToggle(id, seg.status);
                  } else {
                    onSegmentStatusChange(id, status);
                  }
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
