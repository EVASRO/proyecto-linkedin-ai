"use client";

import { useState } from "react";
import {
  AlertTriangle, ArrowRight, BarChart3, CalendarCheck,
  CheckCircle2, ChevronDown, Filter, FlaskConical, MessageSquareText,
  TrendingDown, TrendingUp, UserCheck, Users, Zap,
} from "lucide-react";
import { useDemoMode } from "@/components/providers/demo-mode-provider";

// ── Types ─────────────────────────────────────────────────────────────────────

type DateRange = "7d" | "30d" | "3m" | "6m";
type FilterCampaign = "all" | string;

// ── Base data (30d baseline) ──────────────────────────────────────────────────

const BASE_CAMPAIGNS = [
  { name: "SDR Fintech LATAM",  status: "active", leads: 234, accepted: 72, replied: 41, meetings: 8,  rate: 22 },
  { name: "Reclutamiento Tech", status: "active", leads: 189, accepted: 51, replied: 29, meetings: 5,  rate: 15 },
  { name: "SaaS CEO Outreach",  status: "paused", leads: 98,  accepted: 22, replied: 11, meetings: 2,  rate: 11 },
  { name: "Consultoría Latam",  status: "draft",  leads: 45,  accepted: 10, replied: 6,  meetings: 1,  rate: 13 },
];

const BASE_FUNNEL = [
  { label: "Leads extraídos",      value: 566, color: "from-blue-500 to-blue-400",    pct: 100 },
  { label: "Solicitudes enviadas", value: 421, color: "from-indigo-500 to-indigo-400", pct: 74  },
  { label: "Conexiones aceptadas", value: 155, color: "from-violet-500 to-purple-400", pct: 27  },
  { label: "Respondieron",         value: 87,  color: "from-pink-500 to-rose-400",     pct: 15  },
  { label: "Demo / Reunión",       value: 16,  color: "from-green-500 to-emerald-400", pct: 3   },
];

const BASE_WEEKLY = [
  { day: "Lun", conns: 12, msgs: 8,  meetings: 1 },
  { day: "Mar", conns: 18, msgs: 14, meetings: 2 },
  { day: "Mié", conns: 9,  msgs: 11, meetings: 3 },
  { day: "Jue", conns: 22, msgs: 16, meetings: 1 },
  { day: "Vie", conns: 15, msgs: 9,  meetings: 2 },
  { day: "Sáb", conns: 3,  msgs: 2,  meetings: 0 },
  { day: "Dom", conns: 1,  msgs: 1,  meetings: 0 },
];

// Factores de escala + deltas por período
const RANGE_CONFIG: Record<DateRange, {
  scale: number;
  deltas: { leads: string; posL: boolean; accepted: string; posA: boolean; replied: string; posR: boolean; meetings: string; posM: boolean };
}> = {
  "7d":  { scale: 0.18, deltas: { leads: "+4%",  posL: true,  accepted: "+1%",  posA: true,  replied: "-1%", posR: false, meetings: "+1",  posM: true  } },
  "30d": { scale: 1,    deltas: { leads: "+18%", posL: true,  accepted: "+5%",  posA: true,  replied: "-2%", posR: false, meetings: "+3",  posM: true  } },
  "3m":  { scale: 2.8,  deltas: { leads: "+31%", posL: true,  accepted: "+9%",  posA: true,  replied: "+6%", posR: true,  meetings: "+11", posM: true  } },
  "6m":  { scale: 5.2,  deltas: { leads: "+58%", posL: true,  accepted: "+12%", posA: true,  replied: "+9%", posR: true,  meetings: "+24", posM: true  } },
};

function buildDataset(scale: number) {
  const s = (v: number) => Math.round(v * scale);
  const campaigns = BASE_CAMPAIGNS.map((c) => ({
    ...c,
    leads:    s(c.leads),
    accepted: s(c.accepted),
    replied:  s(c.replied),
    meetings: s(c.meetings),
  }));
  const funnel = BASE_FUNNEL.map((f) => ({ ...f, value: s(f.value) }));
  if (funnel[0].value > 0) {
    funnel.forEach((f, i) => { if (i > 0) f.pct = Math.round((f.value / funnel[0].value) * 100); });
  }
  const weekly = BASE_WEEKLY.map((d) => ({
    ...d,
    conns:    Math.max(0, s(d.conns)),
    msgs:     Math.max(0, s(d.msgs)),
    meetings: Math.max(0, s(d.meetings)),
  }));
  return { campaigns, funnel, weekly };
}

