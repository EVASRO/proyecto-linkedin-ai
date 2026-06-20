"use client";

import {
  ArrowLeft, CheckCircle2, Eye, Layers, Loader2,
  Rocket, Save, TestTube2, XCircle,
} from "lucide-react";
import type { FlowNode, FlowEdge } from "./types";

// -- Validation logic (shared, pure) ------------------------------------------

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateFlow(nodes: FlowNode[], edges: FlowEdge[]): ValidationResult {
  if (nodes.length === 0) return { ok: false, reason: "El lienzo está vacío. Añade al menos un nodo START." };

  const hasStart = nodes.some((n) => n.type === "start");
  if (!hasStart) return { ok: false, reason: "Falta el nodo de inicio (START)." };

  const hasEnd = nodes.some((n) => n.type === "end");
  if (!hasEnd) return { ok: false, reason: "Falta el nodo de fin (END). Cierra la secuencia." };

  const hasAction = nodes.some((n) => ["connect", "message", "email", "email_node"].includes(n.type ?? ""));
  if (!hasAction) return { ok: false, reason: "El flujo necesita al menos un nodo de acción (Conexión, Mensaje o Email)." };

  // Every non-start node should have at least one incoming edge
  const targets = new Set(edges.map((e) => e.target));
  const orphans  = nodes.filter((n) => n.type !== "start" && !targets.has(n.id));
  if (orphans.length > 0) {
    return { ok: false, reason: `Nodo(s) sin conexión de entrada: ${orphans.map((n) => n.data.label).join(", ")}` };
  }

  return { ok: true };
}

// -- Props ---------------------------------------------------------------------

export interface FlowToolbarProps {
  campaignName: string;
  campaignStatus: string;
  nodeCount: number;
  saving: boolean;
  dirty: boolean;
  abEnabled: boolean;
  onBack: () => void;
  onSave: () => void;
  onValidate: () => void;
  onToggleAB: () => void;
  onPreview: () => void;
  onLaunch: () => void;
  totalLeads?:     number;
  completedLeads?: number;
}

// -- Status badge map ----------------------------------------------------------

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Borrador",   cls: "bg-[var(--border)] text-[var(--foreground-muted)]"          },
  active:    { label: "Activa",     cls: "bg-[rgba(16,185,129,0.12)] text-[#10B981]"                  },
  paused:    { label: "Pausada",    cls: "bg-[rgba(245,158,11,0.12)] text-[#F59E0B]"                  },
  completed: { label: "Completada", cls: "bg-[rgba(37,99,235,0.12)] text-[#2563EB]"                   },
  archived:  { label: "Archivada",  cls: "bg-[var(--border)] text-[var(--foreground-muted)]"          },
};

// -- Component -----------------------------------------------------------------

export function FlowToolbar({
  campaignName,
  campaignStatus,
  nodeCount,
  saving,
  dirty,
  abEnabled,
  onBack,
  onSave,
  onValidate,
  onToggleAB,
  onPreview,
  onLaunch,
  totalLeads,
  completedLeads,
}: FlowToolbarProps) {
  const badge = STATUS_BADGE[campaignStatus] ?? STATUS_BADGE.draft;

  return (
    <div className="flex flex-shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Campañas
      </button>

      <div className="h-4 w-px bg-[var(--border)]" />

      {/* Campaign name + status */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-[var(--foreground)] max-w-[180px] truncate" title={campaignName}>
          {campaignName}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* Node count */}
      <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-[11px] text-[var(--foreground-muted)]">
        <Layers className="h-3.5 w-3.5" />
        {nodeCount} nodo{nodeCount !== 1 ? "s" : ""}
      </div>

      {/* Lead progress badge */}
      {totalLeads !== undefined && totalLeads > 0 && (
        <div className="flex items-center gap-1.5 rounded-full bg-[var(--background)] border border-[var(--border)] px-3 py-1 text-xs">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[var(--foreground-muted)]">
            {completedLeads ?? 0}
            <span className="text-[var(--foreground-faint)]">/{totalLeads}</span>
            <span className="ml-1 text-[var(--foreground-faint)]">leads</span>
          </span>
        </div>
      )}

      {/* Save indicator */}
      <div className="flex items-center gap-1 text-[10px]">
        {dirty ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
            <span className="text-[#F59E0B] font-medium">Sin guardar</span>
          </>
        ) : (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
            <span className="text-[#10B981] font-medium">Guardado</span>
          </>
        )}
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* A/B Test toggle */}
        <button
          onClick={onToggleAB}
          className={[
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
            abEnabled
              ? "border-[rgba(6,182,212,0.3)] bg-[rgba(6,182,212,0.12)] text-[#06B6D4] font-semibold"
              : "border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.06)]",
          ].join(" ")}
          title="Activar/desactivar A/B test"
        >
          <TestTube2 className="h-3.5 w-3.5" />
          {abEnabled ? "A/B Activo" : "A/B Test"}
        </button>

        {/* Preview */}
        <button
          onClick={onPreview}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          Vista previa
        </button>

        {/* Validate */}
        <button
          onClick={onValidate}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
        >
          {<CheckCircle2 className="h-3.5 w-3.5" />}
          Validar
        </button>

        {/* Save */}
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.06)] disabled:opacity-60 transition-all"
        >
          {saving
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Save className="h-3.5 w-3.5" />}
          {saving ? "Guardando…" : "Guardar"}
        </button>

        {/* Launch */}
        <button
          onClick={onLaunch}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-[rgba(37,99,235,0.25)] hover:opacity-90 transition-all"
        >
          <Rocket className="h-3.5 w-3.5" />
          Lanzar
        </button>
      </div>
    </div>
  );
}

