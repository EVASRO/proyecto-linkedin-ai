"use client";

import { useState } from "react";
import {
  AlertOctagon, Clock, Link2, Mail, Pause, Play, Plus, Sparkles,
} from "lucide-react";
import type { Campaign, CampaignType, CampaignStatus } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_META: Record<CampaignType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  linkedin:        { icon: Link2,    color: "text-blue-700",   bg: "bg-blue-50",   label: "LinkedIn"        },
  sales_navigator: { icon: Sparkles, color: "text-violet-700", bg: "bg-violet-50", label: "Sales Navigator" },
  email:           { icon: Mail,     color: "text-sky-700",    bg: "bg-sky-50",    label: "Email"           },
};

const STATUS_META: Record<CampaignStatus, { label: string; dot: string; text: string }> = {
  active:    { label: "Activa",     dot: "bg-green-400", text: "text-green-700"  },
  draft:     { label: "Borrador",   dot: "bg-zinc-400",  text: "text-zinc-600"   },
  paused:    { label: "Pausada",    dot: "bg-amber-400", text: "text-amber-700"  },
  completed: { label: "Completada", dot: "bg-blue-400",  text: "text-blue-700"   },
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Campaign Card ─────────────────────────────────────────────────────────────

function CampaignCard({
  campaign, onOpen, onToggleStatus,
}: {
  campaign: Campaign;
  onOpen: (c: Campaign) => void;
  onToggleStatus: (id: string, current: CampaignStatus) => void;
}) {
  const type   = TYPE_META[campaign.type];
  const status = STATUS_META[campaign.status];
  const Icon   = type.icon;
  const isActive = campaign.status === "active";

  return (
    <div className="group relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${type.bg}`}>
          <Icon className={`h-5 w-5 ${type.color}`} />
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.text} bg-zinc-50`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot} ${isActive ? "animate-pulse" : ""}`} />
            {status.label}
          </span>
          {/* Quick toggle active/paused */}
          {(campaign.status === "active" || campaign.status === "paused") && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStatus(campaign.id, campaign.status); }}
              className={[
                "rounded-lg p-1.5 transition-colors",
                isActive
                  ? "text-amber-500 hover:bg-amber-50"
                  : "text-green-600 hover:bg-green-50",
              ].join(" ")}
              title={isActive ? "Pausar campaña" : "Activar campaña"}
            >
              {isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          )}
          {campaign.status === "draft" && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStatus(campaign.id, "draft"); }}
              className="rounded-lg bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700 hover:bg-green-100 transition-colors"
              title="Activar campaña"
            >
              Activar
            </button>
          )}
        </div>
      </div>

      <button onClick={() => onOpen(campaign)} className="mt-3 block w-full text-left">
        <h3 className="text-sm font-bold text-zinc-900 group-hover:text-indigo-700 transition-colors">
          {campaign.name}
        </h3>
        <p className={`mt-0.5 text-[11px] font-medium ${type.color}`}>{type.label}</p>

        <div className="mt-4 flex items-center gap-4 border-t border-zinc-100 pt-3">
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-900">
              {campaign.totalLeads >= 1000 ? `${(campaign.totalLeads / 1000).toFixed(0)}K` : campaign.totalLeads}
            </p>
            <p className="text-[10px] text-zinc-400">leads</p>
          </div>
          <div className="h-6 w-px bg-zinc-200" />
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-900">{campaign.segmentCount}</p>
            <p className="text-[10px] text-zinc-400">segmento{campaign.segmentCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-zinc-400">
            <Clock className="h-3 w-3" />
            {fmtDate(campaign.createdAt)}
          </div>
        </div>
      </button>
    </div>
  );
}

// ── MAIN LIST VIEW ────────────────────────────────────────────────────────────

interface CampaignListViewProps {
  campaigns: Campaign[];
  onOpen: (c: Campaign) => void;
  onNew: () => void;
  onCampaignsChange: (campaigns: Campaign[]) => void;
}

const STATUS_ORDER: CampaignStatus[] = ["active", "paused", "draft", "completed"];

export function CampaignListView({
  campaigns, onOpen, onNew, onCampaignsChange,
}: CampaignListViewProps) {
  const [emergencyBrakeUsed, setEmergencyBrakeUsed] = useState(false);
  const [showBrakeConfirm, setShowBrakeConfirm]     = useState(false);

  const sorted      = [...campaigns].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const totalLeads  = campaigns.reduce((s, c) => s + c.totalLeads, 0);

  function toggleCampaignStatus(id: string, current: CampaignStatus) {
    onCampaignsChange(
      campaigns.map((c) =>
        c.id === id
          ? { ...c, status: current === "active" ? "paused" : "active" }
          : c
      )
    );
  }

  function activateEmergencyBrake() {
    onCampaignsChange(campaigns.map((c) => c.status === "active" ? { ...c, status: "paused" } : c));
    setEmergencyBrakeUsed(true);
    setShowBrakeConfirm(false);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* ── Header ── */}
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Campañas de Automatización</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {campaigns.length} campaña{campaigns.length !== 1 ? "s" : ""}&nbsp;·&nbsp;
            {activeCount} activa{activeCount !== 1 ? "s" : ""}&nbsp;·&nbsp;
            {totalLeads >= 1000 ? `${(totalLeads / 1000).toFixed(0)}K` : totalLeads} leads totales
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* FRENO DE EMERGENCIA */}
          {activeCount > 0 && !emergencyBrakeUsed && (
            <div className="relative">
              {showBrakeConfirm ? (
                <div className="flex items-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2">
                  <p className="text-xs font-medium text-red-700">
                    ¿Pausar <strong>{activeCount}</strong> campaña{activeCount !== 1 ? "s" : ""} activa{activeCount !== 1 ? "s" : ""}?
                  </p>
                  <button
                    onClick={activateEmergencyBrake}
                    className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setShowBrakeConfirm(false)}
                    className="text-[11px] font-medium text-red-500 hover:text-red-700"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowBrakeConfirm(true)}
                  className="flex items-center gap-1.5 rounded-xl border-2 border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-600 transition-all hover:bg-red-50 hover:border-red-400"
                >
                  <AlertOctagon className="h-4 w-4" />
                  🛑 Freno de emergencia
                </button>
              )}
            </div>
          )}

          {emergencyBrakeUsed && (
            <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
              <AlertOctagon className="h-3.5 w-3.5" />
              Todas las campañas pausadas
            </div>
          )}

          <button
            onClick={onNew}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700"
          >
            <Plus className="h-4 w-4" />
            Nueva Campaña
          </button>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100">
              <Play className="h-7 w-7 text-zinc-400" />
            </div>
            <p className="text-sm font-semibold text-zinc-700">Sin campañas todavía</p>
            <p className="mt-1 text-xs text-zinc-400">Crea tu primera campaña para empezar a prospectar.</p>
            <button
              onClick={onNew}
              className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              <Plus className="h-4 w-4" />
              Crear campaña
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                onOpen={onOpen}
                onToggleStatus={toggleCampaignStatus}
              />
            ))}
            <button
              onClick={onNew}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 p-8 text-zinc-400 transition-all hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                <Plus className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">Nueva campaña</p>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
