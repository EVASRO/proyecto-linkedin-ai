"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertCircle, ArrowRight, BarChart3, Bot,
  CalendarCheck, ChevronRight,
  Columns3, Eye, Heart, Inbox, Link2, Megaphone, MessageSquare,
  RefreshCw, TrendingUp, UserCheck, Users, Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import {
  getDashboardMetrics,
  getGhostEngineStatus,
  type GhostEngineSession,
  type ActivityFeedRow,
  type DashboardMetrics,
  type FunnelStage,
  type ActivityPoint,
} from "@/app/dashboard/actions";

// -- Number formatter ----------------------------------------------------------

const fmt = new Intl.NumberFormat("es-PE");
function fmtNum(n: number)    { return fmt.format(n); }
function fmtPct(n: number)    { return `${n.toFixed(1)}%`; }

// -- Time ago ------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `Hace ${diff}s`;
  if (diff < 3600)  return `Hace ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return `Hace ${Math.floor(diff / 86400)}d`;
}

// -- Quick links ---------------------------------------------------------------

const QUICK_LINKS_BASE = [
  { label: "Campañas",    href: "/dashboard/campanas",    icon: Megaphone, color: "text-[#2563EB]",  bg: "bg-[rgba(37,99,235,0.12)]"  },
  { label: "Smart Inbox", href: "/dashboard/smart-inbox", icon: Inbox,     color: "text-[#06B6D4]",  bg: "bg-[rgba(6,182,212,0.12)]"  },
  { label: "CRM",         href: "/dashboard/crm",         icon: Columns3,  color: "text-[#2563EB]",  bg: "bg-[rgba(37,99,235,0.10)]"  },
  { label: "Analítica",   href: "/dashboard/analytics",   icon: BarChart3, color: "text-[#10B981]",  bg: "bg-[rgba(16,185,129,0.12)]" },
  { label: "Agentes IA",  href: "/dashboard/agentes-ia",  icon: Bot,       color: "text-[#06B6D4]",  bg: "bg-[rgba(6,182,212,0.12)]"  },
];

// -- Skeleton ------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[var(--border)] ${className ?? ""}`} />;
}

function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-3 w-28 mb-3" />
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-2.5 w-24" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
      </div>
    </div>
  );
}

// -- KPI Card ------------------------------------------------------------------

