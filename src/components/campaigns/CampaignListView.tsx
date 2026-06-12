"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertOctagon, Archive, Check, Clock, Link2, Loader2, Mail, MoreVertical,
  Pause, Play, Plus, Sparkles, X,
} from "lucide-react";
import type { Campaign, CampaignStatus, CampaignType } from "./types";
import {
  archiveCampaign, updateCampaignStatus, launchCampaign,
} from "@/app/dashboard/campanas/actions";

// -- Helpers -------------------------------------------------------------------

const TYPE_META: Record<CampaignType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  linkedin:        { icon: Link2,    color: "text-blue-700",   bg: "bg-blue-50",   label: "LinkedIn"        },
  sales_navigator: { icon: Sparkles, color: "text-violet-700", bg: "bg-violet-50", label: "Sales Navigator" },
  email:           { icon: Mail,     color: "text-sky-700",    bg: "bg-sky-50",    label: "Email"           },
};

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  active:    { label: "Activa",     dot: "bg-green-400",  text: "text-green-700"  },
  draft:     { label: "Borrador",   dot: "bg-zinc-400",   text: "text-zinc-600"   },
  paused:    { label: "Pausada",    dot: "bg-amber-400",  text: "text-amber-700"  },
  completed: { label: "Completada", dot: "bg-blue-400",   text: "text-blue-700"   },
  archived:  { label: "Archivada",  dot: "bg-zinc-300",   text: "text-zinc-400"   },
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

// -- ConfirmModal --------------------------------------------------------------

interface ConfirmModalProps {
  title: string;
  body: string;
  confirmLabel: string;
  confirmCls: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ title, body, confirmLabel, confirmCls, loading, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-zinc-600">{body}</p>
        </div>
        <div className="flex gap-3 border-t border-zinc-100 bg-zinc-50/60 px-5 py-4">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-60 ${confirmCls}`}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Campaign Card -------------------------------------------------------------

interface CampaignCardProps {
  campaign: Campaign;
  onOpen: (c: Campaign) => void;
  onArchive: (id: string, name: string) => void;
  onToggleStatus: (id: string, current: CampaignStatus) => void;
}

function CampaignCard({ campaign, onOpen, onArchive, onToggleStatus }: CampaignCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const type     = TYPE_META[campaign.type] ?? TYPE_META["linkedin"];
  const status   = STATUS_META[campaign.status] ?? STATUS_META["draft"];
  const Icon     = type.icon;
  const isActive = campaign.status === "active";

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div className="group relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${type.bg}`}>
          <Icon className={`h-5 w-5 ${type.color}`} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.text} bg-zinc-50`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot} ${isActive ? "animate-pulse" : ""}`} />
            {status.label}
          </span>

          {/* Quick toggle */}
          {(campaign.status === "active" || campaign.status === "paused") && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStatus(campaign.id, campaign.status); }}
              className={["rounded-lg p-1.5 transition-colors", isActive ? "text-amber-500 hover:bg-amber-50" : "text-green-600 hover:bg-green-50"].join(" ")}
              title={isActive ? "Pausar" : "Activar"}
            >
              {isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          )}
          {campaign.status === "draft" && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStatus(campaign.id, "draft"); }}
              className="rounded-lg bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700 hover:bg-green-100 transition-colors"
            >
              Activar
            </button>
          )}

          {/* ⋮ Menu */}
          <div ref={menuRef} className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onOpen(campaign); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  <Play className="h-3.5 w-3.5 text-zinc-400" />
                  Editar flujo
                </button>
                {(campaign.status === "active" || campaign.status === "paused") && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleStatus(campaign.id, campaign.status); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    {isActive ? <Pause className="h-3.5 w-3.5 text-zinc-400" /> : <Play className="h-3.5 w-3.5 text-zinc-400" />}
                    {isActive ? "Pausar" : "Activar"}
                  </button>
                )}
                <div className="my-1 h-px bg-zinc-100" />
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onArchive(campaign.id, campaign.name); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-amber-600 hover:bg-amber-50"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archivar
                </button>
              </div>
            )}
          </div>
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

// -- Toast ---------------------------------------------------------------------

