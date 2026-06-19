"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertOctagon, AlertTriangle, Archive, Check, Clock, Link2, Loader2,
  Mail, MoreVertical, Pause, Play, Plus, Sparkles, Trash2, Users, X,
} from "lucide-react";
import type { Campaign, CampaignStatus, CampaignType } from "./types";
import {
  archiveCampaign, updateCampaignStatus, launchCampaign,
  deleteCampaignFull, getLeadCountForCampaign,
} from "@/app/dashboard/campanas/actions";

// -- Helpers -------------------------------------------------------------------

const TYPE_META: Record<CampaignType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  linkedin:        { icon: Link2,    color: "text-[#2563EB]",  bg: "bg-[rgba(37,99,235,0.12)]",  label: "LinkedIn"        },
  sales_navigator: { icon: Sparkles, color: "text-[#06B6D4]",  bg: "bg-[rgba(6,182,212,0.12)]",  label: "Sales Navigator" },
  email:           { icon: Mail,     color: "text-[#2563EB]",  bg: "bg-[rgba(37,99,235,0.08)]",  label: "Email"           },
};

const STATUS_META: Record<string, { label: string; dot: string; text: string; badge: string }> = {
  active:    { label: "Activa",     dot: "bg-[#10B981]",  text: "text-[#10B981]",                badge: "bg-[rgba(16,185,129,0.15)]"  },
  draft:     { label: "Borrador",   dot: "bg-[var(--foreground-faint)]", text: "text-[var(--foreground-muted)]", badge: "bg-[var(--border)]"          },
  paused:    { label: "Pausada",    dot: "bg-[#F59E0B]",  text: "text-[#F59E0B]",                badge: "bg-[rgba(245,158,11,0.15)]"  },
  completed: { label: "Completada", dot: "bg-[#2563EB]",  text: "text-[#2563EB]",                badge: "bg-[rgba(37,99,235,0.15)]"   },
  archived:  { label: "Archivada",  dot: "bg-[var(--foreground-faint)]", text: "text-[var(--foreground-faint)]", badge: "bg-[var(--border)]"           },
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
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-sm font-bold text-[var(--foreground)]">{title}</h3>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--border)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-[var(--foreground-muted)]">{body}</p>
        </div>
        <div className="flex gap-3 border-t border-[var(--border)] bg-[var(--background)] px-5 py-4">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-xs font-semibold text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)] transition-colors">
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

// -- DeleteCampaignDialog ------------------------------------------------------

interface DeleteCampaignDialogProps {
  name: string;
  leadCount: number;
  loadingCount: boolean;
  deleteLeads: boolean;
  onDeleteLeadsChange: (v: boolean) => void;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteCampaignDialog({
  name, leadCount, loadingCount, deleteLeads, onDeleteLeadsChange,
  loading, onConfirm, onCancel,
}: DeleteCampaignDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(239,68,68,0.12)]">
            <Trash2 className="h-4 w-4 text-[#EF4444]" />
          </div>
          <h3 className="text-sm font-bold text-[var(--foreground)]">¿Eliminar campaña?</h3>
          <button onClick={onCancel} className="ml-auto rounded-lg p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--border)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-[var(--foreground-muted)]">
            Vas a eliminar permanentemente <strong className="text-[var(--foreground)]">{name}</strong>.
            Esta acción no se puede deshacer.
          </p>

          {/* Lead count badge */}
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3">
            <Users className="h-4 w-4 text-[var(--foreground-faint)]" />
            <span className="text-sm text-[var(--foreground-muted)]">
              {loadingCount ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Contando leads…
                </span>
              ) : (
                <>
                  <strong className="text-[var(--foreground)]">{leadCount}</strong> lead{leadCount !== 1 ? "s" : ""} vinculado{leadCount !== 1 ? "s" : ""}
                </>
              )}
            </span>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className={[
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
              !deleteLeads
                ? "border-[rgba(37,99,235,0.4)] bg-[rgba(37,99,235,0.06)]"
                : "border-[var(--border)] hover:bg-[var(--surface-hover)]",
            ].join(" ")}>
              <input
                type="radio"
                name="deleteLeads"
                checked={!deleteLeads}
                onChange={() => onDeleteLeadsChange(false)}
                className="mt-0.5 accent-[#2563EB]"
              />
              <div>
                <p className="text-xs font-semibold text-[var(--foreground)]">Eliminar campaña y mantener leads</p>
                <p className="mt-0.5 text-[10px] text-[var(--foreground-faint)]">
                  Los leads se desvinculan de la campaña y permanecen en el CRM.
                </p>
              </div>
            </label>

            <label className={[
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
              deleteLeads
                ? "border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.06)]"
                : "border-[var(--border)] hover:bg-[var(--surface-hover)]",
            ].join(" ")}>
              <input
                type="radio"
                name="deleteLeads"
                checked={deleteLeads}
                onChange={() => onDeleteLeadsChange(true)}
                className="mt-0.5 accent-[#EF4444]"
              />
              <div>
                <p className="text-xs font-semibold text-[#EF4444]">Eliminar campaña y todos sus leads</p>
                <p className="mt-0.5 text-[10px] text-[var(--foreground-faint)]">
                  Se eliminarán permanentemente {loadingCount ? "…" : leadCount} leads. Irreversible.
                </p>
              </div>
            </label>
          </div>

          {deleteLeads && leadCount > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)] px-3 py-2.5">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-[#EF4444]" />
              <p className="text-[11px] text-[#EF4444] font-medium">
                Se eliminarán {leadCount} lead{leadCount !== 1 ? "s" : ""} de forma permanente.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-[var(--border)] bg-[var(--background)] px-5 py-4">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-xs font-semibold text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)] transition-colors">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || loadingCount}
            className={[
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-60 transition-colors",
              deleteLeads ? "bg-[#EF4444] hover:opacity-90" : "bg-[#F59E0B] hover:opacity-90",
            ].join(" ")}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {deleteLeads ? "Eliminar todo" : "Eliminar campaña"}
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
  onDelete: (id: string, name: string) => void;
  onToggleStatus: (id: string, current: CampaignStatus) => void;
}