const HEALTH_WARNINGS = [
  { lead: "juan.perez@empresa.com",  campaigns: ["SDR Fintech LATAM", "SaaS CEO Outreach"], severity: "high"   },
  { lead: "maria.torres@fintech.pe", campaigns: ["Reclutamiento Tech", "SDR Fintech LATAM"], severity: "medium" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, delta, icon: Icon, color, bg, sublabel }: {
  label: string; value: string; delta?: { val: string; positive: boolean };
  icon: React.ElementType; color: string; bg: string; sublabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
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
      {delta && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-semibold ${delta.positive ? "text-green-600" : "text-red-500"}`}>
          {delta.positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {delta.val} vs. período anterior
        </div>
      )}
    </div>
  );
}

// ── MAIN VIEW ─────────────────────────────────────────────────────────────────

export function AnalyticsView() {
  const { demoMode } = useDemoMode();
  const [dateRange, setDateRange]     = useState<DateRange>("30d");
  const [campaign, setCampaign]       = useState<FilterCampaign>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [barMetric, setBarMetric]     = useState<"conns" | "msgs" | "meetings">("conns");
  const [resolvedWarnings, setResolvedWarnings] = useState<Set<number>>(new Set());
  const [resolving, setResolving]     = useState<number | null>(null);

  const DATE_OPTIONS: { id: DateRange; label: string }[] = [
    { id: "7d",  label: "7 días"   },
    { id: "30d", label: "30 días"  },
    { id: "3m",  label: "3 meses"  },
    { id: "6m",  label: "6 meses"  },
  ];

  // En demo=true: datos escalados por período. En demo=false: vacío (datos reales pendientes de integración directa con Supabase)
  const cfg = RANGE_CONFIG[dateRange];
  const { campaigns, funnel, weekly } = demoMode
    ? buildDataset(cfg.scale)
    : { campaigns: [], funnel: BASE_FUNNEL.map((f) => ({ ...f, value: 0, pct: 0 })), weekly: BASE_WEEKLY.map((d) => ({ ...d, conns: 0, msgs: 0, meetings: 0 })) };

  const maxBar = Math.max(...weekly.map((d) => d.conns + d.msgs), 1);

  const filteredCampaigns = campaign === "all"
    ? campaigns
    : campaigns.filter((c) => c.name === campaign);

  const totals = filteredCampaigns.reduce(
    (acc, c) => ({
      leads:    acc.leads    + c.leads,
      accepted: acc.accepted + c.accepted,
      replied:  acc.replied  + c.replied,
      meetings: acc.meetings + c.meetings,
    }),
    { leads: 0, accepted: 0, replied: 0, meetings: 0 }
  );

  const acceptanceRate = totals.leads > 0 ? Math.round((totals.accepted / totals.leads) * 100) : 0;
  const replyRate      = totals.leads > 0 ? Math.round((totals.replied  / totals.leads) * 100) : 0;
  const meetingRate    = totals.leads > 0 ? Math.round((totals.meetings / totals.leads) * 100) : 0;

  const activeWarnings = demoMode ? HEALTH_WARNINGS.filter((_, i) => !resolvedWarnings.has(i)) : [];

  async function resolveConflict(idx: number) {
    setResolving(idx);
    await new Promise((r) => setTimeout(r, 1200));
    setResolvedWarnings((prev) => new Set([...prev, idx]));
    setResolving(null);
  }

  const dateLabel = { "7d": "Últimos 7 días", "30d": "Últimos 30 días", "3m": "Últimos 3 meses", "6m": "Últimos 6 meses" }[dateRange];

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Banner indicador de modo */}
      <div className={[
        "flex flex-shrink-0 items-center gap-2 border-b px-6 py-2",
        demoMode ? "border-amber-200 bg-amber-50" : "border-blue-100 bg-blue-50",
      ].join(" ")}>
        <FlaskConical className={`h-3.5 w-3.5 ${demoMode ? "text-amber-500" : "text-blue-500"}`} />
        <p className={`text-xs font-medium ${demoMode ? "text-amber-700" : "text-blue-700"}`}>
          {demoMode
            ? <>Modo Demo — Datos de ejemplo. <a href="/dashboard/configuracion" className="underline font-semibold">Ir a Configuración</a> para datos reales.</>
            : <>Datos Reales — Las métricas se calcularán a medida que el Ghost Engine ejecute acciones.</>}
        </p>
      </div>

      {/* Header */}
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Analítica</h1>
          <p className="text-xs text-zinc-400">KPIs de prospección, embudo de conversión y rendimiento por campaña</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range */}
          <div className="flex items-center gap-0.5 rounded-xl border border-zinc-200 bg-white p-1">
            {DATE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setDateRange(opt.id)}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  dateRange === opt.id ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Campaign filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <Filter className="h-3.5 w-3.5" />
              {campaign === "all" ? "Todas las campañas" : campaign.slice(0, 20)}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
            {showFilters && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
                  {["all", ...campaigns.map((c) => c.name)].map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCampaign(c); setShowFilters(false); }}
                      className={[
                        "flex w-full items-center gap-2 px-4 py-2.5 text-xs text-left transition-colors",
                        campaign === c ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-zinc-600 hover:bg-zinc-50",
                      ].join(" ")}
                    >
                      {campaign === c && <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />}
                      {c === "all" ? "Todas las campañas" : c}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6 space-y-6">

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Leads extraídos" value={totals.leads.toString()} sublabel={dateLabel}
            delta={{ val: cfg.deltas.leads, positive: cfg.deltas.posL }}
            icon={Users} color="text-blue-600" bg="bg-blue-50"
          />
          <KpiCard
            label="Tasa de aceptación" value={`${acceptanceRate}%`} sublabel={`${totals.accepted} conexiones`}
            delta={{ val: cfg.deltas.accepted, positive: cfg.deltas.posA }}
            icon={UserCheck} color="text-green-600" bg="bg-green-50"
          />
          <KpiCard
            label="Tasa de respuesta" value={`${replyRate}%`} sublabel={`${totals.replied} respondieron`}
            delta={{ val: cfg.deltas.replied, positive: cfg.deltas.posR }}
            icon={MessageSquareText} color="text-purple-600" bg="bg-purple-50"
          />
          <KpiCard
            label="Reuniones agendadas" value={totals.meetings.toString()} sublabel={`${meetingRate}% de cierre`}
            delta={{ val: cfg.deltas.meetings, positive: cfg.deltas.posM }}
            icon={CalendarCheck} color="text-orange-600" bg="bg-orange-50"
          />
        </div>

        {/* Two-col layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">

          {/* Left: Funnel + bar chart */}
          <div className="space-y-6">

            {/* Conversion funnel */}
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-zinc-400" />
                  <h2 className="text-sm font-bold text-zinc-900">Embudo de conversión</h2>
                </div>
                <span className="text-[11px] text-zinc-400">{dateLabel}</span>
              </div>

              <div className="space-y-2.5">
                {funnel.map((step, idx) => (
                  <div key={step.label}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-zinc-700">{step.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black tabular-nums text-zinc-900">{step.value.toLocaleString()}</span>
                        <span className="w-10 text-right text-xs font-bold text-zinc-400">{step.pct}%</span>
                      </div>
                    </div>
                    <div className="h-9 w-full overflow-hidden rounded-xl bg-zinc-100">
                      <div
                        className={`flex h-full items-center bg-gradient-to-r ${step.color} px-3 transition-all duration-500`}
                        style={{ width: `${step.pct}%`, minWidth: step.pct > 0 ? "60px" : "0" }}
                      >
                        <span className="text-[11px] font-bold text-white/90">{step.value.toLocaleString()}</span>
                      </div>
                    </div>
                    {idx < funnel.length - 1 && (
                      <div className="flex items-center gap-1.5 pl-7 mt-1">
                        <ArrowRight className="h-3 w-3 text-zinc-300" />
                        <span className="text-[10px] text-zinc-400">
                          {funnel[idx + 1].value > 0 && step.value > 0
                            ? `${Math.round((funnel[idx + 1].value / step.value) * 100)}% pasan a la siguiente etapa`
                            : "—"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Bar chart: activity */}
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-900">Actividad del período</h2>
                <div className="flex gap-1 rounded-xl border border-zinc-200 p-1">
                  {([
                    { id: "conns"    as const, label: "Conexiones" },
                    { id: "msgs"     as const, label: "Mensajes"   },
                    { id: "meetings" as const, label: "Reuniones"  },
                  ]).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setBarMetric(m.id)}
                      className={[
                        "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                        barMetric === m.id ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-700",
                      ].join(" ")}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-end gap-2 h-32">
                {weekly.map((d) => {
                  const val = d[barMetric];
                  const heightPct = maxBar > 0 ? (val / maxBar) * 100 : 0;
                  return (
                    <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-zinc-500">{val > 0 ? val : ""}</span>
                      <div className="w-full rounded-t-lg bg-zinc-100 overflow-hidden" style={{ height: "88px" }}>
                        <div
                          className={[
                            "w-full rounded-t-lg transition-all duration-300",
                            barMetric === "conns" ? "bg-blue-500" : barMetric === "msgs" ? "bg-purple-500" : "bg-green-500",
                          ].join(" ")}
                          style={{ height: `${heightPct}%`, marginTop: `${100 - heightPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400">{d.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Campaign table + health check */}
          <div className="space-y-6">

            {/* Campaign performance table */}
            <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
              <div className="border-b border-zinc-50 px-5 py-4">
                <h2 className="text-sm font-bold text-zinc-900">Rendimiento por campaña</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-50 bg-zinc-50/60">
                      {["Campaña", "Leads", "Acept.", "Resp.", "Reuniones"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wide text-zinc-400 text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {filteredCampaigns.map((camp) => (
                      <tr key={camp.name} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={[
                              "h-1.5 w-1.5 rounded-full flex-shrink-0",
                              camp.status === "active" ? "bg-green-500" :
                              camp.status === "paused" ? "bg-amber-400" : "bg-zinc-300",
                            ].join(" ")} />
                            <span className="font-medium text-zinc-700 truncate max-w-[100px]">{camp.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold tabular-nums text-zinc-900">{camp.leads}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-blue-600">{camp.accepted}</span>
                          <span className="ml-1 text-zinc-300">({camp.leads > 0 ? Math.round((camp.accepted / camp.leads) * 100) : 0}%)</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-purple-600">{camp.replied}</span>
                          <span className="ml-1 text-zinc-300">({camp.rate}%)</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-black text-green-600">{camp.meetings}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Health check */}
            <div className={[
              "rounded-2xl border p-5 shadow-sm",
              activeWarnings.length > 0 ? "border-amber-300 bg-amber-50/50" : "border-green-300 bg-green-50/50",
            ].join(" ")}>
              <div className="flex items-center gap-2 mb-4">
                {activeWarnings.length > 0
                  ? <AlertTriangle className="h-4 w-4 text-amber-500" />
                  : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                <h2 className="text-sm font-bold text-zinc-900">Health Check Anti-Spam</h2>
                {activeWarnings.length > 0 && (
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {activeWarnings.length} alertas
                  </span>
                )}
              </div>

              {activeWarnings.length === 0 ? (
                <p className="text-sm text-green-700 font-medium">Sin duplicados — ningún lead aparece en más de una campaña activa.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-[12px] text-amber-700">
                    Los siguientes leads están siendo contactados desde múltiples campañas simultáneamente:
                  </p>
                  {HEALTH_WARNINGS.map((w, i) => {
                    if (resolvedWarnings.has(i)) return null;
                    return (
                      <div
                        key={i}
                        className={[
                          "rounded-xl border p-3",
                          w.severity === "high" ? "border-red-200 bg-red-50/60" : "border-amber-200 bg-amber-50/60",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${w.severity === "high" ? "bg-red-500" : "bg-amber-400"}`} />
                            <div>
                              <p className="text-[12px] font-bold text-zinc-800">{w.lead}</p>
                              <p className="text-[11px] text-zinc-500">En campañas: {w.campaigns.join(" y ")}</p>
                              <p className="text-[11px] text-zinc-400 mt-0.5">
                                Acción: pausar en <span className="font-semibold">{w.campaigns[1]}</span> para evitar spam
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => resolveConflict(i)}
                            disabled={resolving === i}
                            className={[
                              "flex-shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all",
                              resolving === i
                                ? "bg-zinc-100 text-zinc-400 cursor-wait"
                                : "bg-amber-500 text-white hover:bg-amber-600",
                            ].join(" ")}
                          >
                            {resolving === i ? "Resolviendo…" : "Resolver"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => HEALTH_WARNINGS.forEach((_, i) => resolveConflict(i))}
                    disabled={resolving !== null}
                    className="mt-1 flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Resolver todos los conflictos
                  </button>
                </div>
              )}
            </div>

            {/* Avg impacts */}
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-zinc-900">Impactos promedio por contacto</h2>
              {[
                { label: "Conexión enviada",   value: 1.0, color: "bg-blue-400"   },
                { label: "Follow-up mensaje",  value: 2.3, color: "bg-indigo-400" },
                { label: "InMail alternativo", value: 0.8, color: "bg-violet-400" },
                { label: "Like / interacción", value: 1.5, color: "bg-pink-400"   },
              ].map(({ label, value, color }) => (
                <div key={label} className="mb-2">
                  <div className="mb-1 flex justify-between text-[12px]">
                    <span className="text-zinc-600">{label}</span>
                    <span className="font-bold tabular-nums text-zinc-900">{value.toFixed(1)}×</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / 3) * 100}%` }} />
                  </div>
                </div>
              ))}
              <p className="mt-3 text-[11px] text-zinc-400">
                Total promedio: <strong className="text-zinc-700">5.6 impactos</strong> por prospecto antes de obtener respuesta.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
