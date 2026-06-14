"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle, Check, CheckCircle2, ChevronRight,
  Clock, Copy, ExternalLink, Globe, HelpCircle, Key, Link2,
  Mail, Megaphone, Monitor, Plus, RefreshCw, Shield, Sliders, Trash2,
  Webhook, X, Zap,
} from "lucide-react";
import {
  saveSettings, upsertWebhook as upsertWebhookAction,
  deleteWebhook as deleteWebhookAction, toggleWebhookActive as toggleWebhookActiveAction,
  type WorkspaceSettingsRow, type WebhookRow,
} from "@/app/dashboard/configuracion/actions";

// -- Types ---------------------------------------------------------------------

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret: string;
}

type Tab = "limites" | "tokens" | "webhooks" | "integraciones";

type Toast = { type: "success" | "error"; msg: string } | null;

interface ConfiguracionViewProps {
  initialSettings: WorkspaceSettingsRow | null;
  initialWebhooks: WebhookRow[];
}

// -- Helpers -------------------------------------------------------------------

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
          <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
          {sublabel && <p className="text-[11px] text-[var(--foreground-muted)]">{sublabel}</p>}
        </div>
        <span className="min-w-[52px] rounded-lg bg-[rgba(37,99,235,0.12)] px-2 py-0.5 text-center text-sm font-bold tabular-nums text-[#2563EB]">
          {value}{unit}
        </span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-[var(--border)]">
        <div
          className="absolute left-0 top-0 h-2 rounded-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4] transition-all"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--foreground-faint)]">
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
        <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
        {sublabel && <p className="text-[11px] text-[var(--foreground-muted)]">{sublabel}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={[
          "relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-[#2563EB]" : "bg-[var(--border)]",
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
    <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3 mb-5">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(37,99,235,0.1)]">
        <Icon className="h-3.5 w-3.5 text-[#2563EB]" />
      </div>
      <h3 className="text-sm font-bold text-[var(--foreground)]">{label}</h3>
    </div>
  );
}

// -- WEBHOOK EVENTS -------------------------------------------------------------

const WEBHOOK_EVENTS = [
  { id: "lead.created",      label: "Lead creado" },
  { id: "message.received",  label: "Mensaje recibido" },
  { id: "meeting.booked",    label: "Reunión agendada" },
  { id: "campaign.paused",   label: "Campaña pausada" },
  { id: "connection.accepted", label: "Conexión aceptada" },
];

// -- INTEGRATIONS ---------------------------------------------------------------

const INTEGRATIONS = [
  { id: "zapier",   name: "Zapier",   logo: "⚡", description: "Conecta cazary.ai con +5000 apps sin código",   status: "available" },
  { id: "hubspot",  name: "HubSpot",  logo: "🧡", description: "Sincroniza leads y deals automáticamente",     status: "available" },
  { id: "notion",   name: "Notion",   logo: "◼", description: "Exporta tu pipeline y notas de contactos",     status: "coming" },
  { id: "slack",    name: "Slack",    logo: "💬", description: "Notificaciones en tiempo real de conversiones", status: "coming" },
  { id: "gmail",    name: "Gmail",    logo: "📧", description: "Mail marketing desde tu cuenta corporativa",   status: "available" },
  { id: "outlook",  name: "Outlook",  logo: "📨", description: "Integración SMTP/OAuth con Outlook 365",       status: "available" },
];

// -- MOCK PLAN DATA -------------------------------------------------------------

const PLANS = [
  {
    id: "growth", name: "Growth", price: "$49/mes", color: "border-[var(--border)]",
    features: ["1 cuenta LinkedIn", "30 conexiones/día", "Copiloto IA (sugerencias)", "CRM básico", "Extensión Chrome"],
    current: true,
  },
  {
    id: "pro", name: "Pro", price: "$129/mes", color: "border-[#2563EB]",
    features: ["3 cuentas LinkedIn", "100 conexiones/día", "Autopilot IA (autónomo)", "CRM personalizable", "Cloud 24/7"],
    current: false,
  },
  {
    id: "enterprise", name: "Enterprise", price: "A consultar", color: "border-amber-400",
    features: ["Cuentas ilimitadas", "Sin límites diarios", "Autopilot + A/B testing", "Múltiples pipelines", "Proxies VIP"],
    current: false,
  },
];

// -- MAIN COMPONENT ------------------------------------------------------------

function mapWebhook(row: WebhookRow): WebhookItem {
  return {
    id:       row.id,
    name:     row.name,
    url:      row.url,
    events:   row.events ?? [],
    isActive: row.is_active,
    secret:   row.secret_token ?? "",
  };
}

export function ConfiguracionView({ initialSettings, initialWebhooks }: ConfiguracionViewProps) {
  const [activeTab, setActiveTab]     = useState<Tab>("limites");
  const [toast, setToast]             = useState<Toast>(null);
  const [isPending, startTransition]  = useTransition();

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  // Límites state — seeded from Supabase
  const s = initialSettings;
  const [dailyConnections, setDailyConnections] = useState(s?.daily_connections_limit ?? 30);
  const [dailyMessages, setDailyMessages]       = useState(s?.daily_messages_limit    ?? 50);
  const [dailyInmails, setDailyInmails]         = useState(10);
  const [dailyLikes, setDailyLikes]             = useState(30);
  const [delayMin, setDelayMin]                 = useState(180);
  const [delayMax, setDelayMax]                 = useState(480);
  const [ultraSafe, setUltraSafe]               = useState(s?.ultra_safe_mode      ?? true);
  const [pauseWeekends, setPauseWeekends]       = useState(s?.pause_on_weekends    ?? true);
  const [warmupEnabled, setWarmupEnabled]       = useState(false);
  const [activeHoursStart, setActiveHoursStart] = useState(s?.active_hours_start   ?? 8);
  const [activeHoursEnd, setActiveHoursEnd]     = useState(s?.active_hours_end     ?? 20);

  // LinkedIn connection mode state
  const [linkedinMode, setLinkedinMode]         = useState<"extension" | "direct">("extension");
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [liAtCookie, setLiAtCookie]             = useState("");
  const [showCookieInput, setShowCookieInput]   = useState(false);

  // Webhooks state — seeded from Supabase
  const [webhooks, setWebhooks]       = useState<WebhookItem[]>(() => initialWebhooks.map(mapWebhook));
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [newWebhook, setNewWebhook]   = useState({ name: "", url: "", events: [] as string[] });
  const [copiedId, setCopiedId]       = useState<string | null>(null);

  // Integrations
  const [connectedApps, setConnectedApps] = useState<string[]>([]);

  // -- Handlers ----------------------------------------------------------------

  function handleSave() {
    startTransition(async () => {
      const res = await saveSettings({
        daily_connections_limit: dailyConnections,
        daily_messages_limit:    dailyMessages,
        ultra_safe_mode:         ultraSafe,
        pause_on_weekends:       pauseWeekends,
        active_hours_start:      activeHoursStart,
        active_hours_end:        activeHoursEnd,
      });
      showToast(res.success ? "success" : "error", res.success ? "Configuración guardada" : (res.error ?? "Error al guardar"));
    });
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
    startTransition(async () => {
      const res = await upsertWebhookAction({
        name:      newWebhook.name,
        url:       newWebhook.url,
        events:    newWebhook.events,
        is_active: true,
      });
      if (res.success && res.data) {
        setWebhooks((p) => [...p, mapWebhook(res.data!)]);
        setNewWebhook({ name: "", url: "", events: [] });
        setShowWebhookForm(false);
        showToast("success", "Webhook creado");
      } else {
        showToast("error", res.error ?? "Error al crear webhook");
      }
    });
  }

  function removeWebhook(id: string) {
    setWebhooks((p) => p.filter((w) => w.id !== id));
    startTransition(async () => {
      const res = await deleteWebhookAction(id);
      if (!res.success) {
        setWebhooks((p) => [...p]); // revert handled by router.refresh not needed — optimistic is fine
        showToast("error", res.error ?? "Error al eliminar webhook");
      } else {
        showToast("success", "Webhook eliminado");
      }
    });
  }

  function toggleWebhookActive(id: string) {
    setWebhooks((p) => p.map((w) => w.id === id ? { ...w, isActive: !w.isActive } : w));
    const wh = webhooks.find((w) => w.id === id);
    if (!wh) return;
    startTransition(async () => {
      await toggleWebhookActiveAction(id, !wh.isActive);
    });
  }

  function connectLinkedin() {
    if (linkedinMode === "extension" && liAtCookie.trim().length > 20) {
      setLinkedinConnected(true);
      setShowCookieInput(false);
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
      {/* -- Header -- */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--foreground)]">Configuración</h1>
          <p className="text-xs text-[var(--foreground-muted)]">Límites anti-ban, conexiones, tokens y webhooks del workspace</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Toast */}
          {toast && (
            <span className={[
              "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold",
              toast.type === "success"
                ? "bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.3)] text-[#10B981]"
                : "bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.3)] text-[#EF4444]",
            ].join(" ")}>
              {toast.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {toast.msg}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-all"
          >
            {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {/* -- Tabs -- */}
      <div className="flex flex-shrink-0 gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-6">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={[
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === t.id
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* -- Content -- */}
      <div className="flex-1 overflow-y-auto bg-[var(--background)] p-6">

        {/* --------------------------------------------
            TAB: LÍMITES & SEGURIDAD
        -------------------------------------------- */}
        {activeTab === "limites" && (
          <div className="mx-auto max-w-3xl space-y-6">

            {/* LinkedIn connection modes */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <SectionTitle icon={Link2} label="Conexión LinkedIn" />

              <div className="mb-5 grid grid-cols-2 gap-3">
                {/* Mode: Extension */}
                <button
                  onClick={() => setLinkedinMode("extension")}
                  className={[
                    "relative rounded-xl border-2 p-4 text-left transition-all",
                    linkedinMode === "extension"
                      ? "border-[#2563EB] bg-[rgba(37,99,235,0.08)]"
                      : "border-[var(--border)] hover:border-[var(--foreground-faint)]",
                  ].join(" ")}
                >
                  {linkedinMode === "extension" && (
                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB]">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <Monitor className="mb-2 h-6 w-6 text-[#2563EB]" />
                  <p className="text-sm font-bold text-[var(--foreground)]">Extensión Chrome</p>
                  <p className="mt-1 text-[11px] text-[var(--foreground-muted)]">
                    Ejecución local desde tu navegador. <span className="font-medium text-[#10B981]">Recomendado</span> — IP natural, máxima seguridad.
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[rgba(16,185,129,0.12)] px-2 py-0.5 text-[10px] font-bold text-[#10B981]">
                    <Shield className="h-3 w-3" /> Plan Growth & Pro
                  </div>
                </button>

                {/* Mode: Direct */}
                <button
                  onClick={() => setLinkedinMode("direct")}
                  className={[
                    "relative rounded-xl border-2 p-4 text-left transition-all",
                    linkedinMode === "direct"
                      ? "border-amber-500 bg-[rgba(245,158,11,0.08)]"
                      : "border-[var(--border)] hover:border-[var(--foreground-faint)]",
                  ].join(" ")}
                >
                  {linkedinMode === "direct" && (
                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <Link2 className="mb-2 h-6 w-6 text-amber-500" />
                  <p className="text-sm font-bold text-[var(--foreground)]">Conexión Directa</p>
                  <p className="mt-1 text-[11px] text-[var(--foreground-muted)]">
                    Conecta tu cuenta directamente en la plataforma. Ejecución cloud 24/7 con proxy residencial.
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[rgba(245,158,11,0.12)] px-2 py-0.5 text-[10px] font-bold text-[#F59E0B]">
                    <Zap className="h-3 w-3" /> Plan Pro & Enterprise
                  </div>
                </button>
              </div>

              {/* Extension mode content */}
              {linkedinMode === "extension" && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                  {linkedinConnected ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(16,185,129,0.12)]">
                          <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--foreground)]">LinkedIn conectado</p>
                          <p className="text-[11px] text-[var(--foreground-muted)]">Cookie activa · Extensión sincronizada</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setLinkedinConnected(false)}
                        className="rounded-lg border border-[rgba(239,68,68,0.3)] px-3 py-1.5 text-xs font-medium text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)]"
                      >
                        Desconectar
                      </button>
                    </div>
                  ) : showCookieInput ? (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">
                          Cookie <code className="rounded bg-[var(--border)] px-1 text-[11px] text-[var(--foreground)]">li_at</code>
                          <a href="#" className="ml-2 inline-flex items-center gap-0.5 text-[#2563EB] hover:underline text-[11px] font-normal">
                            ¿Cómo obtenerla? <ExternalLink className="h-3 w-3" />
                          </a>
                        </label>
                        <input
                          type="password"
                          value={liAtCookie}
                          onChange={(e) => setLiAtCookie(e.target.value)}
                          placeholder="AQEDATb..."
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-mono text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={connectLinkedin}
                          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Conectar cuenta
                        </button>
                        <button
                          onClick={() => setShowCookieInput(false)}
                          className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--foreground-muted)]">Sin cuenta conectada</p>
                        <p className="text-[11px] text-[var(--foreground-muted)]">
                          Instala la extensión cazary.ai en Chrome y pega tu cookie <code className="text-[#2563EB]">li_at</code>.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href="#"
                          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]"
                        >
                          <Monitor className="h-3.5 w-3.5" />
                          Instalar extensión
                        </a>
                        <button
                          onClick={() => setShowCookieInput(true)}
                          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
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
                <div className="rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#F59E0B]" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[var(--foreground)]">Requiere Plan Pro o Enterprise</p>
                      <p className="mt-1 text-[11px] text-[var(--foreground-muted)]">
                        La conexión directa usa OAuth de LinkedIn + proxy residencial dedicado para operar 24/7 desde la nube sin necesitar tu navegador abierto. Disponible en los planes avanzados.
                      </p>
                      <button className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#F59E0B] px-4 py-2 text-xs font-bold text-white hover:opacity-90">
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
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <SectionTitle icon={Sliders} label="Límites de acciones diarias" />
              <div className="space-y-6">
                <SliderField label="Conexiones diarias" sublabel="Solicitudes de conexión enviadas" value={dailyConnections} min={5} max={100} onChange={setDailyConnections} />
                <SliderField label="Mensajes directos" sublabel="DMs a 1er grado de contacto" value={dailyMessages} min={5} max={200} onChange={setDailyMessages} />
                <SliderField label="InMails" sublabel="Mensajes a fuera de red" value={dailyInmails} min={1} max={30} onChange={setDailyInmails} />
                <SliderField label="Likes / interacciones" sublabel="Likes en publicaciones de prospectos" value={dailyLikes} min={0} max={100} onChange={setDailyLikes} />
              </div>
            </div>

            {/* Ghost Engine delays */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <SectionTitle icon={Clock} label="Ghost Engine — Retrasos humanos" />
              <p className="mb-5 text-[12px] text-[var(--foreground-muted)]">
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
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
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
                  <div className="mt-2 grid grid-cols-2 gap-4 rounded-xl border border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.06)] p-4">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--foreground-muted)]">Hora inicio</label>
                      <div className="flex items-center gap-2">
                        <SliderField label="" value={activeHoursStart} min={6} max={12} unit=":00h" onChange={setActiveHoursStart} />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[var(--foreground-muted)]">Hora fin</label>
                      <div className="flex items-center gap-2">
                        <SliderField label="" value={activeHoursEnd} min={16} max={23} unit=":00h" onChange={setActiveHoursEnd} />
                      </div>
                    </div>
                    <div className="col-span-2 text-center">
                      <p className="text-[11px] text-[#2563EB] font-medium">
                        Activo de {activeHoursStart}:00h a {activeHoursEnd}:00h · Zona: America/Lima
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------
            TAB: TOKENS & PLAN
        -------------------------------------------- */}
        {activeTab === "tokens" && (
          <div className="mx-auto max-w-3xl space-y-6">

            {/* Token usage */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <SectionTitle icon={Zap} label="Uso de tokens Claude — Mayo 2026" />
              <div className="space-y-4">
                {[
                  { label: "Tokens de entrada",     used: 1_240_000, limit: 5_000_000, color: "bg-[#2563EB]" },
                  { label: "Tokens de salida",       used: 340_000,   limit: 1_000_000, color: "bg-violet-500" },
                  { label: "API requests",           used: 1_847,     limit: 10_000,   color: "bg-[#06B6D4]" },
                ].map(({ label, used, limit, color }) => {
                  const pct = Math.round((used / limit) * 100);
                  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : n.toString();
                  return (
                    <div key={label}>
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <span className="text-sm font-medium text-[var(--foreground-muted)]">{label}</span>
                        <span className="text-xs tabular-nums text-[var(--foreground-muted)]">
                          {fmt(used)} / {fmt(limit)} <span className="font-bold text-[var(--foreground)]">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                        <div
                          className={`h-full rounded-full transition-all ${color} ${pct > 80 ? "animate-pulse" : ""}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3">
                <RefreshCw className="h-4 w-4 text-[var(--foreground-muted)]" />
                <p className="text-[12px] text-[var(--foreground-muted)]">
                  El contador se reinicia el <strong>1 de junio 2026</strong> · Modelo: <code className="text-[#2563EB]">claude-sonnet-4-6</code>
                </p>
              </div>
            </div>

            {/* Plans */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <SectionTitle icon={Megaphone} label="Plan actual y opciones de upgrade" />
              <div className="grid gap-4 lg:grid-cols-3">
                {PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className={[
                      "relative rounded-xl border-2 p-5 transition-all",
                      plan.current
                        ? "border-[#2563EB] bg-[rgba(37,99,235,0.08)]"
                        : `${plan.color} hover:shadow-md`,
                    ].join(" ")}
                  >
                    {plan.current && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-3 py-0.5 text-[10px] font-bold text-white">
                        Plan actual
                      </div>
                    )}
                    <p className="text-base font-bold text-[var(--foreground)]">{plan.name}</p>
                    <p className="mt-0.5 text-xl font-black tabular-nums text-[var(--foreground)]">{plan.price}</p>
                    <ul className="mt-4 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-[12px] text-[var(--foreground-muted)]">
                          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-[#10B981]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {!plan.current && (
                      <button className="mt-5 w-full rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] py-2 text-xs font-bold text-white hover:opacity-90">
                        Mejorar a {plan.name}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------
            TAB: WEBHOOKS
        -------------------------------------------- */}
        {activeTab === "webhooks" && (
          <div className="mx-auto max-w-3xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Webhooks configurados</p>
                <p className="text-[12px] text-[var(--foreground-muted)]">cazary.ai enviará un POST a tu URL cuando ocurran los eventos seleccionados.</p>
              </div>
              <button
                onClick={() => setShowWebhookForm(true)}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
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
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[var(--foreground)]">{wh.name}</p>
                        <span className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          wh.isActive
                            ? "bg-[rgba(16,185,129,0.12)] text-[#10B981]"
                            : "bg-[var(--border)] text-[var(--foreground-faint)]",
                        ].join(" ")}>
                          {wh.isActive ? "Activo" : "Pausado"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <code className="truncate rounded bg-[var(--background)] border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--foreground-muted)] max-w-xs">
                          {wh.url}
                        </code>
                        <button
                          onClick={() => handleCopy(wh.url, `url_${wh.id}`)}
                          className="text-[var(--foreground-muted)] hover:text-[#2563EB]"
                        >
                          {copiedId === `url_${wh.id}` ? <Check className="h-3.5 w-3.5 text-[#10B981]" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {wh.events.map((ev) => (
                          <span key={ev} className="rounded-full bg-[rgba(37,99,235,0.12)] px-2 py-0.5 text-[10px] font-medium text-[#2563EB]">
                            {ev}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] text-[var(--foreground-faint)]">Token secreto:</span>
                        <code className="rounded bg-[var(--background)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-mono text-[var(--foreground-muted)]">
                          {wh.secret.slice(0, 12)}•••
                        </code>
                        <button
                          onClick={() => handleCopy(wh.secret, `sec_${wh.id}`)}
                          className="text-[var(--foreground-muted)] hover:text-[#2563EB]"
                        >
                          {copiedId === `sec_${wh.id}` ? <Check className="h-3.5 w-3.5 text-[#10B981]" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleWebhookActive(wh.id)}
                        className={[
                          "relative h-5 w-9 rounded-full transition-colors",
                          wh.isActive ? "bg-[#2563EB]" : "bg-[var(--border)]",
                        ].join(" ")}
                      >
                        <span className={[
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                          wh.isActive ? "translate-x-4" : "translate-x-0.5",
                        ].join(" ")} />
                      </button>
                      <button
                        onClick={() => removeWebhook(wh.id)}
                        className="rounded-lg p-1.5 text-[var(--foreground-muted)] hover:bg-[rgba(239,68,68,0.1)] hover:text-[#EF4444]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {webhooks.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] py-12">
                  <Webhook className="mb-3 h-8 w-8 text-[var(--foreground-faint)]" />
                  <p className="text-sm font-medium text-[var(--foreground-muted)]">Sin webhooks configurados</p>
                  <p className="text-[12px] text-[var(--foreground-muted)]">Crea uno para recibir eventos en tiempo real</p>
                </div>
              )}
            </div>

            {/* Create webhook form */}
            {showWebhookForm && (
              <div className="rounded-2xl border-2 border-[rgba(37,99,235,0.3)] bg-[var(--surface)] p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--foreground)]">Nuevo webhook</h3>
                  <button onClick={() => setShowWebhookForm(false)}>
                    <X className="h-4 w-4 text-[var(--foreground-muted)]" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">Nombre</label>
                    <input
                      value={newWebhook.name}
                      onChange={(e) => setNewWebhook((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Ej: CRM Interno, Slack Notifs..."
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">URL del endpoint</label>
                    <input
                      value={newWebhook.url}
                      onChange={(e) => setNewWebhook((p) => ({ ...p, url: e.target.value }))}
                      placeholder="https://tuapp.com/webhooks/nexus"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-[var(--foreground-muted)]">Eventos a escuchar</label>
                    <div className="grid grid-cols-2 gap-2">
                      {WEBHOOK_EVENTS.map((ev) => (
                        <label
                          key={ev.id}
                          className={[
                            "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs transition-colors",
                            newWebhook.events.includes(ev.id)
                              ? "border-[rgba(37,99,235,0.4)] bg-[rgba(37,99,235,0.1)] text-[#2563EB]"
                              : "border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]",
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
                              ? "border-[#2563EB] bg-[#2563EB]"
                              : "border-[var(--foreground-faint)]",
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
                    className="w-full rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Crear webhook
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------
            TAB: INTEGRACIONES
        -------------------------------------------- */}
        {activeTab === "integraciones" && (
          <div className="mx-auto max-w-3xl space-y-6">

            {/* -- LinkedIn OAuth -- */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">💼</span>
                <div>
                  <p className="text-sm font-bold text-[var(--foreground)]">LinkedIn</p>
                  <p className="text-[11px] text-[var(--foreground-muted)]">Conecta tu cuenta para publicar contenido Inbound y sincronizar mensajes</p>
                </div>
                <div className="ml-auto">
                  <span className="rounded-full bg-[rgba(245,158,11,0.12)] px-2.5 py-0.5 text-[10px] font-bold text-[#F59E0B]">
                    Requiere API key
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-[rgba(37,99,235,0.15)] bg-[rgba(37,99,235,0.06)] p-4 mb-4">
                <p className="text-xs font-semibold text-[var(--foreground)] mb-1">Pasos para conectar LinkedIn OAuth</p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-[var(--foreground-muted)]">
                  <li>Crea una app en <strong>developer.linkedin.com</strong></li>
                  <li>Agrega los permisos: <code>r_liteprofile</code>, <code>w_member_social</code>, <code>rw_urn</code></li>
                  <li>Copia el <strong>Client ID</strong> y <strong>Client Secret</strong></li>
                  <li>Pégalos en los campos de abajo y haz clic en "Autorizar con LinkedIn"</li>
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[var(--foreground-muted)]">LinkedIn Client ID</label>
                  <input
                    type="text" placeholder="86xxxxxxxxxxxxxxxx"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[var(--foreground-muted)]">LinkedIn Client Secret</label>
                  <input
                    type="password" placeholder="••••••••••••••••"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
                  />
                </div>
              </div>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0077b5] py-2.5 text-sm font-bold text-white hover:bg-[#005f91] transition-colors">
                <span>in</span>
                Autorizar con LinkedIn
              </button>
              <p className="mt-2 text-center text-[10px] text-[var(--foreground-muted)]">
                Tus credenciales se almacenan cifradas. cazary.ai nunca las comparte.
              </p>
            </div>

            {/* -- Email OAuth -- */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-2xl">📧</span>
                <div>
                  <p className="text-sm font-bold text-[var(--foreground)]">Servidor de Correo (Email Marketing)</p>
                  <p className="text-[11px] text-[var(--foreground-muted)]">Conecta Gmail, Outlook u otro servidor SMTP para enviar campañas de email</p>
                </div>
              </div>

              {/* Gmail OAuth */}
              <div className="mb-4 rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📧</span>
                    <div>
                      <p className="text-xs font-bold text-[var(--foreground)]">Gmail / Google Workspace</p>
                      <p className="text-[10px] text-[var(--foreground-muted)]">Inicio de sesión con tu cuenta de Google — sin contraseñas</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[rgba(16,185,129,0.12)] px-2 py-0.5 text-[10px] font-bold text-[#10B981]">Recomendado</span>
                </div>
                <div className="rounded-lg border border-[rgba(37,99,235,0.15)] bg-[rgba(37,99,235,0.06)] p-3 mb-3 text-[11px] text-[var(--foreground-muted)]">
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
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--foreground-muted)]">Google Client ID</label>
                    <input type="text" placeholder="xxxx.apps.googleusercontent.com"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--foreground-muted)]">Google Client Secret</label>
                    <input type="password" placeholder="GOCSPX-••••••••"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]" />
                  </div>
                </div>
                <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.04)] transition-colors shadow-sm">
                  <span className="text-base">G</span>
                  Iniciar sesión con Google
                </button>
              </div>

              {/* SMTP Manual */}
              <div className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">⚙️</span>
                  <div>
                    <p className="text-xs font-bold text-[var(--foreground)]">SMTP personalizado</p>
                    <p className="text-[10px] text-[var(--foreground-muted)]">Outlook, Zoho, SendGrid, Amazon SES u otro servidor</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--foreground-muted)]">Servidor SMTP</label>
                    <input type="text" placeholder="smtp.gmail.com  /  smtp.office365.com"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--foreground-muted)]">Puerto</label>
                    <input type="number" placeholder="587" defaultValue={587}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--foreground-muted)]">Seguridad</label>
                    <select className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]">
                      <option>STARTTLS (587)</option>
                      <option>SSL/TLS (465)</option>
                      <option>Sin cifrado (25)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--foreground-muted)]">Usuario / Email remitente</label>
                    <input type="email" placeholder="ventas@tuempresa.com"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--foreground-muted)]">Contraseña de app</label>
                    <input type="password" placeholder="••••••••••••"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]" />
                  </div>
                </div>
                <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] py-2.5 text-xs font-bold text-white hover:opacity-90 transition-colors">
                  <Check className="h-3.5 w-3.5" />
                  Guardar y verificar conexión SMTP
                </button>
              </div>
            </div>

            {/* -- Otras integraciones -- */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <p className="text-sm font-bold text-[var(--foreground)] mb-4">Otras integraciones</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {INTEGRATIONS.map((int) => {
                  const isConnected = connectedApps.includes(int.id);
                  const isComingSoon = int.status === "coming";
                  return (
                    <div key={int.id}
                      className={["rounded-xl border p-4 transition-all", isConnected ? "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.06)]" : "border-[var(--border)] bg-[var(--surface)]"].join(" ")}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{int.logo}</span>
                          <p className="text-xs font-bold text-[var(--foreground)]">{int.name}</p>
                        </div>
                        {isConnected
                          ? <span className="flex items-center gap-1 rounded-full bg-[rgba(16,185,129,0.12)] px-2 py-0.5 text-[10px] font-bold text-[#10B981]"><Check className="h-3 w-3" />Conectado</span>
                          : isComingSoon
                          ? <span className="rounded-full bg-[rgba(245,158,11,0.12)] px-2 py-0.5 text-[9px] font-bold text-[#F59E0B]">PRONTO</span>
                          : null}
                      </div>
                      <p className="text-[11px] text-[var(--foreground-muted)] mb-3">{int.description}</p>
                      <button
                        disabled={isComingSoon}
                        onClick={() => setConnectedApps((p) => isConnected ? p.filter((a) => a !== int.id) : [...p, int.id])}
                        className={["w-full rounded-lg py-1.5 text-[11px] font-semibold transition-colors",
                          isComingSoon ? "cursor-not-allowed bg-[var(--border)] text-[var(--foreground-faint)]"
                          : isConnected ? "border border-[rgba(239,68,68,0.3)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)]"
                          : "bg-gradient-to-r from-[#2563EB] to-[#06B6D4] text-white hover:opacity-90"].join(" ")}
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
