"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowRight, BarChart3, Bot,
  CalendarCheck, ChevronRight,
  Columns3, Eye, Heart, Inbox, Link2, Megaphone, MessageSquare,
  TrendingUp, UserCheck, Users, Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { getGhostEngineStatus, type GhostEngineSession, type ActivityRow } from "@/app/dashboard/actions";

// ── Quick links ───────────────────────────────────────────────────────────────

const QUICK_LINKS_BASE = [
  { label: "Campañas",    href: "/dashboard/campanas",    icon: Megaphone, color: "text-amber-600",  bg: "bg-amber-50"  },
  { label: "Smart Inbox", href: "/dashboard/smart-inbox", icon: Inbox,     color: "text-blue-600",   bg: "bg-blue-50"   },
  { label: "CRM",         href: "/dashboard/crm",         icon: Columns3,  color: "text-indigo-600", bg: "bg-indigo-50" },
  { label: "Analítica",   href: "/dashboard/analytics",   icon: BarChart3, color: "text-green-600",  bg: "bg-green-50"  },
  { label: "Agentes IA",  href: "/dashboard/agentes-ia",  icon: Bot,       color: "text-purple-600", bg: "bg-purple-50" },
];

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color, bg, sublabel }: {
  label: string; value: string; icon: React.ElementType;
  color: string; bg: string; sublabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500">{label}</p>
          <p className="mt-2 text-3xl font-black tabular-nums tracking-tight text-zinc-900">{value}</p>
          {sublabel && <p className="mt-0.5 text-[11px] text-zinc-400">{sublabel}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

// ── Ghost Engine Panel ────────────────────────────────────────────────────────

function GhostEnginePanel() {
  const [session, setSession] = useState<GhostEngineSession>({
    status: 'stopped',
    connections_sent: 0,
    messages_sent: 0,
    actions_count: 0,
    last_heartbeat_at: null,
    metadata: {},
  });

  useEffect(() => {
    getGhostEngineStatus().then((res) => {
      if (res.success && res.data) setSession(res.data);
    });

    const supabase = createClient();
    const channel = supabase
      .channel('ghost-engine-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ghost_engine_sessions' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (!row) return;
          const lastBeat = row.last_heartbeat_at
            ? new Date(row.last_heartbeat_at as string).getTime()
            : 0;
          const stale = Date.now() - lastBeat > 2 * 60 * 1000;
          setSession({
            status:            stale ? 'stopped' : ((row.status as GhostEngineSession['status']) ?? 'stopped'),
            connections_sent:  (row.connections_sent as number) ?? 0,
            messages_sent:     (row.messages_sent    as number) ?? 0,
            actions_count:     (row.actions_count    as number) ?? 0,
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

  const isRunning = session.status === 'running';
  const meta = session.metadata as {
    connections_today?: number;
    messages_today?: number;
    likes_today?: number;
    next_task_at?: number;
  };

  return (
    <div className={`rounded-2xl border-2 p-5 transition-all duration-500 ${
      isRunning ? 'border-emerald-200 bg-emerald-50/40' : 'border-zinc-200 bg-zinc-50/60'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            isRunning ? 'bg-emerald-100' : 'bg-zinc-100'
          }`}>
            <Zap className={`h-5 w-5 ${isRunning ? 'text-emerald-600' : 'text-zinc-300'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-zinc-900">Ghost Engine</p>
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isRunning ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-500'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                }`} />
                {isRunning ? 'Motor activo' : 'Motor no conectado'}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-zinc-400">
              {isRunning
                ? `${meta.connections_today ?? session.connections_sent} conexiones · ${meta.messages_today ?? session.messages_sent} mensajes hoy`
                : 'Activa el Ghost Engine en la extensión de Chrome'}
            </p>
          </div>
        </div>
        {isRunning && (
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-xl bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
              En línea
            </span>
            {session.last_heartbeat_at && (
              <span className="text-[10px] text-zinc-400">
                Última señal: {timeAgo(session.last_heartbeat_at)}
              </span>
            )}
          </div>
        )}
      </div>

      {isRunning && (
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-emerald-100 pt-4">
          <div className="text-center">
            <p className="text-lg font-black text-zinc-900">{meta.connections_today ?? session.connections_sent}</p>
            <p className="text-[10px] text-zinc-500">Conexiones hoy</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-zinc-900">{meta.messages_today ?? session.messages_sent}</p>
            <p className="text-[10px] text-zinc-500">Mensajes hoy</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-zinc-900">{meta.likes_today ?? 0}</p>
            <p className="text-[10px] text-zinc-500">Likes hoy</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  connect:             { icon: Link2,        color: "text-indigo-600", bg: "bg-indigo-50"  },
  message:             { icon: MessageSquare,color: "text-amber-600",  bg: "bg-amber-50"   },
  check_connection:    { icon: UserCheck,    color: "text-violet-600", bg: "bg-violet-50"  },
  view_profile:        { icon: Eye,          color: "text-zinc-500",   bg: "bg-zinc-100"   },
  like:                { icon: Heart,        color: "text-pink-500",   bg: "bg-pink-50"    },
  message_sent:        { icon: MessageSquare,color: "text-indigo-600", bg: "bg-indigo-50"  },
  connection_sent:     { icon: Link2,        color: "text-blue-600",   bg: "bg-blue-50"    },
  connection_accepted: { icon: UserCheck,    color: "text-green-600",  bg: "bg-green-50"   },
  meeting_booked:      { icon: CalendarCheck,color: "text-green-600",  bg: "bg-green-100"  },
  ai_reply:            { icon: Bot,          color: "text-purple-600", bg: "bg-purple-50"  },
  lead_created:        { icon: Users,        color: "text-sky-600",    bg: "bg-sky-50"     },
  campaign_started:    { icon: Megaphone,    color: "text-amber-600",  bg: "bg-amber-50"   },
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `Hace ${diff}s`;
  if (diff < 3600)  return `Hace ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return `Hace ${Math.floor(diff / 86400)}d`;
}

function ActivityItem({ row }: { row: ActivityRow }) {
  const cfg = ACTIVITY_ICONS[row.action_type] ?? { icon: Zap, color: "text-zinc-400", bg: "bg-zinc-50" };
  const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-zinc-50 last:border-0 px-5 hover:bg-zinc-50/60 transition-colors">
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-700 leading-snug truncate">
          {row.description ?? row.action_type.replace(/_/g, " ")}
        </p>
        <p className="text-[10px] text-zinc-400 mt-0.5">{timeAgo(row.created_at)}</p>
      </div>
    </div>
  );
}

function ActivityFeed({ items }: { items: ActivityRow[] }) {
  if (items.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <Activity className="mx-auto mb-2 h-7 w-7 text-zinc-200" />
        <p className="text-sm font-medium text-zinc-400">Sin actividad aún</p>
        <p className="text-[11px] text-zinc-300 mt-1">Las acciones del Ghost Engine aparecerán aquí</p>
      </div>
    );
  }
  return (
    <div>
      {items.map((item) => <ActivityItem key={item.id} row={item} />)}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  leadsCount: number;
  campaignsCount: number;
  activeLeads: number;
  connEstasSemana: number;
  tasaAceptacion: number;
  enConversacion: number;
  recentActivity: ActivityRow[];
  recentCampaigns: { name: string; status: string; total_leads: number; type: string }[];
  engineSession: Record<string, unknown> | null;
}

interface DashboardViewProps {
  initialData: DashboardData | null;
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function DashboardView({ initialData }: DashboardViewProps) {
  const [data] = useState<DashboardData>(
    initialData ?? {
      leadsCount: 0, campaignsCount: 0, activeLeads: 0,
      connEstasSemana: 0, tasaAceptacion: 0, enConversacion: 0,
      recentActivity: [], recentCampaigns: [], engineSession: null,
    }
  );

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  const activeCampaignCount = data.recentCampaigns.filter((c) => c.status === "active").length;

  const QUICK_LINKS = QUICK_LINKS_BASE.map((link) => ({
    ...link,
    desc: link.label === "Campañas"    ? `${activeCampaignCount} activas`
        : link.label === "CRM"         ? `${data.leadsCount} leads`
        : link.label === "Smart Inbox" ? `${data.activeLeads} conversaciones activas`
        : link.label === "Agentes IA"  ? "Ver agentes"
        : "Ver KPIs",
  }));

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">{greeting} 👋</h1>
          <p className="text-xs text-zinc-400">
            {now.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Link
          href="/dashboard/campanas"
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700"
        >
          <Megaphone className="h-4 w-4" />
          Nueva campaña
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6 space-y-6">

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <KpiCard
            label="Leads en CRM" icon={Users} color="text-blue-600" bg="bg-blue-50"
            value={String(data.leadsCount)} sublabel="En pipeline CRM"
          />
          <KpiCard
            label="Campañas creadas" icon={Megaphone} color="text-amber-600" bg="bg-amber-50"
            value={String(data.campaignsCount)} sublabel={`${activeCampaignCount} activas`}
          />
          <KpiCard
            label="Leads activos" icon={TrendingUp} color="text-green-600" bg="bg-green-50"
            value={String(data.activeLeads)} sublabel="Contactados o respondieron"
          />
          <KpiCard
            label="Reuniones agendadas" icon={CalendarCheck} color="text-orange-600" bg="bg-orange-50"
            value="—" sublabel="Ver en analítica"
          />
          <KpiCard
            label="Conexiones esta semana" icon={Link2} color="text-indigo-600" bg="bg-indigo-50"
            value={String(data.connEstasSemana)} sublabel={`${data.tasaAceptacion}% tasa de aceptación`}
          />
          <KpiCard
            label="En conversación" icon={MessageSquare} color="text-amber-600" bg="bg-amber-50"
            value={String(data.enConversacion)} sublabel="Esperando respuesta"
          />
        </div>

        {/* Ghost Engine */}
        <GhostEnginePanel />

        {/* Two-col layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

          {/* Activity feed */}
          <div className="rounded-2xl border border-border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-50 px-5 py-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-zinc-400" />
                <h2 className="text-sm font-bold text-zinc-900">Actividad reciente</h2>
              </div>
              <Link href="/dashboard/analytics" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
                Ver todo <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ActivityFeed items={data.recentActivity} />
          </div>

          {/* Right column */}
          <div className="space-y-6">

            {/* Quick access */}
            <div className="rounded-2xl border border-border bg-white shadow-sm">
              <div className="border-b border-zinc-50 px-5 py-4">
                <h2 className="text-sm font-bold text-zinc-900">Accesos rápidos</h2>
              </div>
              <div className="p-3 space-y-1">
                {QUICK_LINKS.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.href} href={link.href}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-zinc-50"
                    >
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${link.bg}`}>
                        <Icon className={`h-4 w-4 ${link.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-800">{link.label}</p>
                        <p className="text-[11px] text-zinc-400">{link.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-300" />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Recent campaigns */}
            <div className="rounded-2xl border border-border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-50 px-5 py-4">
                <h2 className="text-sm font-bold text-zinc-900">Campañas</h2>
                <Link href="/dashboard/campanas" className="text-xs font-medium text-indigo-600 hover:underline">
                  Ver todas
                </Link>
              </div>
              <div className="divide-y divide-zinc-50">
                {data.recentCampaigns.length === 0 ? (
                  <div className="px-5 py-6 text-center text-[12px] text-zinc-400">
                    Sin campañas aún —{" "}
                    <Link href="/dashboard/campanas" className="text-indigo-500 hover:underline">crear primera</Link>
                  </div>
                ) : (
                  data.recentCampaigns.map((camp) => (
                    <div key={camp.name} className="px-5 py-3.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-zinc-800 truncate max-w-[160px]">{camp.name}</p>
                        <span className={[
                          "rounded-full px-2 py-0.5 text-[9px] font-bold",
                          camp.status === "active" ? "bg-green-100 text-green-700"
                            : camp.status === "draft" ? "bg-zinc-100 text-zinc-500"
                            : "bg-amber-100 text-amber-700",
                        ].join(" ")}>
                          {camp.status === "active" ? "Activa" : camp.status === "draft" ? "Borrador" : "Pausada"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {camp.total_leads ?? 0} leads · <span className="capitalize">{camp.type ?? "linkedin"}</span>
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