// -- Toast (shared minimal) ----------------------------------------------------

export type ToastState = { type: "success" | "error" | "info"; msg: string } | null;

export function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  if (!toast) return null;
  const styles = {
    success: "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.12)] text-[#10B981]",
    error:   "border-[rgba(239,68,68,0.3)]  bg-[rgba(239,68,68,0.12)]  text-[#EF4444]",
    info:    "border-[rgba(37,99,235,0.3)]   bg-[rgba(37,99,235,0.12)]  text-[#2563EB]",
  }[toast.type];
  const Icon = toast.type === "success" ? CheckCircle2 : XCircle;
  const iconCls = toast.type === "success" ? "text-[#10B981]" : "text-[#EF4444]";

  return (
    <div
      className={[
        "absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-xl border pointer-events-auto",
        styles,
      ].join(" ")}
    >
      <Icon className={`h-4 w-4 flex-shrink-0 ${iconCls}`} />
      {toast.msg}
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100 text-current">✕</button>
    </div>
  );
}

// -- Preview Modal -------------------------------------------------------------

interface PreviewModalProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onClose: () => void;
}

const NODE_EMOJI: Record<string, string> = {
  start: "🟢", connect: "🔗", message: "💬", delay: "⏱", wait: "⏱",
  condition: "🔀", email: "📧", email_node: "📧", end: "🏁",
  autopilot: "🤖", visit: "👁", like: "❤️",
};

export function PreviewModal({ nodes, edges, onClose }: PreviewModalProps) {
  // Build a simple topological order
  const childMap = new Map<string, string[]>();
  for (const e of edges) {
    const arr = childMap.get(e.source) ?? [];
    arr.push(e.target);
    childMap.set(e.source, arr);
  }
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const ordered: FlowNode[] = [];

  function dfs(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const n = nodeMap.get(id);
    if (n) ordered.push(n);
    for (const childId of childMap.get(id) ?? []) dfs(childId);
  }

  const startNode = nodes.find((n) => n.type === "start");
  if (startNode) dfs(startNode.id);
  // Append any disconnected nodes
  for (const n of nodes) if (!visited.has(n.id)) ordered.push(n);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <p className="text-xs text-[var(--foreground-muted)] font-medium">Vista previa de secuencia</p>
            <p className="text-sm font-bold text-[var(--foreground)]">Timeline del flujo</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--foreground-faint)] hover:bg-[rgba(255,255,255,0.06)]">✕</button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          {ordered.length === 0 ? (
            <p className="text-sm text-[var(--foreground-faint)] text-center py-8">No hay nodos para mostrar.</p>
          ) : (
            <ol className="space-y-0">
              {ordered.map((n, i) => {
                const emoji   = NODE_EMOJI[n.type ?? ""] ?? "⬛";
                const isLast  = i === ordered.length - 1;
                const summary = buildSummary(n);
                return (
                  <li key={n.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--background)] text-sm">
                        {emoji}
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-[var(--border)] mt-1 mb-1 min-h-[16px]" />}
                    </div>
                    <div className="pb-4 min-w-0">
                      <p className="text-xs font-bold text-[var(--foreground)]">{n.data.label}</p>
                      {summary && <p className="mt-0.5 text-[11px] text-[var(--foreground-muted)] leading-relaxed">{summary}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="border-t border-[var(--border)] bg-[var(--background)] px-6 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2 text-xs font-bold text-white hover:opacity-90"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function buildSummary(n: FlowNode): string {
  const d = n.data;
  switch (n.type) {
    case "connect":
      return d.addNote
        ? `Con nota: "${(d.connectionNote ?? d.messageA ?? "").slice(0, 80)}"`
        : "Solicitud sin nota";
    case "message":
      return `"${(d.bodyA ?? "").slice(0, 80)}"`;
    case "delay":
    case "wait":
      return `Esperar ${d.days ?? 1} ${d.delayUnit === "horas" ? "horas" : "días"}`;
    case "condition":
      return `Condición: ${d.conditionType ?? "—"}`;
    case "email":
    case "email_node":
      return `Asunto: ${d.subject ?? "—"}`;
    case "autopilot":
      return d.autopilotEnabled ? "Agente IA activo" : "Agente IA (inactivo)";
    default:
      return "";
  }
}

// -- Validation Modal ----------------------------------------------------------

interface ValidationModalProps {
  result: ValidationResult;
  onClose: () => void;
}

export function ValidationModal({ result, onClose }: ValidationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className={[
          "flex items-center gap-3 px-6 py-4",
          result.ok
            ? "bg-[rgba(16,185,129,0.08)] border-b border-[rgba(16,185,129,0.2)]"
            : "bg-[rgba(239,68,68,0.08)] border-b border-[rgba(239,68,68,0.2)]",
        ].join(" ")}>
          {result.ok
            ? <CheckCircle2 className="h-5 w-5 text-[#10B981] flex-shrink-0" />
            : <XCircle className="h-5 w-5 text-[#EF4444] flex-shrink-0" />}
          <p className={`text-sm font-bold ${result.ok ? "text-[#10B981]" : "text-[#EF4444]"}`}>
            {result.ok ? "Flujo válido" : "Flujo inválido"}
          </p>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-[var(--foreground-muted)]">
            {result.ok
              ? "El flujo cumple todos los requisitos mínimos para lanzarse. ✓"
              : result.reason}
          </p>
        </div>
        <div className="border-t border-[var(--border)] bg-[var(--background)] px-6 py-3 text-right">
          <button onClick={onClose} className="rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2 text-xs font-bold text-white hover:opacity-90">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
