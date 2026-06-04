"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Camera, Check, CheckCircle2, ChevronRight,
  Copy, Eye, EyeOff, Link2, Loader2,
  Mail, Plus, RefreshCw, Shield, ShieldCheck,
  Trash2, Upload, User, Users, Wifi, WifiOff, Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import {
  updateProfile, updateWorkspace,
  upsertLinkedInAccount, disconnectLinkedInAccount,
  updateLinkedInLimits,
  upsertEmailConnection, deleteEmailConnection,
  upsertWebhook, deleteWebhook,
} from "@/app/dashboard/perfil/actions";
import type {
  ProfileData, LinkedInAccountRow, EmailConnectionRow, WebhookRow,
} from "@/app/dashboard/perfil/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "cuenta" | "seguridad" | "conexiones" | "workspace" | "webhooks";

export interface PerfilViewProps {
  initialData: ProfileData;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-3 sm:grid-cols-[160px_1fr]">
      <label className="pt-2 text-sm font-medium text-zinc-600">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 pr-10 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
      <button type="button" onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function StrengthBar({ password }: { password: string }) {
  const score = [
    password.length >= 8, /[A-Z]/.test(password),
    /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const labels = ["", "Débil", "Regular", "Buena", "Fuerte"];
  const colors = ["", "bg-red-400", "bg-amber-400", "bg-yellow-400", "bg-green-500"];
  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= score ? colors[score] : "bg-zinc-100"}`} />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-zinc-400">Contraseña: <span className="font-semibold">{labels[score]}</span></p>
    </div>
  );
}

function InlineError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
      {msg}
    </div>
  );
}

function InlineSuccess({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
      <Check className="h-3.5 w-3.5 flex-shrink-0" />
      {msg}
    </div>
  );
}

// ── PhoneInput ────────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: "PE", dial: "+51",  flag: "🇵🇪", name: "Perú"      },
  { code: "MX", dial: "+52",  flag: "🇲🇽", name: "México"    },
  { code: "CO", dial: "+57",  flag: "🇨🇴", name: "Colombia"  },
  { code: "AR", dial: "+54",  flag: "🇦🇷", name: "Argentina" },
  { code: "CL", dial: "+56",  flag: "🇨🇱", name: "Chile"     },
  { code: "BR", dial: "+55",  flag: "🇧🇷", name: "Brasil"    },
  { code: "EC", dial: "+593", flag: "🇪🇨", name: "Ecuador"   },
  { code: "BO", dial: "+591", flag: "🇧🇴", name: "Bolivia"   },
  { code: "PY", dial: "+595", flag: "🇵🇾", name: "Paraguay"  },
  { code: "UY", dial: "+598", flag: "🇺🇾", name: "Uruguay"   },
  { code: "VE", dial: "+58",  flag: "🇻🇪", name: "Venezuela" },
  { code: "ES", dial: "+34",  flag: "🇪🇸", name: "España"    },
  { code: "US", dial: "+1",   flag: "🇺🇸", name: "USA"       },
  { code: "GB", dial: "+44",  flag: "🇬🇧", name: "UK"        },
  { code: "DE", dial: "+49",  flag: "🇩🇪", name: "Alemania"  },
  { code: "FR", dial: "+33",  flag: "🇫🇷", name: "Francia"   },
  { code: "IT", dial: "+39",  flag: "🇮🇹", name: "Italia"    },
  { code: "PT", dial: "+351", flag: "🇵🇹", name: "Portugal"  },
  { code: "CA", dial: "+1",   flag: "🇨🇦", name: "Canadá"    },
  { code: "AU", dial: "+61",  flag: "🇦🇺", name: "Australia" },
];

type Country = (typeof COUNTRIES)[number];

function flagEmoji(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.flag ?? "🌐";
}

interface PhoneInputProps {
  countryCode: string;
  countryFlag: string;
  phoneNumber: string;
  onCountryChange: (dial: string, flag: string) => void;
  onNumberChange: (n: string) => void;
}

function PhoneInput({ countryCode, countryFlag, phoneNumber, onCountryChange, onNumberChange }: PhoneInputProps) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState("");
  const containerRef          = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = COUNTRIES.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q);
  });

  function select(c: Country) {
    onCountryChange(c.dial, c.code);
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={containerRef} className="relative flex">
      {/* Country selector button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-l-xl border border-r-0 border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 focus:border-indigo-400 focus:outline-none transition-colors"
      >
        <span className="text-base leading-none">{flagEmoji(countryFlag)}</span>
        <span className="font-medium tabular-nums text-zinc-600">{countryCode}</span>
        <svg className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Number input */}
      <input
        type="tel"
        value={phoneNumber}
        onChange={(e) => onNumberChange(e.target.value.replace(/[^\d\s\-()]/g, ""))}
        placeholder="935 356 115"
        className="w-full rounded-r-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
          {/* Search */}
          <div className="border-b border-zinc-100 p-2">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar país o código..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:border-indigo-400 focus:bg-white focus:outline-none"
            />
          </div>
          {/* List */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-400">Sin resultados</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.code + c.dial}
                  type="button"
                  onClick={() => select(c)}
                  className={[
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-indigo-50",
                    c.dial === countryCode && c.code === countryFlag ? "bg-indigo-50 font-semibold" : "",
                  ].join(" ")}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 text-zinc-800">{c.name}</span>
                  <span className="tabular-nums text-xs text-zinc-400">{c.dial}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const AVATARS_BG = [
  "from-indigo-400 to-purple-500",
  "from-blue-400 to-cyan-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-pink-400 to-rose-500",
];

const WEBHOOK_EVENTS = [
  "lead.created", "lead.stage_changed", "message.received", "campaign.completed",
];

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

export function PerfilView({ initialData }: PerfilViewProps) {
  const router     = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab]    = useState<Tab>("cuenta");

  // ── Mi cuenta state ───────────────────────────────────────────────────────
  const [fullName,    setFullName]    = useState(initialData.profile.full_name    ?? "");
  const [jobTitle,    setJobTitle]    = useState(initialData.profile.job_title    ?? "");
  const [company,     setCompany]     = useState(initialData.profile.company      ?? "");
  // Parse stored phone into country code + local number
  const storedPhone = initialData.profile.phone ?? "";
  const parsedDial = COUNTRIES.find((c) => storedPhone.startsWith(c.dial) && c.dial.length > 1)?.dial
    ?? (storedPhone.startsWith("+1") ? "+1" : storedPhone.startsWith("+") ? storedPhone.slice(0, 3) : "+51");
  const parsedFlag = COUNTRIES.find((c) => c.dial === parsedDial)?.code ?? "PE";
  const parsedNumber = storedPhone.startsWith("+") ? storedPhone.slice(parsedDial.length) : storedPhone;

  const [countryCode, setCountryCode] = useState(parsedDial);
  const [countryFlag, setCountryFlag] = useState(parsedFlag);
  const [phoneNumber, setPhoneNumber] = useState(parsedNumber);
  const [avatarGrad,  setAvatarGrad]  = useState(initialData.profile.avatar_gradient ?? 0);
  const [cuentaMsg,   setCuentaMsg]   = useState({ ok: "", err: "" });

  // Detect country via IP geolocation (only when no phone is stored)
  useEffect(() => {
    if (storedPhone) return; // already has a phone — don't override
    fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then((data: { country_calling_code?: string; country_code?: string }) => {
        if (data.country_calling_code && !storedPhone) {
          const dial = data.country_calling_code.startsWith("+")
            ? data.country_calling_code
            : `+${data.country_calling_code}`;
          setCountryCode(dial);
          setCountryFlag(data.country_code ?? "PE");
        }
      })
      .catch(() => setCountryCode("+51"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Seguridad state ───────────────────────────────────────────────────────
  const [currentEmail, setCurrentEmail] = useState(initialData.profile.email ?? "");
  const [newEmail,     setNewEmail]     = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [currentPass,  setCurrentPass]  = useState("");
  const [newPass,      setNewPass]      = useState("");
  const [confirmPass,  setConfirmPass]  = useState("");
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [showTwoFASetup, setShowTwoFASetup] = useState(false);
  const [twoFACode,    setTwoFACode]    = useState("");

  // ── Workspace state ───────────────────────────────────────────────────────
  const [workspaceName, setWorkspaceName] = useState(initialData.workspace?.name ?? "");
  const [timezone,      setTimezone]      = useState(initialData.settings?.timezone ?? "America/Lima");
  const [wsMsg,         setWsMsg]         = useState({ ok: "", err: "" });

  // ── LinkedIn state ────────────────────────────────────────────────────────
  const [liAccounts,   setLiAccounts]   = useState<LinkedInAccountRow[]>(initialData.linkedinAccounts);
  const [showLiForm,   setShowLiForm]   = useState(false);
  const [liName,       setLiName]       = useState("");
  const [liCookie,     setLiCookie]     = useState("");
  const [liMode,       setLiMode]       = useState<"extension" | "cookie">("cookie");
  const [liMsg,        setLiMsg]        = useState({ ok: "", err: "" });
  const [liPolling,    setLiPolling]    = useState(false);

  // Per-account limit editing state
  const [editingLimits, setEditingLimits] = useState<string | null>(null);
  const [limitConn,     setLimitConn]     = useState(20);
  const [limitMsgVal,   setLimitMsgVal]   = useState(30);
  const [ultraSafe,     setUltraSafe]     = useState(false);
  const [limitsMsg,     setLimitsMsg]     = useState({ ok: "", err: "" });

  // Realtime: listen for linkedin_accounts changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("linkedin-account")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "linkedin_accounts" },
        (payload) => {
          const row = (payload.new ?? payload.old) as LinkedInAccountRow;
          if (!row?.id) return;
          if (payload.eventType === "INSERT") {
            setLiAccounts((prev) => prev.some((a) => a.id === row.id) ? prev : [row, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setLiAccounts((prev) => prev.map((a) => a.id === row.id ? { ...a, ...row } : a));
          } else if (payload.eventType === "DELETE") {
            setLiAccounts((prev) => prev.filter((a) => a.id !== row.id));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Polling fallback: refetch every 10s while no active account is detected
  useEffect(() => {
    const hasActive = liAccounts.some((a) => a.status === "active" || a.status === "connected");
    if (hasActive) { setLiPolling(false); return; }
    setLiPolling(true);
    const id = setInterval(() => { router.refresh(); }, 10_000);
    return () => clearInterval(id);
  }, [liAccounts, router]);

  // ── Email connections state ───────────────────────────────────────────────
  const [emailConns,   setEmailConns]   = useState<EmailConnectionRow[]>(initialData.emailConnections);
  const [showSmtp,     setShowSmtp]     = useState(false);
  const [smtpFrom,     setSmtpFrom]     = useState("");
  const [smtpDisplay,  setSmtpDisplay]  = useState("");
  const [smtpHost,     setSmtpHost]     = useState("");
  const [smtpPort,     setSmtpPort]     = useState("587");
  const [smtpUser,     setSmtpUser]     = useState("");
  const [smtpPass,     setSmtpPass]     = useState("");
  const [emailMsg,     setEmailMsg]     = useState({ ok: "", err: "" });

  // ── Webhooks state ────────────────────────────────────────────────────────
  const [webhooks,     setWebhooks]     = useState<WebhookRow[]>(initialData.webhooks);
  const [showWhForm,   setShowWhForm]   = useState(false);
  const [whName,       setWhName]       = useState("");
  const [whUrl,        setWhUrl]        = useState("");
  const [whEvents,     setWhEvents]     = useState<string[]>([]);
  const [whMsg,        setWhMsg]        = useState({ ok: "", err: "" });

  const initials = fullName.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "cuenta",    label: "Mi cuenta",          icon: User    },
    { id: "seguridad", label: "Seguridad",           icon: Shield  },
    { id: "conexiones",label: "Cuentas conectadas", icon: Link2   },
    { id: "workspace", label: "Workspace",           icon: Users   },
    { id: "webhooks",  label: "Webhooks",            icon: Zap     },
  ];

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSaveProfile() {
    setCuentaMsg({ ok: "", err: "" });
    startTransition(async () => {
      const phone = phoneNumber.trim() ? `${countryCode}${phoneNumber.trim()}` : "";
      const res = await updateProfile({ full_name: fullName, job_title: jobTitle, company, phone, avatar_gradient: avatarGrad });
      if (res.success) { setCuentaMsg({ ok: "Perfil guardado", err: "" }); router.refresh(); }
      else              setCuentaMsg({ ok: "", err: res.error ?? "Error al guardar" });
    });
  }

  function handleSaveWorkspace() {
    setWsMsg({ ok: "", err: "" });
    startTransition(async () => {
      const res = await updateWorkspace({ name: workspaceName, timezone });
      if (res.success) { setWsMsg({ ok: "Workspace actualizado", err: "" }); router.refresh(); }
      else              setWsMsg({ ok: "", err: res.error ?? "Error al guardar" });
    });
  }

  function handleConnectLinkedIn() {
    setLiMsg({ ok: "", err: "" });
    startTransition(async () => {
      const res = await upsertLinkedInAccount({ name: liName || "Mi LinkedIn", li_at_cookie: liCookie, connection_mode: liMode });
      if (res.success && res.data) {
        setLiAccounts((prev) => [...prev, res.data!]);
        setShowLiForm(false); setLiName(""); setLiCookie("");
        setLiMsg({ ok: "Cuenta LinkedIn conectada", err: "" });
        router.refresh();
      } else {
        setLiMsg({ ok: "", err: res.error ?? "Error al conectar" });
      }
    });
  }

  function handleDisconnectLinkedIn(id: string) {
    startTransition(async () => {
      const res = await disconnectLinkedInAccount(id);
      if (res.success) {
        setLiAccounts((prev) => prev.map((a) => a.id === id ? { ...a, status: "disconnected", li_at_cookie: null } : a));
        router.refresh();
      }
    });
  }

  function openLimitEditor(acc: LinkedInAccountRow) {
    setEditingLimits(acc.id);
    setLimitConn(ultraSafe ? 10 : (acc.daily_connection_limit ?? 20));
    setLimitMsgVal(acc.daily_message_limit ?? 30);
    setLimitsMsg({ ok: "", err: "" });
  }

  function handleSaveLimits(id: string) {
    setLimitsMsg({ ok: "", err: "" });
    const connLimit = ultraSafe ? Math.min(limitConn, 10) : limitConn;
    startTransition(async () => {
      const res = await updateLinkedInLimits({
        id,
        daily_connection_limit: connLimit,
        daily_message_limit:    limitMsgVal,
      });
      if (res.success && res.data) {
        setLiAccounts((prev) => prev.map((a) => a.id === id ? { ...a, ...res.data! } : a));
        setEditingLimits(null);
        setLimitsMsg({ ok: "Límites guardados", err: "" });
      } else {
        setLimitsMsg({ ok: "", err: res.error ?? "Error al guardar" });
      }
    });
  }

  function handleSaveSmtp() {
    setEmailMsg({ ok: "", err: "" });
    startTransition(async () => {
      const res = await upsertEmailConnection({
        provider: "smtp", email_from: smtpFrom, display_name: smtpDisplay || smtpFrom,
        smtp_host: smtpHost, smtp_port: Number(smtpPort), smtp_user: smtpUser, smtp_password: smtpPass,
        is_default: emailConns.length === 0,
      });
      if (res.success && res.data) {
        setEmailConns((prev) => [...prev, res.data!]);
        setShowSmtp(false); setSmtpFrom(""); setSmtpHost(""); setSmtpUser(""); setSmtpPass("");
        setEmailMsg({ ok: "Email conectado", err: "" });
        router.refresh();
      } else {
        setEmailMsg({ ok: "", err: res.error ?? "Error al guardar" });
      }
    });
  }

  function handleDeleteEmail(id: string) {
    setEmailConns((prev) => prev.filter((e) => e.id !== id)); // optimistic
    startTransition(async () => {
      const res = await deleteEmailConnection(id);
      if (!res.success) {
        setEmailMsg({ ok: "", err: res.error ?? "Error al eliminar" });
        router.refresh(); // revert optimistic
      }
    });
  }

  function handleSaveWebhook() {
    setWhMsg({ ok: "", err: "" });
    startTransition(async () => {
      const res = await upsertWebhook({ name: whName, url: whUrl, events: whEvents, is_active: true });
      if (res.success && res.data) {
        setWebhooks((prev) => [...prev, res.data!]);
        setShowWhForm(false); setWhName(""); setWhUrl(""); setWhEvents([]);
        setWhMsg({ ok: "Webhook guardado", err: "" });
        router.refresh();
      } else {
        setWhMsg({ ok: "", err: res.error ?? "Error al guardar" });
      }
    });
  }

  function handleDeleteWebhook(id: string) {
    setWebhooks((prev) => prev.filter((w) => w.id !== id)); // optimistic
    startTransition(async () => {
      const res = await deleteWebhook(id);
      if (!res.success) {
        setWhMsg({ ok: "", err: res.error ?? "Error al eliminar" });
        router.refresh();
      }
    });
  }

  function handleToggleWebhook(id: string, is_active: boolean) {
    startTransition(async () => {
      const wh = webhooks.find((w) => w.id === id);
      if (!wh) return;
      const res = await upsertWebhook({ id, name: wh.name ?? "", url: wh.url ?? "", events: wh.events ?? [], is_active });
      if (res.success) {
        setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, is_active } : w));
        router.refresh();
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Mi Perfil</h1>
          <p className="text-xs text-zinc-400">Gestiona tu cuenta, seguridad y cuentas conectadas</p>
        </div>
        {activeTab === "cuenta" && (
          <button
            onClick={handleSaveProfile}
            disabled={isPending}
            className={[
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:opacity-60",
              cuentaMsg.ok ? "bg-green-500 text-white" : "bg-zinc-900 text-white hover:bg-zinc-700",
            ].join(" ")}
          >
            {cuentaMsg.ok ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {cuentaMsg.ok ? "Guardado" : isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        )}
        {activeTab === "workspace" && (
          <button
            onClick={handleSaveWorkspace}
            disabled={isPending}
            className={[
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:opacity-60",
              wsMsg.ok ? "bg-green-500 text-white" : "bg-zinc-900 text-white hover:bg-zinc-700",
            ].join(" ")}
          >
            {wsMsg.ok ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {wsMsg.ok ? "Guardado" : isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-shrink-0 gap-1 border-b border-border bg-white px-6">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={[
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-zinc-500 hover:text-zinc-700",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6">

        {/* ═══ TAB: MI CUENTA ═══ */}
        {activeTab === "cuenta" && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-zinc-900">Foto de perfil</h3>
              <div className="flex items-center gap-5">
                <div className={`relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${AVATARS_BG[avatarGrad]} text-2xl font-black text-white shadow-lg`}>
                  {initials}
                  <button className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50">
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-700">Color del avatar</p>
                  <div className="mt-2 flex gap-2">
                    {AVATARS_BG.map((g, i) => (
                      <button key={i} onClick={() => setAvatarGrad(i)}
                        className={`h-7 w-7 rounded-full bg-gradient-to-br ${g} transition-transform ${avatarGrad === i ? "scale-125 ring-2 ring-offset-1 ring-zinc-400" : "hover:scale-110"}`}
                      />
                    ))}
                  </div>
                  <button className="mt-3 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline">
                    <Upload className="h-3.5 w-3.5" />
                    Subir foto personalizada
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h3 className="mb-5 text-sm font-bold text-zinc-900">Información personal</h3>
              <div className="space-y-4">
                <FieldRow label="Nombre completo">
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                </FieldRow>
                <FieldRow label="Cargo">
                  <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Ej: Fundador, VP Ventas..."
                    className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                </FieldRow>
                <FieldRow label="Empresa">
                  <input value={company} onChange={(e) => setCompany(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                </FieldRow>
                <FieldRow label="Teléfono">
                  <PhoneInput
                    countryCode={countryCode}
                    countryFlag={countryFlag}
                    phoneNumber={phoneNumber}
                    onCountryChange={(dial, flag) => { setCountryCode(dial); setCountryFlag(flag); }}
                    onNumberChange={setPhoneNumber}
                  />
                </FieldRow>
              </div>
              <InlineSuccess msg={cuentaMsg.ok} />
              <InlineError   msg={cuentaMsg.err} />
            </div>
          </div>
        )}

        {/* ═══ TAB: SEGURIDAD ═══ */}
        {activeTab === "seguridad" && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Dirección de email</h3>
                  <p className="mt-0.5 text-sm text-zinc-500">{currentEmail}</p>
                </div>
                <button onClick={() => setShowEmailForm((v) => !v)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
                  {showEmailForm ? "Cancelar" : "Cambiar email"}
                </button>
              </div>
              {showEmailForm && (
                <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700">Nuevo email</label>
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="nuevo@email.com"
                      className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                    <p className="text-[12px] text-amber-700">Recibirás un email de confirmación en tu nueva dirección.</p>
                  </div>
                  <button onClick={() => { setCurrentEmail(newEmail || currentEmail); setShowEmailForm(false); }}
                    disabled={!newEmail || newEmail === currentEmail}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40">
                    Enviar confirmación
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-zinc-900">Cambiar contraseña</h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700">Contraseña actual</label>
                  <PasswordInput value={currentPass} onChange={setCurrentPass} placeholder="••••••••" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700">Nueva contraseña</label>
                  <PasswordInput value={newPass} onChange={setNewPass} placeholder="Mínimo 8 caracteres" />
                  <StrengthBar password={newPass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700">Confirmar contraseña</label>
                  <PasswordInput value={confirmPass} onChange={setConfirmPass} placeholder="Repite la contraseña" />
                  {confirmPass && confirmPass !== newPass && (
                    <p className="mt-1 text-[11px] text-red-500">Las contraseñas no coinciden</p>
                  )}
                  {confirmPass && confirmPass === newPass && newPass && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-green-600">
                      <Check className="h-3 w-3" /> Contraseñas coinciden
                    </p>
                  )}
                </div>
                <button disabled={!currentPass || !newPass || newPass !== confirmPass}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-40">
                  Actualizar contraseña
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
                    {twoFAEnabled ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <Shield className="h-5 w-5 text-zinc-400" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">Autenticación de dos factores (2FA)</h3>
                    <p className="text-[12px] text-zinc-400">
                      {twoFAEnabled ? "2FA activo — tu cuenta está protegida." : "Agrega una capa extra con Google Authenticator."}
                    </p>
                  </div>
                </div>
                <button onClick={() => twoFAEnabled ? setTwoFAEnabled(false) : setShowTwoFASetup((v) => !v)}
                  className={["rounded-xl border px-4 py-2 text-xs font-semibold transition-colors",
                    twoFAEnabled ? "border-red-200 text-red-600 hover:bg-red-50" : "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100",
                  ].join(" ")}>
                  {twoFAEnabled ? "Desactivar 2FA" : "Activar 2FA"}
                </button>
              </div>
              {showTwoFASetup && !twoFAEnabled && (
                <div className="mt-5 space-y-4 border-t border-zinc-100 pt-4">
                  <div className="text-[12px] text-zinc-500 space-y-1">
                    <p>1. Instala <strong>Google Authenticator</strong> o <strong>Authy</strong>.</p>
                    <p>2. Escanea el código QR con la app.</p>
                    <p>3. Ingresa el código de 6 dígitos.</p>
                  </div>
                  <div className="flex gap-2">
                    <input value={twoFACode} onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456" maxLength={6}
                      className="w-32 rounded-xl border border-zinc-200 px-4 py-2.5 text-center text-lg font-mono tracking-widest focus:border-indigo-400 focus:outline-none" />
                    <button onClick={() => { if (twoFACode.length === 6) { setTwoFAEnabled(true); setShowTwoFASetup(false); setTwoFACode(""); } }}
                      disabled={twoFACode.length !== 6}
                      className="rounded-xl bg-green-600 px-5 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-40">
                      Verificar y activar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-sm font-bold text-red-700">Zona peligrosa</h3>
              <p className="mb-4 text-[12px] text-zinc-500">Estas acciones son irreversibles. Procede con cuidado.</p>
              <div className="flex flex-wrap gap-3">
                <button className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
                  Cerrar todas las sesiones
                </button>
                <button className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100">
                  Eliminar cuenta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: CUENTAS CONECTADAS ═══ */}
        {activeTab === "conexiones" && (
          <div className="mx-auto max-w-2xl space-y-6">

            {/* ── LinkedIn account card ── */}
            {(() => {
              const activeAcc = liAccounts.find(
                (a) => a.status === "active" || a.status === "connected"
              );

              // ── Connected state ──
              if (activeAcc) {
                const initials2 = (activeAcc.name ?? "LI")
                  .split(" ").filter(Boolean).map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                const isEditing = editingLimits === activeAcc.id;

                return (
                  <div className="rounded-2xl border border-green-200 bg-white shadow-sm overflow-hidden">
                    {/* Header bar */}
                    <div className="flex items-center gap-2 border-b border-green-100 bg-green-50 px-5 py-3">
                      <Wifi className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <p className="flex-1 text-xs font-bold text-green-800">Cuenta LinkedIn conectada</p>
                      <span className="flex items-center gap-1 rounded-full bg-green-200 px-2.5 py-0.5 text-[10px] font-bold text-green-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" />
                        Via Extensión
                      </span>
                    </div>

                    {/* Profile row */}
                    <div className="flex items-center gap-4 px-5 py-4">
                      {activeAcc.avatar_url ? (
                        <img
                          src={activeAcc.avatar_url}
                          alt={activeAcc.name ?? ""}
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-green-200"
                        />
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white ring-2 ring-blue-100">
                          {initials2}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900 truncate">{activeAcc.name ?? "LinkedIn"}</p>
                        {activeAcc.headline && (
                          <p className="text-[11px] text-zinc-500 truncate">{activeAcc.headline}</p>
                        )}
                        {activeAcc.profile_url && (
                          <a href={activeAcc.profile_url} target="_blank" rel="noreferrer"
                            className="text-[10px] text-blue-500 hover:underline">
                            {activeAcc.profile_url}
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => handleDisconnectLinkedIn(activeAcc.id)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-50 transition-colors"
                      >
                        <WifiOff className="h-3.5 w-3.5" />
                        Desconectar
                      </button>
                    </div>

                    {/* Limits section */}
                    <div className="border-t border-zinc-100 px-5 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-zinc-700">Límites diarios</p>
                        {!isEditing && (
                          <button
                            onClick={() => openLimitEditor(activeAcc)}
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            Editar
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                          {/* Ultra-safe toggle */}
                          <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2">
                            <div>
                              <p className="text-xs font-semibold text-zinc-800">Modo Ultra-Safe</p>
                              <p className="text-[10px] text-zinc-400">Máx. 10 conexiones/día</p>
                            </div>
                            <button
                              onClick={() => { setUltraSafe((v) => !v); if (!ultraSafe) setLimitConn(10); }}
                              className={["relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                ultraSafe ? "bg-indigo-500" : "bg-zinc-300"].join(" ")}
                            >
                              <span className={["inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                                ultraSafe ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
                            </button>
                          </div>

                          {/* Connections slider */}
                          <div>
                            <div className="mb-1 flex justify-between">
                              <label className="text-[11px] font-semibold text-zinc-600">Conexiones/día</label>
                              <span className="text-[11px] font-bold text-zinc-900">{limitConn}</span>
                            </div>
                            <input
                              type="range" min={5} max={ultraSafe ? 10 : 50} value={limitConn}
                              onChange={(e) => setLimitConn(Number(e.target.value))}
                              className="w-full accent-indigo-600"
                            />
                            <div className="flex justify-between text-[9px] text-zinc-400">
                              <span>5</span><span>{ultraSafe ? 10 : 50}</span>
                            </div>
                          </div>

                          {/* Messages slider */}
                          <div>
                            <div className="mb-1 flex justify-between">
                              <label className="text-[11px] font-semibold text-zinc-600">Mensajes/día</label>
                              <span className="text-[11px] font-bold text-zinc-900">{limitMsgVal}</span>
                            </div>
                            <input
                              type="range" min={5} max={100} value={limitMsgVal}
                              onChange={(e) => setLimitMsgVal(Number(e.target.value))}
                              className="w-full accent-indigo-600"
                            />
                            <div className="flex justify-between text-[9px] text-zinc-400">
                              <span>5</span><span>100</span>
                            </div>
                          </div>

                          {limitsMsg.err && <InlineError msg={limitsMsg.err} />}

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveLimits(activeAcc.id)}
                              disabled={isPending}
                              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              Guardar límites
                            </button>
                            <button
                              onClick={() => setEditingLimits(null)}
                              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-500 hover:bg-white"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-center">
                            <p className="text-xl font-black tabular-nums text-zinc-900">
                              {activeAcc.daily_connection_limit ?? 20}
                            </p>
                            <p className="text-[10px] text-zinc-400">conexiones/día</p>
                          </div>
                          <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-center">
                            <p className="text-xl font-black tabular-nums text-zinc-900">
                              {activeAcc.daily_message_limit ?? 30}
                            </p>
                            <p className="text-[10px] text-zinc-400">mensajes/día</p>
                          </div>
                        </div>
                      )}

                      {limitsMsg.ok && !isEditing && <InlineSuccess msg={limitsMsg.ok} />}
                    </div>
                  </div>
                );
              }

              // ── No account detected ──
              return (
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                  {/* Waiting header */}
                  <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-5 py-3">
                    <WifiOff className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                    <p className="flex-1 text-xs font-semibold text-zinc-600">Sin cuenta LinkedIn detectada</p>
                    {liPolling && (
                      <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                        <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                        Esperando detección…
                      </span>
                    )}
                  </div>

                  {/* Step-by-step instructions */}
                  <div className="px-5 py-5 space-y-4">
                    <p className="text-xs text-zinc-500">
                      La cuenta se detecta automáticamente cuando inicias sesión en LinkedIn con la extensión instalada.
                    </p>
                    {[
                      { n: 1, title: "Instala la extensión NexusAI Chrome", desc: "Disponible en la Chrome Web Store" },
                      { n: 2, title: "Inicia sesión en la extensión",       desc: "Usa tu email y contraseña de NexusAI" },
                      { n: 3, title: "Visita linkedin.com",                  desc: "La cuenta se detecta y sincroniza automáticamente" },
                    ].map((step) => (
                      <div key={step.n} className="flex items-start gap-3">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                          {step.n}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-zinc-800">{step.title}</p>
                          <p className="text-[11px] text-zinc-400">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Manual fallback */}
                  <div className="border-t border-zinc-100 px-5 py-3">
                    <button
                      onClick={() => setShowLiForm((v) => !v)}
                      className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700"
                    >
                      {showLiForm ? "Cancelar" : "Conectar manualmente con cookie li_at →"}
                    </button>

                    {showLiForm && (
                      <div className="mt-3 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Nombre de la cuenta</label>
                            <input value={liName} onChange={(e) => setLiName(e.target.value)}
                              placeholder="Ej: LinkedIn Personal"
                              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Modo</label>
                            <select value={liMode} onChange={(e) => setLiMode(e.target.value as "extension" | "cookie")}
                              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none">
                              <option value="cookie">Cookie li_at</option>
                              <option value="extension">Extensión Chrome</option>
                            </select>
                          </div>
                        </div>
                        {liMode === "cookie" && (
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Cookie li_at</label>
                            <input type="password" value={liCookie} onChange={(e) => setLiCookie(e.target.value)}
                              placeholder="AQEDATb…"
                              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-mono focus:border-indigo-400 focus:outline-none" />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={handleConnectLinkedIn}
                            disabled={isPending || (liMode === "cookie" && liCookie.length < 20)}
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40">
                            {isPending ? "Conectando…" : "Conectar"}
                          </button>
                          <button onClick={() => setShowLiForm(false)}
                            className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-500 hover:bg-white">
                            Cancelar
                          </button>
                        </div>
                        <InlineSuccess msg={liMsg.ok} />
                        <InlineError   msg={liMsg.err} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Email connections */}
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Cuentas de Email</h3>
                  <p className="text-[12px] text-zinc-400">{emailConns.length} configuradas</p>
                </div>
                <button onClick={() => setShowSmtp((v) => !v)}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">
                  <Plus className="h-3.5 w-3.5" />
                  Agregar SMTP
                </button>
              </div>

              {emailConns.map((conn) => (
                <div key={conn.id} className="mb-3 flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
                      <Mail className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{conn.display_name ?? conn.email_from}</p>
                      <p className="text-[11px] text-zinc-400">{conn.email_from} · {conn.provider?.toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {conn.is_default && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">Default</span>
                    )}
                    <button onClick={() => handleDeleteEmail(conn.id)} disabled={isPending}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {showSmtp && (
                <div className="mt-3 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-700">Nombre visible</label>
                      <input value={smtpDisplay} onChange={(e) => setSmtpDisplay(e.target.value)} placeholder="Ej: Marketing"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-700">Email de envío</label>
                      <input value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder="hola@empresa.com"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-700">Host SMTP</label>
                      <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-700">Puerto</label>
                      <input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-700">Usuario</label>
                      <input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="usuario@gmail.com"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-700">Contraseña / App password</label>
                      <input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveSmtp} disabled={isPending || !smtpFrom || !smtpHost}
                      className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-40">
                      {isPending ? "Guardando…" : "Guardar SMTP"}
                    </button>
                    <button onClick={() => setShowSmtp(false)}
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-500 hover:bg-white">
                      Cancelar
                    </button>
                  </div>
                  <InlineSuccess msg={emailMsg.ok} />
                  <InlineError   msg={emailMsg.err} />
                </div>
              )}
              {!showSmtp && (emailMsg.ok || emailMsg.err) && (
                <><InlineSuccess msg={emailMsg.ok} /><InlineError msg={emailMsg.err} /></>
              )}
            </div>
          </div>
        )}

        {/* ═══ TAB: WORKSPACE ═══ */}
        {activeTab === "workspace" && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-zinc-900">Configuración del workspace</h3>
              <div className="space-y-4">
                <FieldRow label="Nombre del workspace">
                  <input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                </FieldRow>
                <FieldRow label="Zona horaria">
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none">
                    <option value="America/Lima">America/Lima (UTC-5)</option>
                    <option value="America/Bogota">America/Bogota (UTC-5)</option>
                    <option value="America/Mexico_City">America/Mexico_City (UTC-6)</option>
                    <option value="America/Santiago">America/Santiago (UTC-4)</option>
                    <option value="America/Buenos_Aires">America/Buenos_Aires (UTC-3)</option>
                    <option value="America/New_York">America/New_York (UTC-5)</option>
                    <option value="Europe/Madrid">Europe/Madrid (UTC+1)</option>
                  </select>
                </FieldRow>
              </div>
              <InlineSuccess msg={wsMsg.ok} />
              <InlineError   msg={wsMsg.err} />
            </div>

            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Plan activo</h3>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-700">
                      {(initialData.workspace?.plan_type ?? "growth").toUpperCase()}
                    </span>
                  </div>
                </div>
                <button className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-200 hover:opacity-90">
                  <Zap className="h-3.5 w-3.5" />
                  Mejorar a Pro
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-zinc-900">Miembros del equipo</h3>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">Plan Enterprise</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 py-8 text-center">
                <Users className="mb-2 h-7 w-7 text-zinc-300" />
                <p className="text-sm text-zinc-400">La colaboración multi-usuario está disponible en Enterprise</p>
                <button className="mt-3 flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700">
                  <ChevronRight className="h-3.5 w-3.5" />
                  Explorar Enterprise
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: WEBHOOKS ═══ */}
        {activeTab === "webhooks" && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Webhooks</h3>
                  <p className="text-[12px] text-zinc-400">Recibe notificaciones en tiempo real cuando ocurran eventos en NexusAI</p>
                </div>
                <button onClick={() => setShowWhForm((v) => !v)}
                  className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo webhook
                </button>
              </div>

              {webhooks.length === 0 && !showWhForm && (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 py-10 text-center">
                  <Zap className="mb-2 h-7 w-7 text-zinc-300" />
                  <p className="text-sm text-zinc-400">Aún no tienes webhooks configurados</p>
                  <p className="text-[12px] text-zinc-300">Agrega uno para recibir eventos en tu servidor</p>
                </div>
              )}

              {webhooks.map((wh) => (
                <div key={wh.id} className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-zinc-900">{wh.name}</p>
                        <span className={["rounded-full px-2 py-0.5 text-[10px] font-bold",
                          wh.is_active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500",
                        ].join(" ")}>
                          {wh.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-zinc-400">{wh.url}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(wh.events ?? []).map((ev) => (
                          <span key={ev} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">{ev}</span>
                        ))}
                      </div>
                      {wh.secret_token && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="font-mono text-[11px] text-zinc-400">
                            {wh.secret_token.slice(0, 8)}{"•".repeat(12)}
                          </span>
                          <button
                            onClick={() => navigator.clipboard.writeText(wh.secret_token!)}
                            className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-white"
                          >
                            <Copy className="h-3 w-3" />
                            Copiar token
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Toggle activo */}
                      <button
                        onClick={() => handleToggleWebhook(wh.id, !wh.is_active)}
                        disabled={isPending}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${wh.is_active ? "bg-indigo-600" : "bg-zinc-300"}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${wh.is_active ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                      <button onClick={() => handleDeleteWebhook(wh.id)} disabled={isPending}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {showWhForm && (
                <div className="mt-3 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-700">Nombre</label>
                      <input value={whName} onChange={(e) => setWhName(e.target.value)} placeholder="Ej: CRM Webhook"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-700">URL del endpoint</label>
                      <input value={whUrl} onChange={(e) => setWhUrl(e.target.value)} placeholder="https://mi-servidor.com/webhook"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-zinc-700">Eventos</label>
                    <div className="flex flex-wrap gap-2">
                      {WEBHOOK_EVENTS.map((ev) => (
                        <button key={ev}
                          onClick={() => setWhEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev])}
                          className={["rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                            whEvents.includes(ev)
                              ? "border-indigo-400 bg-indigo-600 text-white"
                              : "border-zinc-200 bg-white text-zinc-600 hover:border-indigo-300",
                          ].join(" ")}>
                          {ev}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveWebhook} disabled={isPending || !whName || !whUrl || whEvents.length === 0}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40">
                      {isPending ? "Guardando…" : "Guardar webhook"}
                    </button>
                    <button onClick={() => setShowWhForm(false)}
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-500 hover:bg-white">
                      Cancelar
                    </button>
                  </div>
                  <InlineSuccess msg={whMsg.ok} />
                  <InlineError   msg={whMsg.err} />
                </div>
              )}
              {!showWhForm && (whMsg.ok || whMsg.err) && (
                <><InlineSuccess msg={whMsg.ok} /><InlineError msg={whMsg.err} /></>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
