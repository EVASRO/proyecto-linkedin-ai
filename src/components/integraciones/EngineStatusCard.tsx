"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, CheckCircle2, Clock, ListTodo,
  Pause, Play, AlertTriangle, Loader2, XCircle,
} from "lucide-react";
import type { EngineData } from "@/app/dashboard/configuracion/actions";
import { updateEngineStatus } from "@/app/dashboard/configuracion/actions";

// -- helpers ------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `Hace ${diff}s`;
  if (diff < 3600)  return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return `Hace ${Math.floor(diff / 86400)}d`;
}

const STATUS_CONFIG = {
  running: {
    label: "Activo",
    dot: "bg-[#10b981]",
    text: "text-[#10b981]",
    border: "rgba(16,185,129,0.25)",
    bg: "rgba(16,185,129,0.04)",
    icon: <Activity size={14} />,
  },
  paused: {
    label: "Pausado",
    dot: "bg-amber-400",
    text: "text-amber-500",
    border: "rgba(245,158,11,0.25)",
    bg: "rgba(245,158,11,0.04)",
    icon: <Pause size={14} />,
  },
  stopped: {
    label: "Detenido",
    dot: "bg-zinc-400",
    text: "text-zinc-500",
    border: "rgba(161,161,170,0.25)",
    bg: "rgba(161,161,170,0.04)",
    icon: <Clock size={14} />,
  },
  error: {
    label: "Error",
    dot: "bg-red-500",
    text: "text-red-500",
    border: "rgba(239,68,68,0.25)",
    bg: "rgba(239,68,68,0.04)",
    icon: <AlertTriangle size={14} />,
  },
} as const;

// -- Stat chip ----------------------------------------------------------------

function StatChip({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  highlight?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 min-w-0">
      <div className={`flex items-center gap-1.5 text-xs ${highlight ?? "text-muted-foreground"}`}>
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

// -- Props --------------------------------------------------------------------

type Props = {
  engine: EngineData;
  onRefresh: () => Promise<void>;
};

export function EngineStatusCard({ engine, onRefresh }: Props) {
  const [loading, setLoading] = useState<"start" | "pause" | "refresh" | null>(null);
  const cfg = STATUS_CONFIG[engine.status] ?? STATUS_CONFIG.stopped;

  async function handleRefresh() {
    setLoading("refresh");
    await onRefresh();
    setLoading(null);
  }

  async function handleToggle(newStatus: "running" | "paused") {
    setLoading(newStatus === "running" ? "start" : "pause");
    await updateEngineStatus(newStatus);
    await onRefresh();
    setLoading(null);
  }

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center">
            <Activity size={18} className="text-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Motor Ghost Engine</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              {engine.status === "running" && (
                <motion.div
                  className={`w-2 h-2 rounded-full ${cfg.dot}`}
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              )}
              {engine.status !== "running" && (
                <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              )}
              <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
              {engine.last_heartbeat_at && (
                <span className="text-xs text-muted-foreground">
                  · {timeAgo(engine.last_heartbeat_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {engine.status === "running" ? (
            <button
              onClick={() => handleToggle("paused")}
              disabled={!!loading}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Pausar motor"
            >
              {loading === "pause" ? <Loader2 size={13} className="animate-spin" /> : <Pause size={13} />}
              Pausar
            </button>
          ) : (
            <button
              onClick={() => handleToggle("running")}
              disabled={!!loading}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(90deg, #2563eb, #06b6d4)" }}
              title="Iniciar motor"
            >
              {loading === "start" ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              Iniciar
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={!!loading}
            className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Refrescar"
          >
            {loading === "refresh" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Activity size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatChip
          icon={<ListTodo size={12} />}
          label="En cola"
          value={engine.queue_pending}
        />
        <StatChip
          icon={<CheckCircle2 size={12} />}
          label="Completadas hoy"
          value={engine.queue_done_today}
          highlight="text-[#10b981]"
        />
        <StatChip
          icon={<XCircle size={12} />}
          label="Errores hoy"
          value={engine.queue_errors_today}
          highlight={engine.queue_errors_today > 0 ? "text-red-500" : undefined}
        />
        <StatChip
          icon={<Activity size={12} />}
          label="Conexiones"
          value={engine.connections_sent}
        />
        <StatChip
          icon={<Activity size={12} />}
          label="Mensajes"
          value={engine.messages_sent}
        />
      </div>
    </div>
  );
}
