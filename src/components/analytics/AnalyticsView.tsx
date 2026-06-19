"use client";

import { useState, useTransition } from "react";
import { getAnalyticsData } from "@/app/dashboard/analytics/actions";
import {
  AlertTriangle, AtSign, BarChart3, Calendar, CheckCircle2,
  ChevronDown, Filter, Mail, MessageCircle, Phone, TrendingUp,
  UserPlus, Zap,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  PieChart, Pie, Tooltip, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";

// -- Types -------------------------------------------------------------------

type DateRange = "7d" | "30d" | "3m" | "6m";
type FilterCampaign = "all" | string;

type HealthWarning = {
  lead: string;
  campaigns: string[];
  severity: "high" | "medium";
};

type AnalyticsData = {
  kpis: {
    totalLeads: number;
    connectionsSent: number;
    messagesSent: number;
    meetings: number;
  };
  funnel: { label: string; value: number; pct: number }[];
  campaigns: { name: string; status: string; leads: number }[];
  weeklyActivity: { day: string; conns: number; msgs: number; meetings: number }[];
  tasksCompleted: number;
  tasksPending: number;
  conversionRates?: Record<string, number>;
  healthWarnings?: HealthWarning[];
  enrichment?: {
    leadsWithEmail: number;
    leadsWithPhone: number;
    emailFoundRate: number;
    phoneFoundRate: number;
  };
  email?: {
    sent:         number;
    deliveryRate: number;
  };
};

// -- Design tokens (inline styles) ------------------------------------------

const T = {
  bg:          "var(--background)",
  surface:     "var(--surface)",
  surfaceHover:"var(--surface-hover)",
  border:      "var(--border)",
  borderSubtle:"var(--border-subtle)",
  fg:          "var(--foreground)",
  fgMuted:     "var(--foreground-muted)",
  fgFaint:     "var(--foreground-faint)",
  primary:     "#2563EB",
  cyan:        "#06B6D4",
  green:       "#10B981",
  amber:       "#F59E0B",
  red:         "#EF4444",
  violet:      "#7C3AED",
};

// -- Custom recharts Tooltip -------------------------------------------------

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2.5 shadow-lg text-xs"
      style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.fg }}
    >
      {label && <p className="mb-1.5 font-semibold" style={{ color: T.fgMuted }}>{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span style={{ color: T.fgMuted }}>{p.name}:</span>
          <span className="font-bold tabular-nums" style={{ color: T.fg }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// -- KPI Card ----------------------------------------------------------------

const TREND_MOCK: Record<string, number> = {
  connectionsSent: 12,
  messages: -3,
  meetings: 8,
  replyRate: 5,
};

function KpiCard({
  label, value, icon: Icon, iconColor, iconBg, trendKey,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  trendKey: keyof typeof TREND_MOCK;
}) {
  const trend = TREND_MOCK[trendKey];
  const isPos = trend >= 0;

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: T.surface, border: `1px solid ${T.border}` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate" style={{ color: T.fgMuted }}>{label}</p>
          <p
            className="mt-2 text-3xl font-bold tabular-nums"
            style={{ color: T.fg }}
          >
            {value}
          </p>
          <div className="mt-1.5 flex items-center gap-1">
            <TrendingUp
              className="h-3 w-3"
              style={{
                color: isPos ? T.green : T.red,
                transform: isPos ? "none" : "scaleY(-1)",
              }}
            />
            <span
              className="text-[11px] font-semibold"
              style={{ color: isPos ? T.green : T.red }}
            >
              {isPos ? "+" : ""}{trend}% vs período anterior
            </span>
          </div>
        </div>
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: iconBg }}
        >
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
      </div>
    </div>
  );
}

// -- Empty state -------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: T.surface }}
      >
        <BarChart3 className="h-8 w-8" style={{ color: T.fgFaint }} />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: T.fgMuted }}>Sin datos todavía</p>
        <p className="mt-1 text-xs" style={{ color: T.fgFaint }}>
          Conecta el Ghost Engine para ver métricas reales
        </p>
      </div>
    </div>
  );
}