function KpiCard({ label, value, icon: Icon, color, bg, sublabel }: {
  label: string; value: string; icon: React.ElementType;
  color: string; bg: string; sublabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--foreground-muted)]">{label}</p>
          <p className="mt-2 text-3xl font-black tabular-nums tracking-tight text-[var(--foreground)]">{value}</p>
          {sublabel && <p className="mt-0.5 text-[11px] text-[var(--foreground-faint)]">{sublabel}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

// -- Activity Chart (pure SVG bar chart, no external lib needed) ---------------

function ActivityChart({ data }: { data: ActivityPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-[var(--foreground-muted)]">
        Sin datos de actividad aún
      </div>
    );
  }

  const maxVal = Math.max(...data.flatMap((d) => [d.connects, d.messages]), 1);
  const barW   = 14;
  const gap    = 6;
  const groupW = barW * 2 + gap + 8;
  const chartH = 160;
  const padL   = 32;
  const padB   = 28;
  const totalW = padL + data.length * groupW;

  const labelEvery = data.length > 10 ? 2 : 1;

  return (
    <div className="overflow-x-auto">
      <svg width={totalW} height={chartH + padB} className="min-w-full">
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = chartH - pct * chartH;
          const val = Math.round(pct * maxVal);
          return (
            <g key={pct}>
              <line x1={padL} y1={y} x2={totalW} y2={y} stroke="rgba(45,63,85,0.8)" strokeWidth={1} />
              <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#94A3B8">{val}</text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = padL + i * groupW;
          const hC = (d.connects / maxVal) * chartH;
          const hM = (d.messages / maxVal) * chartH;
          return (
            <g key={d.date}>
              {/* Connects bar (cobalt) */}
              <rect
                x={x}
                y={chartH - hC}
                width={barW}
                height={hC}
                rx={3}
                fill="#2563EB"
                opacity={0.85}
              >
                <title>{d.connects} conexiones</title>
              </rect>
              {/* Messages bar (emerald) */}
              <rect
                x={x + barW + gap}
                y={chartH - hM}
                width={barW}
                height={hM}
                rx={3}
                fill="#10B981"
                opacity={0.85}
              >
                <title>{d.messages} mensajes</title>
              </rect>
              {/* X label */}
              {i % labelEvery === 0 && (
                <text
                  x={x + barW}
                  y={chartH + padB - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#94A3B8"
                >
                  {d.date}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4 text-[10px] text-[var(--foreground-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#2563EB]" />
          Conexiones
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          Mensajes
        </span>
      </div>
    </div>
  );
}

// -- Pipeline Funnel -----------------------------------------------------------

const FUNNEL_COLORS: Record<string, string> = {
  extraido:          "bg-[var(--border)]",
  conexion_enviada:  "bg-[#2563EB]",
  conexion_aceptada: "bg-[#2563EB]",
  en_conversacion:   "bg-[#06B6D4]",
  reunion_agendada:  "bg-[#F59E0B]",
  cliente:           "bg-[#10B981]",
};

function PipelineFunnel({ stages }: { stages: FunnelStage[] }) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const widthPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
        const barColor = FUNNEL_COLORS[stage.key] ?? "bg-[var(--border)]";
        const isLast   = i === stages.length - 1;

        return (
          <div key={stage.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-[var(--foreground-muted)]">{stage.label}</span>
              <div className="flex items-center gap-2">
                {i > 0 && stage.convRate < 100 && (
                  <span className="text-[10px] text-[var(--foreground-faint)]">{fmtPct(stage.convRate)} conv.</span>
                )}
                <span className="text-xs font-bold tabular-nums text-[var(--foreground)]">{fmtNum(stage.count)}</span>
              </div>
            </div>
            <div className="h-5 w-full rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${Math.max(widthPct, stage.count > 0 ? 4 : 0)}%` }}
              />
            </div>
            {!isLast && (
              <div className="ml-auto mr-4 mt-0.5 h-3 w-px bg-[var(--border)]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// -- Activity Feed -------------------------------------------------------------

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  connect:             { icon: Link2,         color: "text-[#2563EB]", bg: "bg-[rgba(37,99,235,0.12)]"  },
  connection_request:  { icon: Link2,         color: "text-[#2563EB]", bg: "bg-[rgba(37,99,235,0.12)]"  },
  message:             { icon: MessageSquare, color: "text-[#F59E0B]", bg: "bg-[rgba(245,158,11,0.12)]" },
  check_connection:    { icon: UserCheck,     color: "text-[#06B6D4]", bg: "bg-[rgba(6,182,212,0.12)]"  },
  view_profile:        { icon: Eye,           color: "text-[var(--foreground-muted)]", bg: "bg-[var(--surface)]" },
  like:                { icon: Heart,         color: "text-[#EF4444]", bg: "bg-[rgba(239,68,68,0.12)]"  },
  message_sent:        { icon: MessageSquare, color: "text-[#2563EB]", bg: "bg-[rgba(37,99,235,0.12)]"  },
  connection_sent:     { icon: Link2,         color: "text-[#2563EB]", bg: "bg-[rgba(37,99,235,0.12)]"  },
  connection_accepted: { icon: UserCheck,     color: "text-[#10B981]", bg: "bg-[rgba(16,185,129,0.12)]" },
  meeting_booked:      { icon: CalendarCheck, color: "text-[#10B981]", bg: "bg-[rgba(16,185,129,0.12)]" },
  ai_reply:            { icon: Bot,           color: "text-[#06B6D4]", bg: "bg-[rgba(6,182,212,0.12)]"  },
  lead_created:        { icon: Users,         color: "text-[#2563EB]", bg: "bg-[rgba(37,99,235,0.12)]"  },
  campaign_started:    { icon: Megaphone,     color: "text-[#F59E0B]", bg: "bg-[rgba(245,158,11,0.12)]" },
};

const FALLBACK_ICON = { icon: Zap, color: "text-[var(--foreground-muted)]", bg: "bg-[var(--surface)]" };

function ActivityItem({ row }: { row: ActivityFeedRow }) {
  const cfg  = ACTIVITY_ICONS[row.action_type] ?? FALLBACK_ICON;
  const Icon = cfg.icon;
  const desc = row.description ?? row.action_type.replace(/_/g, " ");
  const who  = row.lead_name ? ` · ${row.lead_name}` : "";

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--border)] last:border-0 px-5 hover:bg-[rgba(255,255,255,0.03)] transition-colors">
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--foreground)] leading-snug truncate">{desc}{who}</p>
        <p className="text-[10px] text-[var(--foreground-faint)] mt-0.5">{timeAgo(row.created_at)}</p>
      </div>
    </div>
  );
}

function ActivityFeed({ items }: { items: ActivityFeedRow[] }) {
  if (items.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <Activity className="mx-auto mb-2 h-7 w-7 text-[var(--border)]" />
        <p className="text-sm font-medium text-[var(--foreground-muted)]">Sin actividad aún</p>
        <p className="text-[11px] text-[var(--foreground-faint)] mt-1">Las acciones del Ghost Engine aparecerán aquí</p>
      </div>
    );
  }
  return (
    <div>
      {items.map((item) => <ActivityItem key={item.id} row={item} />)}
    </div>
  );
}

// -- Ghost Engine Panel --------------------------------------------------------

function GhostEnginePanel({ initial, feed }: { initial: DashboardMetrics["engine"]; feed?: ActivityFeedRow[] }) {
  const [session, setSession] = useState<GhostEngineSession>(initial);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("ghost-engine-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ghost_engine_sessions" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (!row) return;
          const lastBeat = row.last_heartbeat_at
            ? new Date(row.last_heartbeat_at as string).getTime()
            : 0;
          const stale = Date.now() - lastBeat > 2 * 60_000;
          setSession({
            status:            stale ? "stopped" : ((row.status as GhostEngineSession["status"]) ?? "stopped"),
            connections_sent:  (row.connections_sent as number)  ?? 0,
            messages_sent:     (row.messages_sent    as number)  ?? 0,
            actions_count:     (row.actions_count    as number)  ?? 0,
            last_heartbeat_at: (row.last_heartbeat_at as string) ?? null,
            metadata:          (row.metadata as Record<string, unknown>) ?? {},
          });
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      getGhostEngineStatus().then((res) => {
        if (res.success && res.data) setSession(res.data);
      });
    }, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const isRunning = session.status === "running";
  const wasAutoPaused = !isRunning && (feed ?? []).some((f) => f.action_type === "engine_auto_paused");
  const meta = session.metadata as {
    connections_today?: number;
    messages_today?: number;
    likes_today?: number;
  };

  return (
    <div className={`rounded-2xl border-2 p-5 transition-all duration-500 ${
      isRunning
        ? "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.05)]"
        : "border-[var(--border)] bg-[var(--surface)]"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            isRunning ? "bg-[rgba(16,185,129,0.15)]" : "bg-[var(--border)]"
          }`}>
            <Zap className={`h-5 w-5 ${isRunning ? "text-[#10B981]" : "text-[var(--foreground-faint)]"}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-[var(--foreground)]">Ghost Engine</p>
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isRunning
                  ? "bg-[rgba(16,185,129,0.15)] text-[#10B981]"
                  : "bg-[var(--border)] text-[var(--foreground-muted)]"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  isRunning ? "bg-[#10B981] animate-pulse" : "bg-[var(--foreground-faint)]"
                }`} />
                {isRunning ? "Motor activo" : "Motor no conectado"}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-[var(--foreground-muted)]">
              {isRunning
                ? `${fmtNum(meta.connections_today ?? session.connections_sent)} conexiones · ${fmtNum(meta.messages_today ?? session.messages_sent)} mensajes hoy`
                : "Activa el Ghost Engine en la extensión de Chrome"}
            </p>
            {wasAutoPaused && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-3 py-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400" />
                <p className="text-xs text-red-400">
                  Engine pausado automáticamente por errores de selector.
                  <Link href="/dashboard/configuracion/selectores" className="ml-1 font-semibold underline">
                    Revisar selectores →
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
        {isRunning && (
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-xl bg-[rgba(16,185,129,0.15)] px-3 py-1 text-[11px] font-bold text-[#10B981]">En línea</span>
            {session.last_heartbeat_at && (
              <span className="text-[10px] text-[var(--foreground-faint)]" suppressHydrationWarning>
                Última señal: {timeAgo(session.last_heartbeat_at)}
              </span>
            )}
          </div>
        )}
      </div>

      {isRunning && (
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[rgba(16,185,129,0.2)] pt-4">
          <div className="text-center">
            <p className="text-lg font-black text-[var(--foreground)]">{fmtNum(meta.connections_today ?? session.connections_sent)}</p>
            <p className="text-[10px] text-[var(--foreground-muted)]">Conexiones hoy</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-[var(--foreground)]">{fmtNum(meta.messages_today ?? session.messages_sent)}</p>
            <p className="text-[10px] text-[var(--foreground-muted)]">Mensajes hoy</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-[var(--foreground)]">{fmtNum(meta.likes_today ?? 0)}</p>
            <p className="text-[10px] text-[var(--foreground-muted)]">Likes hoy</p>
          </div>
        </div>
      )}
    </div>
  );
}

// -- Props ---------------------------------------------------------------------

interface DashboardViewProps {
  metrics: DashboardMetrics | null;
}

// -- Main View -----------------------------------------------------------------

export function DashboardView({ metrics }: DashboardViewProps) {
  const now  = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  const [liveMetrics, setLiveMetrics] = useState<DashboardMetrics | null>(metrics);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => { setLiveMetrics(metrics); }, [metrics]);

  async function refreshMetrics() {
    try {
      const result = await getDashboardMetrics();
      if (result.success && result.data) {
        setLiveMetrics(result.data);
        setLastRefresh(new Date());
      }
    } catch { /* silencioso */ }
  }

  async function refreshEngine() {
    try {
      const result = await getGhostEngineStatus();
      if (result.success && result.data) {
        // Engine panel manages its own state via Supabase realtime
        void result;
      }
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    refreshEngine();
    const metricsInterval = setInterval(refreshMetrics, 60_000);
    const engineInterval  = setInterval(refreshEngine,  15_000);
    return () => {
      clearInterval(metricsInterval);
      clearInterval(engineInterval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCampaignCount = liveMetrics?.recentCampaigns.filter((c) => c.status === "active" || c.status === "running").length ?? 0;

  const QUICK_LINKS = QUICK_LINKS_BASE.map((link) => ({
    ...link,
    desc: link.label === "Campañas"    ? `${activeCampaignCount} activas`
        : link.label === "CRM"         ? `${fmtNum(liveMetrics?.leadsCount ?? 0)} leads`
        : link.label === "Smart Inbox" ? `${fmtNum(liveMetrics?.kpis.inConversation ?? 0)} activas`
        : link.label === "Agentes IA"  ? "Ver agentes"
        : "Ver KPIs",
  }));

  // Skeleton while no data
  if (!liveMetrics) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
          <div>
            <Skeleton className="h-5 w-36 mb-1" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
        <div className="flex-1 overflow-y-auto bg-[var(--background)] p-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => <KpiSkeleton key={i} />)}
          </div>
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const { kpis, activityChart, funnel, feed, engine, recentCampaigns } = liveMetrics;

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--foreground)]">{greeting} 👋</h1>
          <p className="text-xs text-[var(--foreground-muted)]">
            {now.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--foreground-muted)]" suppressHydrationWarning>
            <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span>Actualizado {timeAgo(lastRefresh.toISOString())}</span>
          </div>
          <button
            onClick={() => { void refreshMetrics(); void refreshEngine(); }}
            className="rounded-lg p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)] transition-colors"
            title="Actualizar ahora"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <Link
            href="/dashboard/campanas"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(37,99,235,0.35)] hover:opacity-90 transition-opacity"
          >
            <Megaphone className="h-4 w-4" />
            Nueva campaña
          </Link>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto bg-[var(--background)] p-6 space-y-6">

        {/* -- KPI Cards ------------------------------------------------------- */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Conexiones enviadas hoy"
            icon={Link2}
            color="text-[#2563EB]"
            bg="bg-[rgba(37,99,235,0.12)]"
            value={fmtNum(kpis.connectsToday)}
            sublabel="Hoy vía Ghost Engine"
          />
          <KpiCard
            label="Tasa de aceptación"
            icon={UserCheck}
            color="text-[#10B981]"
            bg="bg-[rgba(16,185,129,0.12)]"
            value={fmtPct(kpis.acceptanceRate)}
            sublabel="Del total de solicitudes enviadas"
          />
          <KpiCard
            label="Mensajes enviados hoy"
            icon={MessageSquare}
            color="text-[#F59E0B]"
            bg="bg-[rgba(245,158,11,0.12)]"
            value={fmtNum(kpis.messagesToday)}
            sublabel="Hoy vía Ghost Engine"
          />
          <KpiCard
            label="En conversación"
            icon={TrendingUp}
            color="text-[#06B6D4]"
            bg="bg-[rgba(6,182,212,0.12)]"
            value={fmtNum(kpis.inConversation)}
            sublabel="Leads respondiendo actualmente"
          />
        </div>

        {/* -- Ghost Engine ---------------------------------------------------- */}
        <GhostEnginePanel initial={engine} feed={feed} />

        {/* -- Activity Chart -------------------------------------------------- */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[var(--foreground)]">Actividad — últimos 14 días</h2>
              <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">Conexiones y mensajes enviados por Ghost Engine</p>
            </div>
            <Link
              href="/dashboard/analytics"
              className="flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline"
            >
              Ver analítica completa <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ActivityChart data={activityChart} />
        </div>

        {/* -- Two-column layout ----------------------------------------------- */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

          {/* Left: Activity feed */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--foreground-muted)]" />
                <h2 className="text-sm font-bold text-[var(--foreground)]">Actividad reciente</h2>
              </div>
              <Link href="/dashboard/analytics" className="flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline">
                Ver todo <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ActivityFeed items={feed} />
          </div>

          {/* Right column */}
          <div className="space-y-6">

            {/* Pipeline funnel */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                <h2 className="text-sm font-bold text-[var(--foreground)]">Pipeline de leads</h2>
                <Link href="/dashboard/crm" className="text-xs font-medium text-[#2563EB] hover:underline">
                  Ver CRM
                </Link>
              </div>
              <div className="px-5 py-4">
                <PipelineFunnel stages={funnel} />
              </div>
            </div>

            {/* Quick access */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[var(--border)] px-5 py-4">
                <h2 className="text-sm font-bold text-[var(--foreground)]">Accesos rápidos</h2>
              </div>
              <div className="p-3 space-y-1">
                {QUICK_LINKS.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.href} href={link.href}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                    >
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${link.bg}`}>
                        <Icon className={`h-4 w-4 ${link.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{link.label}</p>
                        <p className="text-[11px] text-[var(--foreground-muted)]">{link.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[var(--foreground-faint)]" />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Recent campaigns */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                <h2 className="text-sm font-bold text-[var(--foreground)]">Campañas recientes</h2>
                <Link href="/dashboard/campanas" className="text-xs font-medium text-[#2563EB] hover:underline">
                  Ver todas
                </Link>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {recentCampaigns.length === 0 ? (
                  <div className="px-5 py-6 text-center text-[12px] text-[var(--foreground-muted)]">
                    Sin campañas aún —{" "}
                    <Link href="/dashboard/campanas" className="text-[#2563EB] hover:underline">crear primera</Link>
                  </div>
                ) : (
                  recentCampaigns.map((camp) => (
                    <div key={camp.name} className="px-5 py-3.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-[var(--foreground)] truncate max-w-[160px]">{camp.name}</p>
                        <span className={[
                          "rounded-full px-2 py-0.5 text-[9px] font-bold",
                          camp.status === "active"  ? "bg-[rgba(16,185,129,0.15)] text-[#10B981]"
                          : camp.status === "paused" ? "bg-[rgba(245,158,11,0.15)] text-[#F59E0B]"
                          : camp.status === "done"   ? "bg-[rgba(37,99,235,0.15)] text-[#2563EB]"
                          : "bg-[var(--border)] text-[var(--foreground-muted)]",
                        ].join(" ")}>
                          {camp.status === "active"  ? "Activa"
                          : camp.status === "paused" ? "Pausada"
                          : camp.status === "done"   ? "Completada"
                          : "Borrador"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--foreground-muted)]">
                        {fmtNum(camp.total_leads ?? 0)} leads · <span className="capitalize">{camp.type ?? "linkedin"}</span>
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