type ToastState = { type: "success" | "error"; msg: string } | null;

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div className={[
      "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-xl border",
      toast.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800",
    ].join(" ")}>
      {toast.type === "success" ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
      {toast.msg}
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

// -- MAIN LIST VIEW ------------------------------------------------------------

interface CampaignListViewProps {
  campaigns: Campaign[];
  onOpen: (c: Campaign) => void;
  onNew: () => void;
  onCampaignsChange: (campaigns: Campaign[]) => void;
}

type ConfirmState = { open: boolean; action: "archive"; id: string; name: string };

const EMPTY_CONFIRM: ConfirmState = { open: false, action: "archive", id: "", name: "" };

const STATUS_ORDER = ["active", "paused", "draft", "completed", "archived"];

export function CampaignListView({ campaigns, onOpen, onNew, onCampaignsChange }: CampaignListViewProps) {
  const router = useRouter();
  const [isPending, startTransition]  = useTransition();
  const [emergencyBrakeUsed, setEmergencyBrakeUsed] = useState(false);
  const [showBrakeConfirm, setShowBrakeConfirm]     = useState(false);
  const [confirm, setConfirm]         = useState<ConfirmState>(EMPTY_CONFIRM);
  const [toast, setToast]             = useState<ToastState>(null);

  const sorted      = [...campaigns].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const totalLeads  = campaigns.reduce((s, c) => s + c.totalLeads, 0);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  function toggleCampaignStatus(id: string, current: CampaignStatus) {
    // Bug 4: draft → active must go through launchCampaign (activates segments + queues tasks)
    if (current === "draft") {
      onCampaignsChange(campaigns.map((c) => c.id === id ? { ...c, status: "active" } : c));
      startTransition(async () => {
        const res = await launchCampaign(id);
        if (!res.success) {
          onCampaignsChange(campaigns.map((c) => c.id === id ? { ...c, status: "draft" } : c));
          showToast("error", res.error ?? "Error al lanzar campaña");
        } else {
          showToast("success", "Campaña lanzada correctamente");
          router.refresh();
        }
      });
      return;
    }

    const next: CampaignStatus = current === "active" ? "paused" : "active";
    onCampaignsChange(campaigns.map((c) => c.id === id ? { ...c, status: next } : c));
    startTransition(async () => {
      const res = await updateCampaignStatus(id, next);
      if (!res.success) {
        onCampaignsChange(campaigns.map((c) => c.id === id ? { ...c, status: current } : c));
        showToast("error", res.error ?? "Error al cambiar estado");
      } else {
        const affected = res.data?.affectedTasks ?? 0;
        if (next === "active") {
          showToast("success", affected > 0 ? `Campaña activada · ${affected} acciones reanudadas` : "Campaña activada");
        } else {
          showToast("success", affected > 0 ? `Campaña pausada · ${affected} acciones pausadas` : "Campaña pausada");
        }
        router.refresh();
      }
    });
  }

  function activateEmergencyBrake() {
    onCampaignsChange(campaigns.map((c) => c.status === "active" ? { ...c, status: "paused" } : c));
    setEmergencyBrakeUsed(true);
    setShowBrakeConfirm(false);
  }

  function handleConfirmAction() {
    const { id, name } = confirm;
    setConfirm(EMPTY_CONFIRM);

    startTransition(async () => {
      const res = await archiveCampaign(id);
      if (res.success) {
        const cancelled = res.data?.cancelledTasks ?? 0;
        onCampaignsChange(campaigns.filter((c) => c.id !== id));
        showToast("success", cancelled > 0
          ? `Campaña "${name}" archivada · ${cancelled} acciones canceladas`
          : `Campaña "${name}" archivada`
        );
        router.refresh();
      } else {
        showToast("error", res.error ?? "Error al archivar");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* -- Header -- */}
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
          {activeCount > 0 && !emergencyBrakeUsed && (
            <div className="relative">
              {showBrakeConfirm ? (
                <div className="flex items-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2">
                  <p className="text-xs font-medium text-red-700">
                    ¿Pausar <strong>{activeCount}</strong> campaña{activeCount !== 1 ? "s" : ""} activa{activeCount !== 1 ? "s" : ""}?
                  </p>
                  <button onClick={activateEmergencyBrake} className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700">Confirmar</button>
                  <button onClick={() => setShowBrakeConfirm(false)} className="text-[11px] font-medium text-red-500 hover:text-red-700">Cancelar</button>
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

      {/* -- Grid -- */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100">
              <Play className="h-7 w-7 text-zinc-400" />
            </div>
            <p className="text-sm font-semibold text-zinc-700">Sin campañas todavía</p>
            <p className="mt-1 text-xs text-zinc-400">Crea tu primera campaña para empezar a prospectar.</p>
            <button onClick={onNew} className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
              <Plus className="h-4 w-4" /> Crear campaña
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
                onArchive={(id, name) => setConfirm({ open: true, action: "archive", id, name })}
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

      {confirm.open && (
        <ConfirmModal
          title="Archivar campaña"
          body={`¿Archivar campaña "${confirm.name}"? Se cancelarán las acciones pendientes. Los datos y métricas se conservan. Podrás recuperarla desde Archivadas.`}
          confirmLabel="Archivar"
          confirmCls="bg-amber-500 hover:bg-amber-600"
          loading={isPending}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirm(EMPTY_CONFIRM)}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
