"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowRight, BarChart3, Bot,
  CalendarCheck, ChevronRight,
  Columns3, Inbox, Megaphone, MessageSquare,
  TrendingUp, Users, Zap,
} from "lucide-react";
import type { ActivityRow } from "@/app/dashboard/actions";

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

// ── Ghost Engine Panel — estado estático (requiere backend Python) ─────────────

function GhostEnginePanel() {
  return (
    <div className="rounded-2xl border-2 border-zinc-200 bg-zinc-50/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
            <Zap className="h-5 w-5 text-zinc-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-zinc-900">Ghost Engine</p>
              <span className="flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                Motor no conectado
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-zinc-400">
              Inicia el backend FastAPI para activar el Ghost Engine
            </p>
          </div>
        </div>
        <span
          title="Requiere backend Python activo"
          className="cursor-not-allowed rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-400"
        >
          Próximamente
        </span>
      </div>
    </div>
  );
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  message_sent:        { icon: MessageSquare, color: "text-indigo-600", bg: "bg-indigo-100" },
  connection_sent:     { icon: Users,         color: "text-blue-600",   bg: "bg-blue-100"   },
  connection_accepted: { icon: Users,         color: "text-blue-600",   bg: "bg-blue-100"   },
  meeting_booked:      { icon: Megaphone,     color: "text-green-600",  bg: "bg-green-100"  },
  ai_reply:            { icon: Bot,           color: "text-purple-600", bg: "bg-purple-100" },
  lead_created:        { icon: Users,         color: "text-sky-600",    bg: "bg-sky-100"    },
  campaign_started:    { icon: Megaphone,     color: "text-amber-600",  bg: "bg-amber-100"  },
  default:             { icon: Activity,      color: "text-zinc-500",   bg: "bg-zinc-100"   },
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `Hace ${diff}s`;
  if (diff < 3600)  return `Hace ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return `Hace ${Math.floor(diff / 86400)}d`;
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
    <div className="divide-y divide-zinc-50">
      {items.map((item) => {
        const meta = ACTION_META[item.action_type] ?? ACTION_META.default;
        const Icon = meta.icon;
        return (
          <div key={item.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-zinc-50/60 transition-colors">
            <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
              <Icon className={`h-4 w-4 ${meta.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-semibold text-zinc-900">
                  {item.metadata?.lead_name ?? item.action_type.replace(/_/g, " ")}
                </p>
                <span className="flex-shrink-0 text-[10px] tabular-nums text-zinc-400">{timeAgo(item.created_at)}</span>
              </div>
              {item.metadata?.company && <p className="text-[11px] text-zinc-500">{item.metadata.company}</p>}
              <p className="mt-0.5 text-[12px] text-zinc-600">{item.description ?? item.action_type.replace(/_/g, " ")}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  leadsCount: number;
  campaignsCount: number;
  activeLeads: number;
  recentActivity: ActivityRow[];
  recentCampaigns: { name: string; status: string; total_leads: number; type: string }[];
}

interface DashboardViewProps {
  initialData: DashboardData | null;
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function DashboardView({ initialData }: DashboardViewProps) {
  const [data] = useState<DashboardData>(
    initialData ?? {
      leadsCount: 0, campaignsCount: 0, activeLeads: 0,
      recentActivity: [], recentCampaigns: [],
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            label="Tasa de respuesta" icon={MessageSquare} color="text-purple-600" bg="bg-purple-50"
            value="—" sublabel="Disponible con más datos"
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