function CampaignCard({ campaign, onOpen, onArchive, onDelete, onToggleStatus }: CampaignCardProps) {
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
    <div className="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:border-[rgba(37,99,235,0.4)] hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${type.bg}`}>
          <Icon className={`h-5 w-5 ${type.color}`} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.text} ${status.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot} ${isActive ? "animate-pulse" : ""}`} />
            {status.label}
          </span>

          {/* Quick toggle */}
          {(campaign.status === "active" || campaign.status === "paused") && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStatus(campaign.id, campaign.status); }}
              className={["rounded-lg p-1.5 transition-colors", isActive ? "text-[#F59E0B] hover:bg-[rgba(245,158,11,0.12)]" : "text-[#10B981] hover:bg-[rgba(16,185,129,0.12)]"].join(" ")}
              title={isActive ? "Pausar" : "Activar"}
            >
              {isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          )}
          {campaign.status === "draft" && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStatus(campaign.id, "draft"); }}
              className="rounded-lg bg-[rgba(16,185,129,0.12)] px-2.5 py-1 text-[11px] font-bold text-[#10B981] hover:bg-[rgba(16,185,129,0.2)] transition-colors"
            >
              Activar
            </button>
          )}

          {/* ⋮ Menu */}
          <div ref={menuRef} className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="rounded-lg p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)] transition-colors"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onOpen(campaign); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.05)]"
                >
                  <Play className="h-3.5 w-3.5 text-[var(--foreground-faint)]" />
                  Editar flujo
                </button>
                {(campaign.status === "active" || campaign.status === "paused") && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleStatus(campaign.id, campaign.status); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.05)]"
                  >
                    {isActive ? <Pause className="h-3.5 w-3.5 text-[var(--foreground-faint)]" /> : <Play className="h-3.5 w-3.5 text-[var(--foreground-faint)]" />}
                    {isActive ? "Pausar" : "Activar"}
                  </button>
                )}
                <div className="my-1 h-px bg-[var(--border)]" />
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onArchive(campaign.id, campaign.name); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-[#F59E0B] hover:bg-[rgba(245,158,11,0.08)]"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archivar
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(campaign.id, campaign.name); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <button onClick={() => onOpen(campaign)} className="mt-3 block w-full text-left">
        <h3 className="text-sm font-bold text-[var(--foreground)] group-hover:text-[#2563EB] transition-colors">
          {campaign.name}
        </h3>
        <p className={`mt-0.5 text-[11px] font-medium ${type.color}`}>{type.label}</p>

        <div className="mt-4 flex items-center gap-4 border-t border-[var(--border)] pt-3">
          <div className="text-center">
            <p className="text-sm font-bold text-[var(--foreground)]">
              {campaign.totalLeads >= 1000 ? `${(campaign.totalLeads / 1000).toFixed(0)}K` : campaign.totalLeads}
            </p>
            <p className="text-[10px] text-[var(--foreground-muted)]">leads</p>
          </div>
          <div className="h-6 w-px bg-[var(--border)]" />
          <div className="text-center">
            <p className="text-sm font-bold text-[var(--foreground)]">{campaign.segmentCount}</p>
            <p className="text-[10px] text-[var(--foreground-muted)]">segmento{campaign.segmentCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-[var(--foreground-faint)]">
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
      toast.type === "success"
        ? "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.12)] text-[#10B981]"
        : "border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.12)] text-[#EF4444]",
    ].join(" ")}>
      {toast.type === "success" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
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
type DeleteState  = { open: boolean; id: string; name: string };

const EMPTY_CONFIRM: ConfirmState = { open: false, action: "archive", id: "", name: "" };
const EMPTY_DELETE:  DeleteState  = { open: false, id: "", name: "" };

const STATUS_ORDER = ["active", "paused", "draft", "completed", "archived"];

export function CampaignListView({ campaigns, onOpen, onNew, onCampaignsChange }: CampaignListViewProps) {
  const router = useRouter();
  const [isPending, startTransition]  = useTransition();
  const [emergencyBrakeUsed, setEmergencyBrakeUsed] = useState(false);
  const [showBrakeConfirm, setShowBrakeConfirm]     = useState(false);
  const [confirm, setConfirm]         = useState<ConfirmState>(EMPTY_CONFIRM);
  const [deleteState, setDeleteState] = useState<DeleteState>(EMPTY_DELETE);
  const [deleteLeads, setDeleteLeads] = useState(false);
  const [leadCount, setLeadCount]     = useState(0);
  const [loadingCount, setLoadingCount] = useState(false);
  const [toast, setToast]             = useState<ToastState>(null);

  const sorted      = [...campaigns].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const totalLeads  = campaigns.reduce((s, c) => s + c.totalLeads, 0);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  function toggleCampaignStatus(id: string, current: CampaignStatus) {
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

  async function openDeleteDialog(id: string, name: string) {
    setDeleteLeads(false);
    setLeadCount(0);
    setDeleteState({ open: true, id, name });
    setLoadingCount(true);
    const count = await getLeadCountForCampaign(id);
    setLeadCount(count);
    setLoadingCount(false);
  }

  function handleDeleteConfirm() {
    const { id, name } = deleteState;
    setDeleteState(EMPTY_DELETE);

    startTransition(async () => {
      const res = await deleteCampaignFull(id, deleteLeads);
      if (res.success) {
        onCampaignsChange(campaigns.filter((c) => c.id !== id));
        const msg = deleteLeads && (res.data?.deletedLeads ?? 0) > 0
          ? `Campaña "${name}" eliminada · ${res.data!.deletedLeads} leads eliminados`
          : `Campaña "${name}" eliminada · leads desvinculados`;
        showToast("success", msg);
        router.refresh();
      } else {
        showToast("error", res.error ?? "Error al eliminar");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* -- Header -- */}
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--foreground)]">Campañas de Automatización</h1>
          <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
            {campaigns.length} campaña{campaigns.length !== 1 ? "s" : ""}&nbsp;·&nbsp;
            {activeCount} activa{activeCount !== 1 ? "s" : ""}&nbsp;·&nbsp;
            {totalLeads >= 1000 ? `${(totalLeads / 1000).toFixed(0)}K` : totalLeads} leads totales
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeCount > 0 && !emergencyBrakeUsed && (
            <div className="relative">
              {showBrakeConfirm ? (
                <div className="flex items-center gap-2 rounded-xl border-2 border-red-500/40 bg-[rgba(239,68,68,0.08)] px-3 py-2">
                  <p className="text-xs font-medium text-[#EF4444]">
                    ¿Pausar <strong>{activeCount}</strong> campaña{activeCount !== 1 ? "s" : ""} activa{activeCount !== 1 ? "s" : ""}?
                  </p>
                  <button onClick={activateEmergencyBrake} className="rounded-lg bg-[#EF4444] px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90">Confirmar</button>
                  <button onClick={() => setShowBrakeConfirm(false)} className="text-[11px] font-medium text-[#EF4444] hover:opacity-70">Cancelar</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowBrakeConfirm(true)}
                  className="flex items-center gap-1.5 rounded-xl border-2 border-[rgba(239,68,68,0.4)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-[#EF4444] transition-all hover:bg-[rgba(239,68,68,0.08)] hover:border-[rgba(239,68,68,0.6)]"
                >
                  <AlertOctagon className="h-4 w-4" />
                  🛑 Freno de emergencia
                </button>
              )}
            </div>
          )}

          {emergencyBrakeUsed && (
            <div className="flex items-center gap-1.5 rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-3 py-2 text-xs font-bold text-[#F59E0B]">
              <AlertOctagon className="h-3.5 w-3.5" />
              Todas las campañas pausadas
            </div>
          )}

          <button
            onClick={onNew}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(37,99,235,0.3)] transition-opacity hover:opacity-90"
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
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--border)]">
              <Play className="h-7 w-7 text-[var(--foreground-muted)]" />
            </div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Sin campañas todavía</p>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">Crea tu primera campaña para empezar a prospectar.</p>
            <button onClick={onNew} className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
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
                onDelete={openDeleteDialog}
              />
            ))}
            <button
              onClick={onNew}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border)] p-8 text-[var(--foreground-muted)] transition-all hover:border-[rgba(37,99,235,0.4)] hover:bg-[rgba(37,99,235,0.03)] hover:text-[var(--foreground)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--border)]">
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
          confirmCls="bg-[#F59E0B] hover:opacity-90"
          loading={isPending}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirm(EMPTY_CONFIRM)}
        />
      )}

      {deleteState.open && (
        <DeleteCampaignDialog
          name={deleteState.name}
          leadCount={leadCount}
          loadingCount={loadingCount}
          deleteLeads={deleteLeads}
          onDeleteLeadsChange={setDeleteLeads}
          loading={isPending}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteState(EMPTY_DELETE)}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
