"use client";

import { useState } from "react";
import {
  AlertTriangle, Check, CheckCircle2, ChevronRight,
  Clock, Copy, ExternalLink, Globe, HelpCircle, Key, Link2,
  Mail, Megaphone, Monitor, Plus, RefreshCw, Shield, Sliders, Trash2,
  Webhook, X, Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret: string;
}

type Tab = "limites" | "tokens" | "webhooks" | "integraciones";

// ── Helpers ───────────────────────────────────────────────────────────────────

function SliderField({
  label, sublabel, value, min, max, step = 1, unit = "", onChange,
}: {
  label: string; sublabel?: string; value: number; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="group">
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <span className="text-sm font-medium text-zinc-800">{label}</span>
          {sublabel && <p className="text-[11px] text-zinc-400">{sublabel}</p>}
        </div>
        <span className="min-w-[52px] rounded-lg bg-indigo-50 px-2 py-0.5 text-center text-sm font-bold tabular-nums text-indigo-700">
          {value}{unit}
        </span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-zinc-100">
        <div
          className="absolute left-0 top-0 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-300">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

function Toggle({
  label, sublabel, checked, onChange,
}: {
  label: string; sublabel?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-zinc-800">{label}</p>
        {sublabel && <p className="text-[11px] text-zinc-400">{sublabel}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={[
          "relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-indigo-600" : "bg-zinc-200",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 mb-5">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
        <Icon className="h-3.5 w-3.5 text-indigo-600" />
      </div>
      <h3 className="text-sm font-bold text-zinc-900">{label}</h3>
    </div>
  );
}

// ── WEBHOOK EVENTS ─────────────────────────────────────────────────────────────

const WEBHOOK_EVENTS = [
  { id: "lead.created",      label: "Lead creado" },
  { id: "message.received",  label: "Mensaje recibido" },
  { id: "meeting.booked",    label: "Reunión agendada" },
  { id: "campaign.paused",   label: "Campaña pausada" },
  { id: "connection.accepted", label: "Conexión aceptada" },
];

// ── INTEGRATIONS ───────────────────────────────────────────────────────────────

const INTEGRATIONS = [
  { id: "zapier",   name: "Zapier",   logo: "⚡", description: "Conecta NexusAI con +5000 apps sin código",   status: "available" },
  { id: "hubspot",  name: "HubSpot",  logo: "🧡", description: "Sincroniza leads y deals automáticamente",     status: "available" },
  { id: "notion",   name: "Notion",   logo: "◼", description: "Exporta tu pipeline y notas de contactos",     status: "coming" },
  { id: "slack",    name: "Slack",    logo: "💬", description: "Notificaciones en tiempo real de conversiones", status: "coming" },
  { id: "gmail",    name: "Gmail",    logo: "📧", description: "Mail marketing desde tu cuenta corporativa",   status: "available" },
  { id: "outlook",  name: "Outlook",  logo: "📨", description: "Integración SMTP/OAuth con Outlook 365",       status: "available" },
];

// ── MOCK PLAN DATA ─────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "growth", name: "Growth", price: "$49/mes", color: "border-zinc-200",
    features: ["1 cuenta LinkedIn", "30 conexiones/día", "Copiloto IA (sugerencias)", "CRM básico", "Extensión Chrome"],
    current: true,
  },
  {
    id: "pro", name: "Pro", price: "$129/mes", color: "border-indigo-400",
    features: ["3 cuentas LinkedIn", "100 conexiones/día", "Autopilot IA (autónomo)", "CRM personalizable", "Cloud 24/7"],
    current: false,
  },
  {
    id: "enterprise", name: "Enterprise", price: "A consultar", color: "border-amber-400",
    features: ["Cuentas ilimitadas", "Sin límites diarios", "Autopilot + A/B testing", "Múltiples pipelines", "Proxies VIP"],
    current: false,
  },
];

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export function ConfiguracionView() {
  const [activeTab, setActiveTab] = useState<Tab>("limites");
  const [saved, setSaved] = useState(false);

  // Límites state
  const [dailyConnections, setDailyConnections]   = useState(30);
  const [dailyMessages, setDailyMessages]         = useState(50);
  const [dailyInmails, setDailyInmails]           = useState(10);
  const [dailyLikes, setDailyLikes]               = useState(30);
  const [delayMin, setDelayMin]                   = useState(180);
  const [delayMax, setDelayMax]                   = useState(480);
  const [ultraSafe, setUltraSafe]                 = useState(true);
  const [pauseWeekends, setPauseWeekends]         = useState(true);
  const [warmupEnabled, setWarmupEnabled]         = useState(false);
  const [activeHoursStart, setActiveHoursStart]   = useState(8);
  const [activeHoursEnd, setActiveHoursEnd]       = useState(20);

  // LinkedIn connection mode state
  const [linkedinMode, setLinkedinMode] = useState<"extension" | "direct">("extension");
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [liAtCookie, setLiAtCookie]               = useState("");
  const [showCookieInput, setShowCookieInput]     = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([
    {
      id: "wh1", name: "CRM Interno", isActive: true, secret: "sk_wh_abc123",
      url: "https://hooks.ejemplo.com/nexus/leads",
      events: ["lead.created", "meeting.booked"],
    },
  ]);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ name: "", url: "", events: [] as string[] });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Integrations
  const [connectedApps, setConnectedApps] = useState<string[]>([]);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function toggleWebhookEvent(ev: string) {
    setNewWebhook((p) => ({
      ...p,
      events: p.events.includes(ev) ? p.events.filter((e) => e !== ev) : [...p.events, ev],
    }));
  }

  function addWebhook() {
    if (!newWebhook.name.trim() || !newWebhook.url.trim() || !newWebhook.events.length) return;
    setWebhooks((p) => [
      ...p,
      {
        id: `wh_${Date.now()}`,
        name: newWebhook.name,
        url: newWebhook.url,
        events: newWebhook.events,
        isActive: true,
        secret: `sk_wh_${Math.random().toString(36).slice(2, 10)}`,
      },
    ]);
    setNewWebhook({ name: "", url: "", events: [] });
    setShowWebhookForm(false);
  }

  function removeWebhook(id: string) {
    setWebhooks((p) => p.filter((w) => w.id !== id));
  }

  function toggleWebhookActive(id: string) {
    setWebhooks((p) => p.map((w) => w.id === id ? { ...w, isActive: !w.isActive } : w));
  }

  function connectLinkedin() {
    if (linkedinMode === "extension") {
      if (liAtCookie.trim().length > 20) {
        setLinkedinConnected(true);
        setShowCookieInput(false);
      }
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "limites",       label: "Límites & Seguridad", icon: Shield },
    { id: "tokens",        label: "Tokens & Plan",        icon: Zap },
    { id: "webhooks",      label: "Webhooks",             icon: Webhook },
    { id: "integraciones", label: "Integraciones",        icon: Globe },
  ];

  const fmtSeconds = (s: number) =>
    s >= 60 ? `${Math.floor(s / 60)}m ${s % 60 > 0 ? `${s % 60}s` : ""}`.trim() : `${s}s`;

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* ── Header ── */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Configuración</h1>
          <p className="text-xs text-zinc-400">Límites anti-ban, conexiones, tokens y webhooks del workspace</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className={[
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
              saved ? "bg-green-500 text-white" : "bg-zinc-900 text-white hover:bg-zinc-700",
            ].join(" ")}
          >
            {saved ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {saved ? "Guardado" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-shrink-0 gap-1 border-b border-border bg-white px-6">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={[
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === t.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-zinc-500 hover:text-zinc-700",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6">

        {/* ════════════════════════════════════════════
            TAB: LÍMITES & SEGURIDAD
        ════════════════════════════════════════════ */}
        {activeTab === "limites" && (
          <div className="mx-auto max-w-3xl space-y-6">

            {/* LinkedIn connection modes */}
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <SectionTitle icon={Link2} label="Conexión LinkedIn" />

              <div className="mb-5 grid grid-cols-2 gap-3">
                {/* Mode: Extension */}
                <button
                  onClick={() => setLinkedinMode("extension")}
                  className={[
                    "relative rounded-xl border-2 p-4 text-left transition-all",
                    linkedinMode === "extension"
                      ? "border-indigo-500 bg-indigo-50/60"
                      : "border-zinc-200 hover:border-zinc-300",
                  ].join(" ")}
                >
                  {linkedinMode === "extension" && (
                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <Monitor className="mb-2 h-6 w-6 text-indigo-600" />
                  <p className="text-sm font-bold text-zinc-900">Extensión Chrome</p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Ejecución local desde tu navegador. <span className="font-medium text-green-600">Recomendado</span> — IP natural, máxima seguridad.
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">
                    <Shield className="h-3 w-3" /> Plan Growth & Pro
                  </div>
                </button>

                {/* Mode: Direct */}
                <button
                  onClick={() => setLinkedinMode("direct")}
                  className={[
                    "relative rounded-xl border-2 p-4 text-left transition-all",
                    linkedinMode === "direct"
                      ? "border-amber-500 bg-amber-50/60"
                      : "border-zinc-200 hover:border-zinc-300",
                  ].join(" ")}
                >
                  {linkedinMode === "direct" && (
                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <Link2 className="mb-2 h-6 w-6 text-amber-600" />
                  <p className="text-sm font-bold text-zinc-900">Conexión Directa</p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Conecta tu cuenta directamente en la plataforma. Ejecución cloud 24/7 con proxy residencial.
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    <Zap className="h-3 w-3" /> Plan Pro & Enterprise
                  </div>
                </button>
              </div>

              {/* Extension mode content */}
              {linkedinMode === "extension" && (
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-4">
                  {linkedinConnected ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">LinkedIn conectado</p>
                          <p className="text-[11px] text-zinc-400">Cookie activa · Extensión sincronizada</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setLinkedinConnected(false)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Desconectar
                      </button>
                    </div>
                  ) : showCookieInput ? (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-zinc-700">
                          Cookie <code className="rounded bg-zinc-100 px-1 text-[11px]">li_at</code>
                          <a href="#" className="ml-2 inline-flex items-center gap-0.5 text-indigo-500 hover:underline text-[11px] font-normal">
                            ¿Cómo obtenerla? <ExternalLink className="h-3 w-3" />
                          </a>
                        </label>
                        <input
                          type="password"
                          value={liAtCookie}
                          onChange={(e) => setLiAtCookie(e.target.value)}
                          placeholder="AQEDATb..."
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-mono focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={connectLinkedin}
                          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Conectar cuenta
                        </button>
                        <button
                          onClick={() => setShowCookieInput(false)}
                          className="rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-700">Sin cuenta conectada</p>
                        <p className="text-[11px] text-zinc-400">
                          Instala la extensión NexusAI en Chrome y pega tu cookie <code className="text-indigo-500">li_at</code>.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href="#"
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                        >
                          <Monitor className="h-3.5 w-3.5" />
                          Instalar extensión
                        </a>
                        <button
                          onClick={() => setShowCookieInput(true)}
                          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          <Key className="h-3.5 w-3.5" />
                          Pegar cookie
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Direct mode content */}
              {linkedinMode === "direct" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-zinc-900">Requiere Plan Pro o Enterprise</p>
                      <p className="mt-1 text-[11px] text-zinc-600">
                        La conexión directa usa OAuth de LinkedIn + proxy residencial dedicado para operar 24/7 desde la nube sin necesitar tu navegador abierto. Disponible en los planes avanzados.
                      </p>
                      <button className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600">
                        <Zap className="h-3.5 w-3.5" />
                        Upgrade a Pro
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action limits */}
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <SectionTitle icon={Sliders} label="Límites de acciones diarias" />
              <div className="space-y-6">
                <SliderField label="Conexiones diarias" sublabel="Solicitudes de conexión enviadas" value={dailyConnections} min={5} max={100} onChange={setDailyConnections} />
                <SliderField label="Mensajes directos" sublabel="DMs a 1er grado de contacto" value={dailyMessages} min={5} max={200} onChange={setDailyMessages} />
                <SliderField label="InMails" sublabel="Mensajes a fuera de red" value={dailyInmails} min={1} max={30} onChange={setDailyInmails} />
                <SliderField label="Likes / interacciones" sublabel="Likes en publicaciones de prospectos" value={dailyLikes} min={0} max={100} onChange={setDailyLikes} />
              </div>
            </div>

            {/* Ghost Engine delays */}
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <SectionTitle icon={Clock} label="Ghost Engine — Retrasos humanos" />
              <p className="mb-5 text-[12px] text-zinc-400">
                El motor inserta retrasos aleatorios entre acciones para imitar comportamiento humano y evitar detección.
              </p>
              <div className="space-y-6">
                <SliderField
                  label="Retraso mínimo" sublabel={`Actual: ${fmtSeconds(delayMin)}`}
                  value={delayMin} min={60} max={600} step={30} unit="s"
                  onChange={(v) => { if (v < delayMax) setDelayMin(v); }}
                />
                <SliderField
                  label="Retraso máximo" sublabel={`Actual: ${fmtSeconds(delayMax)}`}
                  value={delayMax} min={120} max={900} step={30} unit="s"
                  onChange={(v) => { if (v > delayMin) setDelayMax(v); }}
                />
              </div>
            </div>

            {/* Safety toggles */}
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <SectionTitle icon={Shield} label="Seguridad anti-ban" />
              <div className="space-y-5">
                <Toggle
                  label="Modo Ultra-Seguro"
                  sublabel="Restringe actividad a horario de oficina y días hábiles"
                  checked={ultraSafe} onChange={setUltraSafe}
                />
                <Toggle
                  label="Pausar fines de semana"
                  sublabel="Sábado y domingo sin acciones automáticas"
                  checked={pauseWeekends} onChange={setPauseWeekends}
                />
                <Toggle
                  label="Modo Calentamiento (Warmup)"
                  sublabel="Incremento gradual de acciones para cuentas nuevas"
                  checked={warmupEnabled} onChange={setWarmupEnabled}
                />

                {ultraSafe && (
                  <div className="mt-2 grid grid-cols-2 gap-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-zinc-600">Hora inicio</label>
                      <div className="flex items-center gap-2">
                        <SliderField label="" value={activeHoursStart} min={6} max={12} unit=":00h" onChange={setActiveHoursStart} />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-zinc-600">Hora fin</label>
                      <div className="flex items-center gap-2">
                        <SliderField label="" value={activeHoursEnd} min={16} max={23} unit=":00h" onChange={setActiveHoursEnd} />
                      </div>
                    </div>
                    <div className="col-span-2 text-center">
                      <p className="text-[11px] text-indigo-600 font-medium">
                        Activo de {activeHoursStart}:00h a {activeHoursEnd}:00h · Zona: America/Lima
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: TOKENS & PLAN
        ════════════════════════════════════════════ */}
        {activeTab === "tokens" && (
          <div className="mx-auto max-w-3xl space-y-6">

            {/* Token usage */}
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <SectionTitle icon={Zap} label="Uso de tokens Claude — Mayo 2026" />
              <div className="space-y-4">
                {[
                  { label: "Tokens de entrada",     used: 1_240_000, limit: 5_000_000, color: "bg-indigo-500" },
                  { label: "Tokens de salida",       used: 340_000,   limit: 1_000_000, color: "bg-violet-500" },
                  { label: "API requests",           used: 1_847,     limit: 10_000,   color: "bg-sky-500" },
                ].map(({ label, used, limit, color }) => {
                  const pct = Math.round((used / limit) * 100);
                  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : n.toString();
                  return (
                    <div key={label}>
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <span className="text-sm font-medium text-zinc-700">{label}</span>
                        <span className="text-xs tabular-nums text-zinc-500">
                          {fmt(used)} / {fmt(limit)} <span className="font-bold text-zinc-900">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className={`h-full rounded-full transition-all ${color} ${pct > 80 ? "animate-pulse" : ""}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <RefreshCw className="h-4 w-4 text-zinc-400" />
                <p className="text-[12px] text-zinc-500">
                  El contador se reinicia el <strong>1 de junio 2026</strong> · Modelo: <code className="text-indigo-600">claude-sonnet-4-6</code>
                </p>
              </div>
            </div>

            {/* Plans */}
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <SectionTitle icon={Megaphone} label="Plan actual y opciones de upgrade" />
              <div className="grid gap-4 lg:grid-cols-3">
                {PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className={[
                      "relative rounded-xl border-2 p-5 transition-all",
                      plan.current
                        ? "border-indigo-500 bg-indigo-50/40"
                        : `${plan.color} hover:shadow-md`,
                    ].join(" ")}
                  >
                    {plan.current && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-[10px] font-bold text-white">
                        Plan actual
                      </div>
                    )}
                    <p className="text-base font-bold text-zinc-900">{plan.name}</p>
                    <p className="mt-0.5 text-xl font-black tabular-nums text-zinc-800">{plan.price}</p>
                    <ul className="mt-4 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-[12px] text-zinc-600">
                          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {!plan.current && (
                      <button className="mt-5 w-full rounded-lg bg-zinc-900 py-2 text-xs font-bold text-white hover:bg-zinc-700">
                        Mejorar a {plan.name}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: WEBHOOKS
        ════════════════════════════════════════════ */}
        {activeTab === "webhooks" && (
          <div className="mx-auto max-w-3xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-800">Webhooks configurados</p>
                <p className="text-[12px] text-zinc-400">NexusAI enviará un POST a tu URL cuando ocurran los eventos seleccionados.</p>
              </div>
              <button
                onClick={() => setShowWebhookForm(true)}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Crear webhook
              </button>
            </div>

            {/* Webhook list */}
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <div
                  key={wh.id}
                  className="rounded-2xl border border-border bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-zinc-900">{wh.name}</p>
                        <span className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          wh.isActive ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500",
                        ].join(" ")}>
                          {wh.isActive ? "Activo" : "Pausado"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <code className="truncate rounded bg-zinc-50 border border-zinc-100 px-2 py-1 text-[11px] text-zinc-600 max-w-xs">
                          {wh.url}
                        </code>
                        <button
                          onClick={() => handleCopy(wh.url, `url_${wh.id}`)}
                          className="text-zinc-400 hover:text-zinc-600"
                        >
                          {copiedId === `url_${wh.id}` ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {wh.events.map((ev) => (
                          <span key={ev} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                            {ev}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] text-zinc-400">Token secreto:</span>
                        <code className="rounded bg-zinc-50 border border-zinc-100 px-2 py-0.5 text-[10px] font-mono text-zinc-500">
                          {wh.secret.slice(0, 12)}•••
                        </code>
                        <button
                          onClick={() => handleCopy(wh.secret, `sec_${wh.id}`)}
                          className="text-zinc-400 hover:text-zinc-600"
                        >
                          {copiedId === `sec_${wh.id}` ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleWebhookActive(wh.id)}
                        className={[
                          "relative h-5 w-9 rounded-full transition-colors",
                          wh.isActive ? "bg-indigo-600" : "bg-zinc-200",
                        ].join(" ")}
                      >
                        <span className={[
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                          wh.isActive ? "translate-x-4" : "translate-x-0.5",
                        ].join(" ")} />
                      </button>
                      <button
                        onClick={() => removeWebhook(wh.id)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {webhooks.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 py-12">
                  <Webhook className="mb-3 h-8 w-8 text-zinc-300" />
                  <p className="text-sm font-medium text-zinc-400">Sin webhooks configurados</p>
                  <p className="text-[12px] text-zinc-300">Crea uno para recibir eventos en tiempo real</p>
                </div>
              )}
            </div>

            {/* Create webhook form */}
            {showWebhookForm && (
              <div className="rounded-2xl border-2 border-indigo-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900">Nuevo webhook</h3>
                  <button onClick={() => setShowWebhookForm(false)}>
                    <X className="h-4 w-4 text-zinc-400" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700">Nombre</label>
                    <input
                      value={newWebhook.name}
                      onChange={(e) => setNewWebhook((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Ej: CRM Interno, Slack Notifs..."
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700">URL del endpoint</label>
                    <input
                      value={newWebhook.url}
                      onChange={(e) => setNewWebhook((p) => ({ ...p, url: e.target.value }))}
                      placeholder="https://tuapp.com/webhooks/nexus"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-zinc-700">Eventos a escuchar</label>
                    <div className="grid grid-cols-2 gap-2">
                      {WEBHOOK_EVENTS.map((ev) => (
                        <label
                          key={ev.id}
                          className={[
                            "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs transition-colors",
                            newWebhook.events.includes(ev.id)
                              ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                              : "border-zinc-200 text-zinc-600 hover:bg-zinc-50",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={newWebhook.events.includes(ev.id)}
                            onChange={() => toggleWebhookEvent(ev.id)}
                          />
                          <div className={[
                            "h-3.5 w-3.5 flex-shrink-0 rounded border transition-colors",
                            newWebhook.events.includes(ev.id)
                              ? "border-indigo-500 bg-indigo-500"
                              : "border-zinc-300",
                          ].join(" ")}>
                            {newWebhook.events.includes(ev.id) && (
                              <Check className="h-full w-full p-0.5 text-white" />
                            )}
                          </div>
                          {ev.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={addWebhook}
                    disabled={!newWebhook.name || !newWebhook.url || !newWebhook.events.length}
                    className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white transition-opacity hover:bg-indigo-700 disabled:opacity-40"
                  >
                    Crear webhook
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: INTEGRACIONES
        ════════════════════════════════════════════ */}
        {activeTab === "integraciones" && (
          <div className="mx-auto max-w-3xl space-y-6">

            {/* ── LinkedIn OAuth ── */}
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">💼</span>
                <div>
                  <p className="text-sm font-bold text-zinc-900">LinkedIn</p>
                  <p className="text-[11px] text-zinc-400">Conecta tu cuenta para publicar contenido Inbound y sincronizar mensajes</p>
                </div>
                <div className="ml-auto">
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                    Requiere API key
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 mb-4">
                <p className="text-xs font-semibold text-blue-800 mb-1">Pasos para conectar LinkedIn OAuth</p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-blue-700">
                  <li>Crea una app en <strong>developer.linkedin.com</strong></li>
                  <li>Agrega los permisos: <code>r_liteprofile</code>, <code>w_member_social</code>, <code>rw_urn</code></li>
                  <li>Copia el <strong>Client ID</strong> y <strong>Client Secret</strong></li>
                  <li>Pégalos en los campos de abajo y haz clic en "Autorizar con LinkedIn"</li>
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-600">LinkedIn Client ID</label>
                  <input
                    type="text" placeholder="86xxxxxxxxxxxxxxxx"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-600">LinkedIn Client Secret</label>
                  <input
                    type="password" placeholder="••••••••••••••••"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              </div>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0077b5] py-2.5 text-sm font-bold text-white hover:bg-[#005f91] transition-colors">
                <span>in</span>
                Autorizar con LinkedIn
              </button>
              <p className="mt-2 text-center text-[10px] text-zinc-400">
                Tus credenciales se almacenan cifradas. NexusAI nunca las comparte.
              </p>
            </div>

            {/* ── Email OAuth ── */}
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-2xl">📧</span>
                <div>
                  <p className="text-sm font-bold text-zinc-900">Servidor de Correo (Email Marketing)</p>
                  <p className="text-[11px] text-zinc-400">Conecta Gmail, Outlook u otro servidor SMTP para enviar campañas de email</p>
                </div>
              </div>

              {/* Gmail OAuth */}
              <div className="mb-4 rounded-xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📧</span>
                    <div>
                      <p className="text-xs font-bold text-zinc-900">Gmail / Google Workspace</p>
                      <p className="text-[10px] text-zinc-400">Inicio de sesión con tu cuenta de Google — sin contraseñas</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Recomendado</span>
                </div>
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 mb-3 text-[11px] text-blue-700">
                  <p className="font-semibold mb-1">Para conectar Gmail:</p>
                  <ol className="list-decimal pl-4 space-y-0.5">
                    <li>Ve a <strong>console.cloud.google.com</strong> y crea un proyecto</li>
                    <li>Activa la API de <strong>Gmail</strong></li>
                    <li>Crea credenciales OAuth 2.0 (tipo: Aplicación Web)</li>
                    <li>Agrega redirect URI: <code>http://localhost:3000/api/auth/callback/google</code></li>
                    <li>Copia Client ID y Secret abajo</li>
                  </ol>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-600">Google Client ID</label>
                    <input type="text" placeholder="xxxx.apps.googleusercontent.com"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs focus:border-indigo-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-600">Google Client Secret</label>
                    <input type="password" placeholder="GOCSPX-••••••••"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs focus:border-indigo-400 focus:outline-none" />
                  </div>
                </div>
                <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm">
                  <span className="text-base">G</span>
                  Iniciar sesión con Google
                </button>
              </div>

              {/* SMTP Manual */}
              <div className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">⚙️</span>
                  <div>
                    <p className="text-xs font-bold text-zinc-900">SMTP personalizado</p>
                    <p className="text-[10px] text-zinc-400">Outlook, Zoho, SendGrid, Amazon SES u otro servidor</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-600">Servidor SMTP</label>
                    <input type="text" placeholder="smtp.gmail.com  /  smtp.office365.com"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs focus:border-indigo-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-600">Puerto</label>
                    <input type="number" placeholder="587" defaultValue={587}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs focus:border-indigo-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-600">Seguridad</label>
                    <select className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs focus:border-indigo-400 focus:outline-none">
                      <option>STARTTLS (587)</option>
                      <option>SSL/TLS (465)</option>
                      <option>Sin cifrado (25)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-600">Usuario / Email remitente</label>
                    <input type="email" placeholder="ventas@tuempresa.com"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs focus:border-indigo-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-zinc-600">Contraseña de app</label>
                    <input type="password" placeholder="••••••••••••"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs focus:border-indigo-400 focus:outline-none" />
                  </div>
                </div>
                <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-xs font-bold text-white hover:bg-zinc-700 transition-colors">
                  <Check className="h-3.5 w-3.5" />
                  Guardar y verificar conexión SMTP
                </button>
              </div>
            </div>

            {/* ── Otras integraciones ── */}
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <p className="text-sm font-bold text-zinc-900 mb-4">Otras integraciones</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {INTEGRATIONS.map((int) => {
                  const isConnected = connectedApps.includes(int.id);
                  const isComingSoon = int.status === "coming";
                  return (
                    <div key={int.id}
                      className={["rounded-xl border p-4 transition-all", isConnected ? "border-green-300 bg-green-50/30" : "border-zinc-200 bg-white"].join(" ")}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{int.logo}</span>
                          <p className="text-xs font-bold text-zinc-900">{int.name}</p>
                        </div>
                        {isConnected
                          ? <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700"><Check className="h-3 w-3" />Conectado</span>
                          : isComingSoon
                          ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">PRONTO</span>
                          : null}
                      </div>
                      <p className="text-[11px] text-zinc-500 mb-3">{int.description}</p>
                      <button
                        disabled={isComingSoon}
                        onClick={() => setConnectedApps((p) => isConnected ? p.filter((a) => a !== int.id) : [...p, int.id])}
                        className={["w-full rounded-lg py-1.5 text-[11px] font-semibold transition-colors",
                          isComingSoon ? "cursor-not-allowed bg-zinc-100 text-zinc-400"
                          : isConnected ? "border border-red-200 text-red-600 hover:bg-red-50"
                          : "bg-zinc-900 text-white hover:bg-zinc-700"].join(" ")}
                      >
                        {isComingSoon ? "Disponible pronto" : isConnected ? "Desconectar" : `Conectar`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
