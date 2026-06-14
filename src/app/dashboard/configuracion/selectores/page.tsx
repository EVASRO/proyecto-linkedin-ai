"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { Bot, CheckCircle, XCircle, Clock, RefreshCw, PowerOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSelectorFailures,
  approveSelector,
  rejectSelector,
  deactivateOverride,
  type SelectorFailureRow,
  type SelectorOverrideRow,
} from "./actions";

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SelectorFailureRow["status"] }) {
  const map: Record<string, { label: string; className: string; pulse?: boolean }> = {
    pending:   { label: "Pendiente",  className: "bg-[var(--border)] text-[var(--foreground-muted)]" },
    analyzing: { label: "Analizando", className: "bg-[rgba(37,99,235,0.15)] text-[#93C5FD]", pulse: true },
    proposed:  { label: "Propuesto",  className: "bg-[rgba(245,158,11,0.15)] text-[#FCD34D]" },
    approved:  { label: "Aprobado",   className: "bg-[rgba(16,185,129,0.15)] text-[#6EE7B7]" },
    rejected:  { label: "Rechazado",  className: "bg-[rgba(239,68,68,0.15)] text-[#FCA5A5]" },
  };
  const cfg = map[status] ?? map.pending;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
      cfg.className,
      cfg.pulse && "animate-pulse",
    )}>
      {cfg.label}
    </span>
  );
}

// ── Confidence bar ────────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[var(--foreground-faint)] text-xs">—</span>;
  const pct = Math.round(value * 100);
  const color = value >= 0.85 ? "bg-emerald-500" : value >= 0.7 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-[var(--border)]">
        <div className={cn("h-1.5 rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[var(--foreground-muted)]">{pct}%</span>
    </div>
  );
}

// ── ApproveDialog ─────────────────────────────────────────────────────────────