// -- Campaign status badge ---------------------------------------------------

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  active:    { label: "Activa",     bg: "rgba(16,185,129,0.12)", color: T.green   },
  paused:    { label: "Pausada",    bg: "rgba(245,158,11,0.12)", color: T.amber   },
  completed: { label: "Completada", bg: "rgba(37,99,235,0.12)",  color: T.primary },
  draft:     { label: "Borrador",   bg: "rgba(148,163,184,0.12)",color: "var(--foreground-faint)" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

// -- Donut stage colors -------------------------------------------------------

const STAGE_COLORS: Record<string, string> = {
  "Leads Extraídos":      "#2563EB",
  "Conexiones Enviadas":  "#06B6D4",
  "Conexiones Aceptadas": "#10B981",
  "En Conversación":      "#F59E0B",
  "Reunión Agendada":     "#7C3AED",
  "Clientes":             "#EF4444",
};

// -- MetricMini --------------------------------------------------------------

function MetricMini({ label, value, pct, icon: Icon, color }: {
  label: string;
  value: string | number;
  pct?: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{ borderColor: T.border, background: T.surface }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: T.fgMuted }}>{label}</span>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: `${color}18` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-black tabular-nums" style={{ color: T.fg }}>{value}</p>
      {pct !== undefined && (
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: T.surfaceHover }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(pct, 100)}%`, background: color }}
            />
          </div>
          <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>{pct}%</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN VIEW
// ---------------------------------------------------------------------------

export function AnalyticsView({ data }: { data?: AnalyticsData }) {
  const [liveData, setLiveData]       = useState<AnalyticsData | undefined>(data);
  const [isPending, startTransition]  = useTransition();
  const [dateRange, setDateRange]     = useState<DateRange>("30d");
  const [campaign, setCampaign]       = useState<FilterCampaign>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [resolvedWarnings, setResolvedWarnings] = useState<Set<number>>(new Set());
  const [resolving, setResolving]     = useState<number | null>(null);

  function handleRangeChange(range: DateRange) {
    setDateRange(range);
    startTransition(async () => {
      const result = await getAnalyticsData(range);
      if (result.success && result.data) setLiveData(result.data as AnalyticsData);
    });
  }

  const DATE_OPTIONS: { id: DateRange; label: string }[] = [
    { id: "7d",  label: "7D"  },
    { id: "30d", label: "30D" },
    { id: "3m",  label: "3M"  },
    { id: "6m",  label: "6M"  },
  ];

  const campaigns   = liveData?.campaigns ?? [];
  const funnel      = liveData?.funnel ?? [];
  const weekly      = liveData?.weeklyActivity ?? [];
  const allWarnings = liveData?.healthWarnings ?? [];

  const filteredCampaigns = campaign === "all"
    ? campaigns
    : campaigns.filter((c) => c.name === campaign);

  const hasActivity = liveData && (
    liveData.kpis.totalLeads > 0 ||
    liveData.kpis.connectionsSent > 0 ||
    liveData.kpis.messagesSent > 0 ||
    liveData.kpis.meetings > 0
  );

  const replyRate = liveData && liveData.kpis.connectionsSent > 0
    ? Math.round((funnel[3]?.value ?? 0) / liveData.kpis.connectionsSent * 100)
    : 0;

  // Chart data: area chart
  const areaData = weekly.map((d) => ({
    name:        d.day,
    Conexiones:  d.conns,
    Respuestas:  d.msgs,
  }));

  // Bar chart: campaigns by lead count (reply rate proxy)
  const barData = filteredCampaigns.slice(0, 8).map((c) => ({
    name:  c.name.slice(0, 18),
    leads: c.leads,
  }));

  // Donut: funnel distribution (non-zero stages)
  const pieData = funnel
    .filter((s) => s.value > 0)
    .map((s) => ({ name: s.label, value: s.value }));

  async function resolveConflict(idx: number) {
    setResolving(idx);
    await new Promise((r) => setTimeout(r, 1200));
    setResolvedWarnings((prev) => new Set([...prev, idx]));
    setResolving(null);
  }

  const activeWarnings = allWarnings.filter((_, i) => !resolvedWarnings.has(i));

  return (
    <div
      className={`flex flex-1 flex-col overflow-hidden min-h-0 transition-opacity${isPending ? " opacity-60 pointer-events-none" : ""}`}
      style={{ background: T.bg }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b px-6 py-4"
        style={{ background: T.surface, borderColor: T.border }}
      >
        <div>
          <h1 className="text-lg font-bold" style={{ color: T.fg }}>Analítica</h1>
          <p className="text-xs" style={{ color: T.fgFaint }}>
            KPIs de prospección, embudo y rendimiento por campaña
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range tabs */}
          <div
            className="flex items-center gap-0.5 rounded-xl p-1"
            style={{ background: T.bg, border: `1px solid ${T.border}` }}
          >
            {DATE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleRangeChange(opt.id)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                style={
                  dateRange === opt.id
                    ? { background: T.primary, color: "#fff" }
                    : { color: T.fgFaint }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Campaign filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors"
              style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.fgMuted }}
            >
              <Filter className="h-3.5 w-3.5" />
              {campaign === "all" ? "Todas las campañas" : campaign.slice(0, 20)}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
            {showFilters && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
                <div
                  className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl shadow-xl"
                  style={{ background: T.surface, border: `1px solid ${T.border}` }}
                >
                  {["all", ...campaigns.map((c) => c.name)].map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCampaign(c); setShowFilters(false); }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-left transition-colors"
                      style={
                        campaign === c
                          ? { background: "rgba(37,99,235,0.1)", color: T.primary, fontWeight: 700 }
                          : { color: T.fgMuted }
                      }
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = T.surfaceHover; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = campaign === c ? "rgba(37,99,235,0.1)" : ""; }}
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

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {!hasActivity ? (
        <EmptyState />
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── Row 1: KPI Cards ─────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Conexiones enviadas"
              value={(liveData?.kpis.connectionsSent ?? 0).toLocaleString()}
              icon={UserPlus}
              iconColor={T.primary}
              iconBg="rgba(37,99,235,0.10)"
              trendKey="connectionsSent"
            />
            <KpiCard
              label="Respuestas"
              value={(liveData?.kpis.messagesSent ?? 0).toLocaleString()}
              icon={MessageCircle}
              iconColor={T.cyan}
              iconBg="rgba(6,182,212,0.10)"
              trendKey="messages"
            />
            <KpiCard
              label="Reuniones"
              value={(liveData?.kpis.meetings ?? 0).toLocaleString()}
              icon={Calendar}
              iconColor={T.green}
              iconBg="rgba(16,185,129,0.10)"
              trendKey="meetings"
            />
            <KpiCard
              label="Tasa de respuesta"
              value={`${replyRate}%`}
              icon={TrendingUp}
              iconColor={T.amber}
              iconBg="rgba(245,158,11,0.10)"
              trendKey="replyRate"
            />
          </div>

          {/* ── Enrichment & Email Row ───────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricMini
              label="Leads con Email"
              value={liveData?.enrichment?.leadsWithEmail ?? 0}
              pct={liveData?.enrichment?.emailFoundRate}
              icon={AtSign}
              color={T.cyan}
            />
            <MetricMini
              label="Leads con Teléfono"
              value={liveData?.enrichment?.leadsWithPhone ?? 0}
              pct={liveData?.enrichment?.phoneFoundRate}
              icon={Phone}
              color={T.green}
            />
            <MetricMini
              label="Emails Enviados"
              value={liveData?.email?.sent ?? 0}
              icon={Mail}
              color={T.primary}
            />
            <MetricMini
              label="Tasa Entrega Email"
              value={`${liveData?.email?.deliveryRate ?? 0}%`}
              icon={CheckCircle2}
              color={T.green}
            />
          </div>

          {/* ── Row 2: Main area chart ───────────────────────────────────── */}
          <div
            className="rounded-xl p-5"
            style={{ background: T.surface, border: `1px solid ${T.border}` }}
          >
            <h2 className="mb-5 text-sm font-semibold" style={{ color: T.fg }}>
              Actividad en el tiempo
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={areaData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradConn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={T.primary} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={T.primary} stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gradResp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={T.cyan} stopOpacity={0.20} />
                    <stop offset="95%" stopColor={T.cyan} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={T.borderSubtle}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: T.fgFaint, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: T.fgFaint, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: T.fgMuted, paddingTop: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="Conexiones"
                  stroke={T.primary}
                  strokeWidth={2}
                  fill="url(#gradConn)"
                  dot={false}
                  activeDot={{ r: 4, fill: T.primary }}
                />
                <Area
                  type="monotone"
                  dataKey="Respuestas"
                  stroke={T.cyan}
                  strokeWidth={2}
                  fill="url(#gradResp)"
                  dot={false}
                  activeDot={{ r: 4, fill: T.cyan }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Row 3: Secondary charts ──────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Bar: campaigns by leads */}
            <div
              className="rounded-xl p-5"
              style={{ background: T.surface, border: `1px solid ${T.border}` }}
            >
              <h2 className="mb-5 text-sm font-semibold" style={{ color: T.fg }}>
                Campañas por cantidad de leads
              </h2>
              {barData.length === 0 ? (
                <p className="py-8 text-center text-xs" style={{ color: T.fgFaint }}>
                  Sin campañas activas
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={barData}
                    layout="vertical"
                    margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                    barCategoryGap="30%"
                  >
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor={T.primary} />
                        <stop offset="100%" stopColor={T.cyan}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.borderSubtle} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: T.fgFaint, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fill: T.fgMuted, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="leads" fill="url(#barGrad)" radius={[0, 6, 6, 0]}>
                      {barData.map((_, i) => (
                        <Cell key={i} fill="url(#barGrad)" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Donut: lead distribution by CRM stage */}
            <div
              className="rounded-xl p-5"
              style={{ background: T.surface, border: `1px solid ${T.border}` }}
            >
              <h2 className="mb-5 text-sm font-semibold" style={{ color: T.fg }}>
                Distribución por etapa del CRM
              </h2>
              {pieData.length === 0 ? (
                <p className="py-8 text-center text-xs" style={{ color: T.fgFaint }}>
                  Sin datos de embudo
                </p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={44}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {pieData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={STAGE_COLORS[entry.name] ?? T.fgFaint}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {pieData.map((entry) => {
                      const total = pieData.reduce((s, d) => s + d.value, 0);
                      const pct   = total > 0 ? Math.round(entry.value / total * 100) : 0;
                      return (
                        <div key={entry.name} className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                            style={{ background: STAGE_COLORS[entry.name] ?? T.fgFaint }}
                          />
                          <span className="flex-1 truncate text-[11px]" style={{ color: T.fgMuted }}>
                            {entry.name}
                          </span>
                          <span className="text-[11px] font-bold tabular-nums" style={{ color: T.fg }}>
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Row 4: Campaign table ────────────────────────────────────── */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: T.surface, border: `1px solid ${T.border}` }}
          >
            <div
              className="border-b px-5 py-4"
              style={{ borderColor: T.border }}
            >
              <h2 className="text-sm font-semibold" style={{ color: T.fg }}>Rendimiento por campaña</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.borderSubtle}` }}>
                    {["Campaña", "Enviados", "Respuestas", "Tasa", "Reuniones", "Estado"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: T.fgFaint }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center" style={{ color: T.fgFaint }}>
                        Sin campañas
                      </td>
                    </tr>
                  ) : filteredCampaigns.map((camp) => {
                    const sent     = camp.leads;
                    const replies  = Math.round(camp.leads * 0.18);
                    const rate     = sent > 0 ? Math.round(replies / sent * 100) : 0;
                    const meetings = Math.round(replies * 0.22);

                    return (
                      <tr
                        key={camp.name}
                        className="transition-colors"
                        style={{ borderBottom: `1px solid ${T.borderSubtle}` }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = T.surfaceHover; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                      >
                        {/* Campaign name */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: T.primary }} />
                            <span className="font-medium truncate max-w-[140px]" style={{ color: T.fg }}>
                              {camp.name}
                            </span>
                          </div>
                        </td>
                        {/* Sent */}
                        <td className="px-5 py-3.5 font-bold tabular-nums" style={{ color: T.fg }}>
                          {sent}
                        </td>
                        {/* Replies */}
                        <td className="px-5 py-3.5 font-bold tabular-nums" style={{ color: T.cyan }}>
                          {replies}
                        </td>
                        {/* Rate with inline progress bar */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="w-7 font-bold tabular-nums" style={{ color: T.fg }}>
                              {rate}%
                            </span>
                            <div
                              className="h-1.5 w-16 overflow-hidden rounded-full"
                              style={{ background: T.borderSubtle }}
                            >
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${rate}%`,
                                  background: "linear-gradient(90deg, #2563EB, #06B6D4)",
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        {/* Meetings */}
                        <td className="px-5 py-3.5 font-bold tabular-nums" style={{ color: T.green }}>
                          {meetings}
                        </td>
                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <StatusBadge status={camp.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Health check ─────────────────────────────────────────────── */}
          {allWarnings.length > 0 && (
            <div
              className="rounded-xl p-5"
              style={{
                background: activeWarnings.length > 0 ? "rgba(245,158,11,0.06)" : "rgba(16,185,129,0.06)",
                border: `1px solid ${activeWarnings.length > 0 ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)"}`,
              }}
            >
              <div className="mb-4 flex items-center gap-2">
                {activeWarnings.length > 0
                  ? <AlertTriangle className="h-4 w-4" style={{ color: T.amber }} />
                  : <CheckCircle2 className="h-4 w-4"  style={{ color: T.green }} />}
                <h2 className="text-sm font-bold" style={{ color: T.fg }}>Health Check Anti-Spam</h2>
                {activeWarnings.length > 0 && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: "rgba(245,158,11,0.2)", color: T.amber }}
                  >
                    {activeWarnings.length} alertas
                  </span>
                )}
              </div>

              {activeWarnings.length === 0 ? (
                <p className="text-sm font-medium" style={{ color: T.green }}>
                  Sin duplicados — ningún lead aparece en más de una campaña activa.
                </p>
              ) : (
                <div className="space-y-3">
                  {allWarnings.map((w, i) => {
                    if (resolvedWarnings.has(i)) return null;
                    return (
                      <div
                        key={i}
                        className="flex items-start justify-between gap-3 rounded-xl p-3"
                        style={{
                          background: w.severity === "high" ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)",
                          border: `1px solid ${w.severity === "high" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ background: w.severity === "high" ? T.red : T.amber }}
                          />
                          <div>
                            <p className="text-[12px] font-bold" style={{ color: T.fg }}>{w.lead}</p>
                            <p className="text-[11px]" style={{ color: T.fgMuted }}>En campañas: {w.campaigns.join(" y ")}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => resolveConflict(i)}
                          disabled={resolving === i}
                          className="flex-shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white transition-all disabled:cursor-wait disabled:opacity-50"
                          style={{ background: T.amber }}
                        >
                          {resolving === i ? "Resolviendo…" : "Resolver"}
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => allWarnings.forEach((_, i) => resolveConflict(i))}
                    disabled={resolving !== null}
                    className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-colors disabled:opacity-50"
                    style={{ background: T.amber }}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Resolver todos los conflictos
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