function ApproveDialog({
  failure,
  onClose,
  onApproved,
}: {
  failure: SelectorFailureRow;
  onClose: () => void;
  onApproved: () => void;
}) {
  const [value, setValue] = useState(failure.proposed_selector ?? "");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function handleApprove() {
    if (!value.trim()) { setErr("El selector no puede estar vacío"); return; }
    startTransition(async () => {
      const res = await approveSelector(failure.id, value.trim());
      if (res.success) { onApproved(); onClose(); }
      else setErr(res.error ?? "Error desconocido");
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
        <h3 className="mb-1 text-base font-semibold text-[var(--foreground)]">Aprobar selector</h3>
        <p className="mb-4 text-xs text-[var(--foreground-muted)]">
          <span className="font-mono text-[var(--foreground)]">{failure.selector_key}</span> /{" "}
          {failure.platform} / {failure.action}
        </p>
        <label className="mb-1 block text-xs font-medium text-[var(--foreground-muted)]">
          Selector CSS
        </label>
        <input
          className="mb-4 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none focus:border-[#2563EB]"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder=".artdeco-button--primary"
          autoFocus
        />
        {err && <p className="mb-3 text-xs text-red-400">{err}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={pending}
            className="rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Aprobar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SelectoresPage() {
  const [failures, setFailures] = useState<SelectorFailureRow[]>([]);
  const [overrides, setOverrides] = useState<SelectorOverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<SelectorFailureRow | null>(null);
  const [, startTransition] = useTransition();

  const hasAnalyzing = failures.some((f) => f.status === "analyzing");

  const load = useCallback(async () => {
    const res = await getSelectorFailures();
    if (res.success) {
      setFailures(res.failures ?? []);
      setOverrides(res.overrides ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!hasAnalyzing) return;
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [hasAnalyzing, load]);

  function handleReject(id: string) {
    startTransition(async () => {
      await rejectSelector(id);
      await load();
    });
  }

  function handleDeactivate(id: string) {
    startTransition(async () => {
      await deactivateOverride(id);
      await load();
    });
  }

  const proposed = failures.filter((f) => f.status === "proposed");
  const analyzing = failures.filter((f) => f.status === "analyzing");
  const pending = failures.filter((f) => f.status === "pending");
  const approved = failures.filter((f) => f.status === "approved");

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-6 py-5">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-[#2563EB]" />
          <div>
            <h1 className="text-xl font-semibold text-[var(--foreground)]">Selectores IA</h1>
            <p className="text-sm text-[var(--foreground-muted)]">
              Auto-detección y corrección de selectores CSS rotos en LinkedIn
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground-muted)] hover:border-[#2563EB] hover:text-[var(--foreground)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </button>
        </div>

        {/* Stats row */}
        <div className="mt-4 flex gap-4">
          {[
            { label: "Propuestos", count: proposed.length,  color: "text-amber-400" },
            { label: "Analizando", count: analyzing.length, color: "text-blue-400" },
            { label: "Pendientes", count: pending.length,   color: "text-[var(--foreground-muted)]" },
            { label: "Aprobados",  count: approved.length,  color: "text-emerald-400" },
            { label: "Overrides activos", count: overrides.length, color: "text-purple-400" },
          ].map(({ label, count, color }) => (
            <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <p className={cn("text-lg font-bold", color)}>{count}</p>
              <p className="text-[11px] text-[var(--foreground-faint)]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {loading && (
          <div className="flex items-center justify-center py-16 text-[var(--foreground-faint)]">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Cargando…
          </div>
        )}

        {/* Proposed — need manual action */}
        {proposed.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Requieren revisión ({proposed.length})
            </h2>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wider text-[var(--foreground-faint)]">
                    <th className="px-4 py-3">Plataforma</th>
                    <th className="px-4 py-3">Acción</th>
                    <th className="px-4 py-3">Selector key</th>
                    <th className="px-4 py-3">Selector propuesto</th>
                    <th className="px-4 py-3">Confianza</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {proposed.map((f) => (
                    <tr key={f.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-4 py-3 text-[var(--foreground)] capitalize">{f.platform}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--foreground-muted)]">{f.action}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--foreground)]">{f.selector_key}</td>
                      <td className="max-w-xs px-4 py-3">
                        <span className="block truncate font-mono text-xs text-emerald-300">
                          {f.proposed_selector ?? "—"}
                        </span>
                        <span className="block truncate font-mono text-xs text-[var(--foreground-faint)] line-through">
                          {f.selector_tried}
                        </span>
                      </td>
                      <td className="px-4 py-3"><ConfidenceBar value={f.confidence} /></td>
                      <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setApproving(f)}
                            className="flex items-center gap-1 rounded-lg bg-emerald-700/30 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-700/50"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Aprobar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(f.id)}
                            className="flex items-center gap-1 rounded-lg bg-red-700/20 px-2.5 py-1 text-xs text-red-400 hover:bg-red-700/40"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Analyzing */}
        {analyzing.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-400">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Analizando con IA ({analyzing.length})
              <span className="text-[11px] font-normal text-[var(--foreground-faint)]">— se actualiza cada 30s</span>
            </h2>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wider text-[var(--foreground-faint)]">
                    <th className="px-4 py-3">Plataforma</th>
                    <th className="px-4 py-3">Acción</th>
                    <th className="px-4 py-3">Selector key</th>
                    <th className="px-4 py-3">Selector roto</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {analyzing.map((f) => (
                    <tr key={f.id} className="opacity-70">
                      <td className="px-4 py-3 text-[var(--foreground)] capitalize">{f.platform}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--foreground-muted)]">{f.action}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--foreground)]">{f.selector_key}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--foreground-faint)] line-through">{f.selector_tried}</td>
                      <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Pending */}
        {pending.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground-muted)]">
              <Clock className="h-4 w-4" />
              Pendientes ({pending.length})
            </h2>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wider text-[var(--foreground-faint)]">
                    <th className="px-4 py-3">Plataforma</th>
                    <th className="px-4 py-3">Acción</th>
                    <th className="px-4 py-3">Selector key</th>
                    <th className="px-4 py-3">Selector roto</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {pending.map((f) => (
                    <tr key={f.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-4 py-3 text-[var(--foreground)] capitalize">{f.platform}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--foreground-muted)]">{f.action}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--foreground)]">{f.selector_key}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--foreground-faint)]">{f.selector_tried}</td>
                      <td className="px-4 py-3 text-xs text-[var(--foreground-faint)]">
                        {new Date(f.created_at).toLocaleDateString("es-PE")}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setApproving(f)}
                          className="flex items-center gap-1 rounded-lg bg-[var(--border)] px-2.5 py-1 text-xs text-[var(--foreground)] hover:border-[#2563EB]"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Aprobar manual
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Active overrides */}
        {overrides.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-purple-400">
              <CheckCircle className="h-4 w-4" />
              Overrides activos ({overrides.length})
            </h2>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wider text-[var(--foreground-faint)]">
                    <th className="px-4 py-3">Plataforma</th>
                    <th className="px-4 py-3">Acción</th>
                    <th className="px-4 py-3">Selector key</th>
                    <th className="px-4 py-3">Valor activo</th>
                    <th className="px-4 py-3">Desde</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {overrides.map((o) => (
                    <tr key={o.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-4 py-3 text-[var(--foreground)] capitalize">{o.platform}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--foreground-muted)]">{o.action}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--foreground)]">{o.selector_key}</td>
                      <td className="max-w-xs px-4 py-3 font-mono text-xs text-emerald-300 truncate">{o.selector_value}</td>
                      <td className="px-4 py-3 text-xs text-[var(--foreground-faint)]">
                        {new Date(o.created_at).toLocaleDateString("es-PE")}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleDeactivate(o.id)}
                          className="flex items-center gap-1 rounded-lg bg-red-700/20 px-2.5 py-1 text-xs text-red-400 hover:bg-red-700/40"
                        >
                          <PowerOff className="h-3.5 w-3.5" />
                          Desactivar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Empty state */}
        {!loading && failures.length === 0 && overrides.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle className="mb-3 h-10 w-10 text-[rgba(16,185,129,0.5)]" />
            <p className="text-sm font-medium text-[var(--foreground-muted)]">Todo en orden</p>
            <p className="mt-1 text-xs text-[var(--foreground-faint)]">
              No hay fallos de selectores detectados. El engine funciona correctamente.
            </p>
          </div>
        )}
      </div>

      {/* Approve dialog */}
      {approving && (
        <ApproveDialog
          failure={approving}
          onClose={() => setApproving(null)}
          onApproved={load}
        />
      )}
    </div>
  );
}
