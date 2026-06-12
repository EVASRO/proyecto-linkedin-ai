"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Ban, Camera, Check, CheckCircle2,
  ChevronRight, Eye, EyeOff, Link2, Loader2,
  Mail, Plus, RefreshCw, Shield, ShieldCheck,
  Trash2, Upload, User, Users, Wifi, WifiOff, Zap,
  Clock, Globe, ToggleLeft, Inbox,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import {
  updateProfile, updateWorkspace, updateWorkspaceSettings,
  upsertLinkedInAccount,
  upsertEmailConnection, deleteEmailConnection,
  addBlacklistEntry, bulkAddBlacklistEntries, removeBlacklistEntry,
} from "@/app/dashboard/perfil/actions";
import type {
  ProfileData, LinkedInAccountRow, EmailConnectionRow,
  BlacklistEntryRow,
} from "@/app/dashboard/perfil/actions";
import { LinkedInAccountCard } from "@/components/settings/LinkedInAccountCard";
import { WebhooksSettings } from "@/components/settings/WebhooksSettings";

// -- Types ---------------------------------------------------------------------

type Section =
  | "cuenta"
  | "seguridad"
  | "linkedin"
  | "email"
  | "limites"
  | "blacklist"
  | "webhooks"
  | "workspace";

export interface PerfilViewProps {
  initialData: ProfileData;
}

// -- Small helpers --------------------------------------------------------------

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-3 sm:grid-cols-[160px_1fr]">
      <label className="pt-2 text-sm font-medium text-zinc-600">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function PasswordInput({
  value, onChange, placeholder,
}: {
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
      <p className="mt-1 text-[11px] text-zinc-400">
        Contraseña: <span className="font-semibold">{labels[score]}</span>
      </p>
    </div>
  );
}

function Toggle({
  checked, onChange, disabled,
}: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} disabled={disabled}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-indigo-600" : "bg-zinc-300",
      ].join(" ")}
    >
      <span className={[
        "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
        checked ? "translate-x-4" : "translate-x-0.5",
      ].join(" ")} />
    </button>
  );
}

function Toast({ msg, type }: { msg: string; type: "ok" | "err" }) {
  if (!msg) return null;
  return (
    <div className={[
      "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
      type === "ok"
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-red-200 bg-red-50 text-red-600",
    ].join(" ")}>
      {type === "ok"
        ? <Check className="h-3.5 w-3.5 shrink-0" />
        : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
      {msg}
    </div>
  );
}

function SectionCard({
  title, description, badge, dirty, children,
}: {
  title: string;
  description?: string;
  badge?: { label: string; ok: boolean };
  dirty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
            {dirty && (
              <span className="h-2 w-2 rounded-full bg-orange-400" title="Cambios sin guardar" />
            )}
          </div>
          {description && <p className="mt-0.5 text-[12px] text-zinc-400">{description}</p>}
        </div>
        {badge && (
          <span className={[
            "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold",
            badge.ok
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-zinc-200 bg-zinc-50 text-zinc-500",
          ].join(" ")}>
            {badge.label}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// -- Phone Input ----------------------------------------------------------------

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
];

type Country = (typeof COUNTRIES)[number];
function flagEmoji(code: string) { return COUNTRIES.find((c) => c.code === code)?.flag ?? "🌐"; }

function PhoneInput({
  countryCode, countryFlag, phoneNumber, onCountryChange, onNumberChange,
}: {
  countryCode: string; countryFlag: string; phoneNumber: string;
  onCountryChange: (dial: string, flag: string) => void;
  onNumberChange: (n: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const filtered = COUNTRIES.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q);
  });

  function select(c: Country) { onCountryChange(c.dial, c.code); setOpen(false); setSearch(""); }

  return (
    <div ref={ref} className="relative flex">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex shrink-0 items-center gap-1.5 rounded-l-xl border border-r-0 border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 focus:border-indigo-400 focus:outline-none">
        <span className="text-base leading-none">{flagEmoji(countryFlag)}</span>
        <span className="font-medium tabular-nums text-zinc-600">{countryCode}</span>
        <svg className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      <input type="tel" value={phoneNumber}
        onChange={(e) => onNumberChange(e.target.value.replace(/[^\d\s\-()]/g, ""))}
        placeholder="935 356 115"
        className="w-full rounded-r-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
          <div className="border-b border-zinc-100 p-2">
            <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar país..." className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:border-indigo-400 focus:bg-white focus:outline-none" />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.map((c) => (
              <button key={c.code + c.dial} type="button" onClick={() => select(c)}
                className={["flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-indigo-50",
                  c.dial === countryCode && c.code === countryFlag ? "bg-indigo-50 font-semibold" : ""].join(" ")}>
                <span className="text-base leading-none">{c.flag}</span>
                <span className="flex-1 text-zinc-800">{c.name}</span>
                <span className="tabular-nums text-xs text-zinc-400">{c.dial}</span>
              </button>
            ))}
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

const TIMEZONES = [
  "America/Lima", "America/Bogota", "America/Mexico_City", "America/Santiago",
  "America/Buenos_Aires", "America/Caracas", "America/Guayaquil",
  "America/New_York", "America/Los_Angeles", "Europe/Madrid", "Europe/London",
  "Asia/Tokyo",
];

const EMAIL_PROVIDERS: { type: string; label: string; badge?: string; desc: string }[] = [
  { type: "smtp",     label: "SMTP",     desc: "Gmail, Outlook, cualquier servidor" },
  { type: "sendgrid", label: "SendGrid", desc: "Popular en startups, 100/día gratis" },
  { type: "resend",   label: "Resend",   badge: "Recomendado", desc: "Gratis hasta 3.000/mes" },
];

// -- Nav item -------------------------------------------------------------------

interface NavItem {
  id: Section;
  label: string;
  icon: React.ElementType;
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "cuenta",    label: "Mi cuenta",     icon: User,        group: "Perfil"         },
  { id: "seguridad", label: "Seguridad",      icon: Shield,      group: "Perfil"         },
  { id: "workspace", label: "Workspace",      icon: Users,       group: "Perfil"         },
  { id: "linkedin",  label: "LinkedIn",       icon: Wifi,        group: "Integraciones"  },
  { id: "email",     label: "Email",          icon: Mail,        group: "Integraciones"  },
  { id: "limites",   label: "Límites",        icon: ToggleLeft,  group: "Seguridad"      },
  { id: "blacklist", label: "Blacklist",      icon: Ban,         group: "Seguridad"      },
  { id: "webhooks",  label: "Webhooks",       icon: Zap,         group: "Desarrolladores"},
];

// -- MAIN COMPONENT -------------------------------------------------------------

export function PerfilView({ initialData }: PerfilViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeSection, setActiveSection] = useState<Section>("cuenta");

  // -- Mi cuenta --------------------------------------------------------------
  const [fullName,   setFullName]   = useState(initialData.profile.full_name   ?? "");
  const [jobTitle,   setJobTitle]   = useState(initialData.profile.job_title   ?? "");
  const [company,    setCompany]    = useState(initialData.profile.company     ?? "");
  const storedPhone = initialData.profile.phone ?? "";
  const parsedDial  = COUNTRIES.find((c) => storedPhone.startsWith(c.dial) && c.dial.length > 1)?.dial
    ?? (storedPhone.startsWith("+1") ? "+1" : "+51");
  const parsedFlag   = COUNTRIES.find((c) => c.dial === parsedDial)?.code ?? "PE";
  const parsedNumber = storedPhone.startsWith("+") ? storedPhone.slice(parsedDial.length) : storedPhone;
  const [countryCode, setCountryCode] = useState(parsedDial);
  const [countryFlag, setCountryFlag] = useState(parsedFlag);
  const [phoneNumber, setPhoneNumber] = useState(parsedNumber);
  const [avatarGrad,  setAvatarGrad]  = useState(initialData.profile.avatar_gradient ?? 0);
  const [cuentaMsg,   setCuentaMsg]   = useState({ ok: "", err: "" });
  const [cuentaDirty, setCuentaDirty] = useState(false);

  useEffect(() => {
    if (storedPhone) return;
    fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then((d: { country_calling_code?: string; country_code?: string }) => {
        if (d.country_calling_code) {
          const dial = d.country_calling_code.startsWith("+") ? d.country_calling_code : `+${d.country_calling_code}`;
          setCountryCode(dial);
          setCountryFlag(d.country_code ?? "PE");
        }
      })
      .catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- Seguridad --------------------------------------------------------------
  const [currentEmail, setCurrentEmail] = useState(initialData.profile.email ?? "");
  const [newEmail,     setNewEmail]     = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [currentPass,  setCurrentPass]  = useState("");
  const [newPass,      setNewPass]      = useState("");
  const [confirmPass,  setConfirmPass]  = useState("");
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [showTwoFA,    setShowTwoFA]    = useState(false);
  const [twoFACode,    setTwoFACode]    = useState("");

  // -- Workspace --------------------------------------------------------------
  const [workspaceName, setWorkspaceName] = useState(initialData.workspace?.name ?? "");
  const [wsMsg,         setWsMsg]         = useState({ ok: "", err: "" });
  const [wsDirty,       setWsDirty]       = useState(false);

  // -- LinkedIn ---------------------------------------------------------------
  const [liAccounts,  setLiAccounts]  = useState<LinkedInAccountRow[]>(initialData.linkedinAccounts);
  const [showLiForm,  setShowLiForm]  = useState(false);
  const [liName,      setLiName]      = useState("");
  const [liCookie,    setLiCookie]    = useState("");
  const [liMode,      setLiMode]      = useState<"extension" | "cookie">("cookie");
  const [liMsg,       setLiMsg]       = useState({ ok: "", err: "" });
  const [liPolling,   setLiPolling]   = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("perfil-li")
      .on("postgres_changes", { event: "*", schema: "public", table: "linkedin_accounts" }, (p) => {
        const row = (p.new ?? p.old) as LinkedInAccountRow;
        if (!row?.id) return;
        if (p.eventType === "INSERT") setLiAccounts((prev) => prev.some((a) => a.id === row.id) ? prev : [row, ...prev]);
        else if (p.eventType === "UPDATE") setLiAccounts((prev) => prev.map((a) => a.id === row.id ? { ...a, ...row } : a));
        else if (p.eventType === "DELETE") setLiAccounts((prev) => prev.filter((a) => a.id !== row.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const hasActive = liAccounts.some((a) => a.status === "active" || a.status === "connected");
    if (hasActive) { setLiPolling(false); return; }
    setLiPolling(true);
    const id = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(id);
  }, [liAccounts, router]);

  // -- Email ------------------------------------------------------------------
  const [emailConns,  setEmailConns]  = useState<EmailConnectionRow[]>(initialData.emailConnections);
  const [emailTab,    setEmailTab]    = useState<"smtp" | "sendgrid" | "resend">("smtp");
  const [showEmailSetup, setShowEmailSetup] = useState(false);
  const [smtpFrom,    setSmtpFrom]    = useState("");
  const [smtpDisplay, setSmtpDisplay] = useState("");
  const [smtpHost,    setSmtpHost]    = useState("");
  const [smtpPort,    setSmtpPort]    = useState("587");
  const [smtpUser,    setSmtpUser]    = useState("");
  const [smtpPass,    setSmtpPass]    = useState("");
  const [apiKey,      setApiKey]      = useState("");
  const [emailMsg,    setEmailMsg]    = useState({ ok: "", err: "" });

  // -- Límites ----------------------------------------------------------------
  const s = initialData.settings;
  const [connLimit,       setConnLimit]       = useState(s?.daily_connections_limit ?? 30);
  const [msgLimit,        setMsgLimit]        = useState(s?.daily_messages_limit ?? 50);
  const [visitLimit,      setVisitLimit]      = useState(100);
  const [ultraSafe,       setUltraSafe]       = useState(s?.ultra_safe_mode ?? false);
  const [pauseWeekends,   setPauseWeekends]   = useState(s?.pause_on_weekends ?? true);
  const [hoursStart,      setHoursStart]      = useState(s?.active_hours_start ?? 8);
  const [hoursEnd,        setHoursEnd]        = useState(s?.active_hours_end ?? 20);
  const [timezone,        setTimezone]        = useState(s?.timezone ?? "America/Lima");
  const [limitsDirty,     setLimitsDirty]     = useState(false);
  const [limitsMsg,       setLimitsMsg]       = useState({ ok: "", err: "" });

  // -- Blacklist --------------------------------------------------------------
  const [blEntries,     setBlEntries]     = useState<BlacklistEntryRow[]>(initialData.blacklist);
  const [blInput,       setBlInput]       = useState("");
  const [blBulk,        setBlBulk]        = useState("");
  const [showBulk,      setShowBulk]      = useState(false);
  const [blMsg,         setBlMsg]         = useState({ ok: "", err: "" });
  const [deletingBlId,  setDeletingBlId]  = useState<string | null>(null);

  // -- Helpers ----------------------------------------------------------------
  const initials = fullName.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
  const activeAccount = liAccounts.find((a) => a.status === "active" || a.status === "connected");
  const emailConfigured = emailConns.length > 0;

  // -- Handlers ---------------------------------------------------------------

  function handleSaveProfile() {
    setCuentaMsg({ ok: "", err: "" });
    startTransition(async () => {
      const phone = phoneNumber.trim() ? `${countryCode}${phoneNumber.trim()}` : "";
      const res = await updateProfile({ full_name: fullName, job_title: jobTitle, company, phone, avatar_gradient: avatarGrad });
      if (res.success) { setCuentaMsg({ ok: "Perfil guardado", err: "" }); setCuentaDirty(false); router.refresh(); }
      else             setCuentaMsg({ ok: "", err: res.error ?? "Error al guardar" });
    });
  }

  function handleSaveWorkspace() {
    setWsMsg({ ok: "", err: "" });
    startTransition(async () => {
      const res = await updateWorkspace({ name: workspaceName, timezone });
      if (res.success) { setWsMsg({ ok: "Workspace actualizado", err: "" }); setWsDirty(false); router.refresh(); }
      else             setWsMsg({ ok: "", err: res.error ?? "Error al guardar" });
    });
  }

  function handleConnectLinkedIn() {
    setLiMsg({ ok: "", err: "" });
    startTransition(async () => {
      const res = await upsertLinkedInAccount({ name: liName || "Mi LinkedIn", li_at_cookie: liCookie, connection_mode: liMode });
      if (res.success && res.data) {
        setLiAccounts((prev) => [...prev, res.data!]);
        setShowLiForm(false); setLiName(""); setLiCookie("");
        setLiMsg({ ok: "Cuenta conectada", err: "" });
        router.refresh();
      } else {
        setLiMsg({ ok: "", err: res.error ?? "Error al conectar" });
      }
    });
  }

  function handleSaveEmail() {
    setEmailMsg({ ok: "", err: "" });
    startTransition(async () => {
      const isApiProvider = emailTab === "sendgrid" || emailTab === "resend";
      const res = await upsertEmailConnection({
        provider:      emailTab,
        email_from:    smtpFrom,
        display_name:  smtpDisplay || smtpFrom,
        smtp_host:     isApiProvider ? undefined : smtpHost,
        smtp_port:     isApiProvider ? undefined : Number(smtpPort),
        smtp_user:     isApiProvider ? undefined : smtpUser,
        smtp_password: isApiProvider ? apiKey : smtpPass,
        is_default:    emailConns.length === 0,
      });
      if (res.success && res.data) {
        setEmailConns((prev) => [...prev, res.data!]);
        setShowEmailSetup(false);
        setSmtpFrom(""); setSmtpHost(""); setSmtpUser(""); setSmtpPass(""); setApiKey("");
        setEmailMsg({ ok: "Email configurado", err: "" });
        router.refresh();
      } else {
        setEmailMsg({ ok: "", err: res.error ?? "Error al guardar" });
      }
    });
  }

  function handleDeleteEmail(id: string) {
    setEmailConns((prev) => prev.filter((e) => e.id !== id));
    startTransition(async () => {
      const res = await deleteEmailConnection(id);
      if (!res.success) { setEmailMsg({ ok: "", err: res.error ?? "Error al eliminar" }); router.refresh(); }
    });
  }

  function handleSaveLimits() {
    setLimitsMsg({ ok: "", err: "" });
    const effective = ultraSafe
      ? { daily_connections_limit: Math.round(connLimit * 0.5), daily_messages_limit: Math.round(msgLimit * 0.5) }
      : { daily_connections_limit: connLimit, daily_messages_limit: msgLimit };
    startTransition(async () => {
      const res = await updateWorkspaceSettings({
        ...effective,
        daily_visits_limit: visitLimit,
        ultra_safe_mode:    ultraSafe,
        pause_on_weekends:  pauseWeekends,
        active_hours_start: hoursStart,
        active_hours_end:   hoursEnd,
        timezone,
      });
      if (res.success) { setLimitsMsg({ ok: "Límites guardados", err: "" }); setLimitsDirty(false); }
      else             setLimitsMsg({ ok: "", err: res.error ?? "Error al guardar" });
    });
  }

  function handleAddBlacklist() {
    const line = blInput.trim();
    if (!line) return;
    setBlMsg({ ok: "", err: "" });
    const isLinkedIn = line.includes("linkedin.com") || line.includes("/in/");
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line);
    if (!isLinkedIn && !isEmail) { setBlMsg({ ok: "", err: "Ingresa una URL de LinkedIn o un email válido" }); return; }
    startTransition(async () => {
      const res = await addBlacklistEntry(
        isLinkedIn ? { linkedin_url: line } : { email: line }
      );
      if (res.success && res.data) { setBlEntries((prev) => [res.data!, ...prev]); setBlInput(""); }
      else setBlMsg({ ok: "", err: res.error ?? "Error al agregar" });
    });
  }

  function handleBulkImport() {
    const lines = blBulk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setBlMsg({ ok: "", err: "" });
    startTransition(async () => {
      const res = await bulkAddBlacklistEntries(lines);
      if (res.success && res.data) {
        setBlMsg({ ok: `${res.data.inserted} entradas importadas, ${res.data.skipped} omitidas`, err: "" });
        setBlBulk("");
        setShowBulk(false);
        router.refresh();
      } else {
        setBlMsg({ ok: "", err: res.error ?? "Error al importar" });
      }
    });
  }

  function handleRemoveBlacklist(id: string) {
    setDeletingBlId(id);
    startTransition(async () => {
      const res = await removeBlacklistEntry(id);
      if (res.success) setBlEntries((prev) => prev.filter((e) => e.id !== id));
      else setBlMsg({ ok: "", err: res.error ?? "Error al eliminar" });
      setDeletingBlId(null);
    });
  }

  // -- Nav group helpers ------------------------------------------------------
  const groups = Array.from(new Set(NAV_ITEMS.map((n) => n.group)));

  // -- Render -----------------------------------------------------------------

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Top header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Configuración</h1>
          <p className="text-xs text-zinc-400">Gestiona tu cuenta, integraciones y seguridad</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* -- Left sidebar nav -- */}
        <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-white py-4 md:block">
          {groups.map((group) => (
            <div key={group} className="mb-4">
              <p className="mb-1 px-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{group}</p>
              {NAV_ITEMS.filter((n) => n.group === group).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={[
                    "flex w-full items-center gap-2.5 rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-all",
                    activeSection === id
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700",
                  ].join(" ")}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${activeSection === id ? "text-indigo-600" : "text-zinc-400"}`} />
                  {label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* -- Content -- */}
        <main className="flex-1 overflow-y-auto bg-zinc-50/50 p-6">
          <div className="mx-auto max-w-2xl space-y-6">

            {/* --- MI CUENTA --- */}
            {activeSection === "cuenta" && (
              <>
                <SectionCard title="Foto de perfil" dirty={cuentaDirty}>
                  <div className="flex items-center gap-5">
                    <div className={`relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${AVATARS_BG[avatarGrad]} text-2xl font-black text-white shadow-lg`}>
                      {initials}
                      <button className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-md hover:bg-zinc-50">
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-700">Color del avatar</p>
                      <div className="mt-2 flex gap-2">
                        {AVATARS_BG.map((g, i) => (
                          <button key={i} onClick={() => { setAvatarGrad(i); setCuentaDirty(true); }}
                            className={`h-7 w-7 rounded-full bg-gradient-to-br ${g} transition-transform ${avatarGrad === i ? "scale-125 ring-2 ring-offset-1 ring-zinc-400" : "hover:scale-110"}`} />
                        ))}
                      </div>
                      <button className="mt-3 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline">
                        <Upload className="h-3.5 w-3.5" />
                        Subir foto personalizada
                      </button>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Información personal" dirty={cuentaDirty}>
                  <div className="space-y-4">
                    <FieldRow label="Nombre completo">
                      <input value={fullName} onChange={(e) => { setFullName(e.target.value); setCuentaDirty(true); }}
                        className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                    </FieldRow>
                    <FieldRow label="Cargo">
                      <input value={jobTitle} onChange={(e) => { setJobTitle(e.target.value); setCuentaDirty(true); }}
                        placeholder="Ej: Fundador, VP Ventas..."
                        className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                    </FieldRow>
                    <FieldRow label="Empresa">
                      <input value={company} onChange={(e) => { setCompany(e.target.value); setCuentaDirty(true); }}
                        className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                    </FieldRow>
                    <FieldRow label="Teléfono">
                      <PhoneInput countryCode={countryCode} countryFlag={countryFlag} phoneNumber={phoneNumber}
                        onCountryChange={(d, f) => { setCountryCode(d); setCountryFlag(f); setCuentaDirty(true); }}
                        onNumberChange={(n) => { setPhoneNumber(n); setCuentaDirty(true); }} />
                    </FieldRow>
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <button onClick={handleSaveProfile} disabled={isPending || !cuentaDirty}
                      className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-700 disabled:opacity-40">
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {cuentaMsg.ok ? "Guardado" : "Guardar cambios"}
                    </button>
                    <Toast msg={cuentaMsg.ok || cuentaMsg.err} type={cuentaMsg.ok ? "ok" : "err"} />
                  </div>
                </SectionCard>
              </>
            )}

            {/* --- SEGURIDAD --- */}
            {activeSection === "seguridad" && (
              <>
                <SectionCard title="Dirección de email">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-500">{currentEmail}</p>
                    <button onClick={() => setShowEmailForm((v) => !v)}
                      className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
                      {showEmailForm ? "Cancelar" : "Cambiar email"}
                    </button>
                  </div>
                  {showEmailForm && (
                    <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
                      <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="nuevo@email.com"
                        className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                        <p className="text-[12px] text-amber-700">Recibirás confirmación en tu nueva dirección.</p>
                      </div>
                      <button onClick={() => { setCurrentEmail(newEmail || currentEmail); setShowEmailForm(false); }}
                        disabled={!newEmail || newEmail === currentEmail}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40">
                        Enviar confirmación
                      </button>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Cambiar contraseña">
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
                </SectionCard>

                <SectionCard title="Autenticación de dos factores (2FA)">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
                        {twoFAEnabled ? <ShieldCheck className="h-5 w-5 text-green-600" /> : <Shield className="h-5 w-5 text-zinc-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {twoFAEnabled ? "2FA activo — cuenta protegida" : "Agrega una capa extra con Google Authenticator"}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => twoFAEnabled ? setTwoFAEnabled(false) : setShowTwoFA((v) => !v)}
                      className={["rounded-xl border px-4 py-2 text-xs font-semibold transition-colors",
                        twoFAEnabled ? "border-red-200 text-red-600 hover:bg-red-50" : "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100",
                      ].join(" ")}>
                      {twoFAEnabled ? "Desactivar 2FA" : "Activar 2FA"}
                    </button>
                  </div>
                  {showTwoFA && !twoFAEnabled && (
                    <div className="mt-5 space-y-4 border-t border-zinc-100 pt-4">
                      <ol className="space-y-1 text-[12px] text-zinc-500">
                        <li>1. Instala <strong>Google Authenticator</strong> o <strong>Authy</strong>.</li>
                        <li>2. Escanea el código QR con la app.</li>
                        <li>3. Ingresa el código de 6 dígitos.</li>
                      </ol>
                      <div className="flex gap-2">
                        <input value={twoFACode} onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="123456" maxLength={6}
                          className="w-32 rounded-xl border border-zinc-200 px-4 py-2.5 text-center text-lg font-mono tracking-widest focus:border-indigo-400 focus:outline-none" />
                        <button onClick={() => { if (twoFACode.length === 6) { setTwoFAEnabled(true); setShowTwoFA(false); setTwoFACode(""); } }}
                          disabled={twoFACode.length !== 6}
                          className="rounded-xl bg-green-600 px-5 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-40">
                          Verificar y activar
                        </button>
                      </div>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Zona peligrosa">
                  <p className="mb-4 text-[12px] text-zinc-500">Estas acciones son irreversibles.</p>
                  <div className="flex flex-wrap gap-3">
                    <button className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
                      Cerrar todas las sesiones
                    </button>
                    <button className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100">
                      Eliminar cuenta
                    </button>
                  </div>
                </SectionCard>
              </>
            )}

            {/* --- WORKSPACE --- */}
            {activeSection === "workspace" && (
              <>
                <SectionCard title="Información del workspace" dirty={wsDirty}>
                  <div className="space-y-4">
                    <FieldRow label="Nombre">
                      <input value={workspaceName} onChange={(e) => { setWorkspaceName(e.target.value); setWsDirty(true); }}
                        className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                    </FieldRow>
                    <FieldRow label="Zona horaria">
                      <select value={timezone} onChange={(e) => { setTimezone(e.target.value); setWsDirty(true); }}
                        className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none">
                        {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                    </FieldRow>
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <button onClick={handleSaveWorkspace} disabled={isPending || !wsDirty}
                      className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40">
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Guardar
                    </button>
                    <Toast msg={wsMsg.ok || wsMsg.err} type={wsMsg.ok ? "ok" : "err"} />
                  </div>
                </SectionCard>

                <SectionCard title="Plan activo">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-700">
                      {(initialData.workspace?.plan_type ?? "growth").toUpperCase()}
                    </span>
                    <button className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-200 hover:opacity-90">
                      <Zap className="h-3.5 w-3.5" />
                      Mejorar a Pro
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="Miembros del equipo">
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 py-8 text-center">
                    <Users className="mb-2 h-7 w-7 text-zinc-300" />
                    <p className="text-sm text-zinc-400">Multi-usuario disponible en Enterprise</p>
                    <button className="mt-3 flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700">
                      <ChevronRight className="h-3.5 w-3.5" />
                      Explorar Enterprise
                    </button>
                  </div>
                </SectionCard>
              </>
            )}

            {/* --- LINKEDIN --- */}
            {activeSection === "linkedin" && (
              <>
                {activeAccount ? (
                  <SectionCard
                    title="Cuenta LinkedIn"
                    badge={{ label: "Conectada", ok: true }}
                  >
                    <LinkedInAccountCard
                      account={activeAccount}
                      onChange={(updated) => setLiAccounts((prev) => prev.map((a) => a.id === updated.id ? updated : a))}
                      onDisconnect={(id) => setLiAccounts((prev) => prev.map((a) => a.id === id ? { ...a, status: "disconnected" } : a))}
                    />
                  </SectionCard>
                ) : (
                  <SectionCard
                    title="Cuenta LinkedIn"
                    badge={{ label: "Desconectada", ok: false }}
                    description="Conecta tu cuenta LinkedIn para empezar a automatizar"
                  >
                    <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-1 py-3 mb-4 rounded-xl">
                      <WifiOff className="h-4 w-4 text-zinc-400 shrink-0" />
                      <p className="flex-1 text-xs font-semibold text-zinc-600">Sin cuenta LinkedIn detectada</p>
                      {liPolling && (
                        <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                          Esperando…
                        </span>
                      )}
                    </div>
                    <div className="space-y-4">
                      {[
                        { n: 1, title: "Instala la extensión NexusAI Chrome",  desc: "Disponible en la Chrome Web Store" },
                        { n: 2, title: "Inicia sesión en la extensión",         desc: "Usa tu email y contraseña de NexusAI" },
                        { n: 3, title: "Visita linkedin.com",                   desc: "La cuenta se detecta automáticamente" },
                      ].map((step) => (
                        <div key={step.n} className="flex items-start gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">{step.n}</span>
                          <div>
                            <p className="text-xs font-semibold text-zinc-800">{step.title}</p>
                            <p className="text-[11px] text-zinc-400">{step.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 border-t border-zinc-100 pt-3">
                      <button onClick={() => setShowLiForm((v) => !v)}
                        className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700">
                        {showLiForm ? "Cancelar" : "Conectar manualmente con cookie li_at →"}
                      </button>
                      {showLiForm && (
                        <div className="mt-3 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Nombre</label>
                              <input value={liName} onChange={(e) => setLiName(e.target.value)} placeholder="LinkedIn Personal"
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
                          <Toast msg={liMsg.ok || liMsg.err} type={liMsg.ok ? "ok" : "err"} />
                        </div>
                      )}
                    </div>
                  </SectionCard>
                )}
              </>
            )}

            {/* --- EMAIL --- */}
            {activeSection === "email" && (
              <SectionCard
                title="Proveedor de Email"
                description="Configura cómo NexusAI envía emails a tus leads"
                badge={{ label: emailConfigured ? "Configurado ✓" : "Sin configurar", ok: emailConfigured }}
              >
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

                <button onClick={() => setShowEmailSetup((v) => !v)}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">
                  <Plus className="h-3.5 w-3.5" />
                  {showEmailSetup ? "Cancelar" : "Agregar proveedor"}
                </button>

                {showEmailSetup && (
                  <div className="mt-4 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                    {/* Provider tabs */}
                    <div className="flex gap-1 rounded-xl border border-zinc-200 bg-white p-1">
                      {EMAIL_PROVIDERS.map((p) => (
                        <button key={p.type} onClick={() => setEmailTab(p.type as "smtp" | "sendgrid" | "resend")}
                          className={[
                            "flex flex-1 flex-col items-center gap-0.5 rounded-lg p-2.5 text-center transition-all",
                            emailTab === p.type
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-zinc-600 hover:bg-zinc-50",
                          ].join(" ")}>
                          <span className="text-xs font-bold">{p.label}</span>
                          {p.badge && emailTab !== p.type && (
                            <span className="rounded-full bg-indigo-100 px-1.5 text-[9px] font-bold text-indigo-600">{p.badge}</span>
                          )}
                          <span className={`text-[10px] ${emailTab === p.type ? "text-indigo-200" : "text-zinc-400"}`}>{p.desc}</span>
                        </button>
                      ))}
                    </div>

                    {/* Common fields */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-zinc-700">Nombre visible</label>
                        <input value={smtpDisplay} onChange={(e) => setSmtpDisplay(e.target.value)} placeholder="Equipo Ventas"
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-zinc-700">Email de envío</label>
                        <input type="email" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder="ventas@empresa.com"
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                      </div>
                    </div>

                    {/* SMTP-specific */}
                    {emailTab === "smtp" && (
                      <div className="grid gap-3 sm:grid-cols-2">
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
                          <PasswordInput value={smtpPass} onChange={setSmtpPass} />
                        </div>
                      </div>
                    )}

                    {/* API key providers */}
                    {(emailTab === "sendgrid" || emailTab === "resend") && (
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-zinc-700">
                          API Key <span className="font-normal text-zinc-400">(solo se muestra últimos 4 chars al guardar)</span>
                        </label>
                        <PasswordInput
                          value={apiKey}
                          onChange={setApiKey}
                          placeholder={emailTab === "resend" ? "re_xxxxxxxx" : "SG.xxxxxxxx"}
                        />
                      </div>
                    )}

                    {emailTab === "resend" && (
                      <div className="rounded-lg bg-sky-50 px-3 py-2.5 text-[11px] text-sky-700">
                        El email remitente debe estar verificado en tu cuenta Resend.
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <button onClick={handleSaveEmail} disabled={isPending || !smtpFrom}
                        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Guardar configuración
                      </button>
                      <Toast msg={emailMsg.ok || emailMsg.err} type={emailMsg.ok ? "ok" : "err"} />
                    </div>
                  </div>
                )}

                {!showEmailSetup && (emailMsg.ok || emailMsg.err) && (
                  <div className="mt-3">
                    <Toast msg={emailMsg.ok || emailMsg.err} type={emailMsg.ok ? "ok" : "err"} />
                  </div>
                )}
              </SectionCard>
            )}

            {/* --- LÍMITES Y SEGURIDAD --- */}
            {activeSection === "limites" && (
              <SectionCard
                title="Límites y Seguridad"
                description="Controla la actividad diaria para proteger tu cuenta LinkedIn"
                dirty={limitsDirty}
              >
                <div className="space-y-6">
                  {/* Sliders */}
                  {[
                    { label: "Conexiones/día", value: connLimit, set: setConnLimit, min: 1, max: 100 },
                    { label: "Mensajes/día",   value: msgLimit,  set: setMsgLimit,  min: 1, max: 200 },
                    { label: "Visitas/día",    value: visitLimit, set: setVisitLimit, min: 1, max: 300 },
                  ].map(({ label, value, set, min, max }) => (
                    <div key={label}>
                      <div className="mb-1 flex justify-between">
                        <label className="text-sm font-medium text-zinc-700">{label}</label>
                        <span className="text-sm font-bold tabular-nums text-zinc-900">{value}</span>
                      </div>
                      <input type="range" min={min} max={max} value={value}
                        onChange={(e) => { set(Number(e.target.value)); setLimitsDirty(true); }}
                        className="w-full accent-indigo-600" />
                      <div className="flex justify-between text-[9px] text-zinc-400"><span>{min}</span><span>{max}</span></div>
                    </div>
                  ))}

                  <div className="h-px bg-zinc-100" />

                  {/* Toggles */}
                  {[
                    {
                      label: "Modo Ultra-Safe",
                      desc: "Reduce todos los límites al 50% y añade jitter extra",
                      value: ultraSafe,
                      set: (v: boolean) => { setUltraSafe(v); setLimitsDirty(true); },
                    },
                    {
                      label: "Pausar fines de semana",
                      desc: "No realiza acciones sábado y domingo",
                      value: pauseWeekends,
                      set: (v: boolean) => { setPauseWeekends(v); setLimitsDirty(true); },
                    },
                  ].map(({ label, desc, value, set }) => (
                    <div key={label} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-800">{label}</p>
                        <p className="text-[11px] text-zinc-400">{desc}</p>
                      </div>
                      <Toggle checked={value} onChange={set} />
                    </div>
                  ))}

                  <div className="h-px bg-zinc-100" />

                  {/* Horario activo */}
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-zinc-400" />
                      <p className="text-sm font-semibold text-zinc-800">Horario activo</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-zinc-500">Desde</label>
                        <select value={hoursStart}
                          onChange={(e) => { setHoursStart(Number(e.target.value)); setLimitsDirty(true); }}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none">
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-zinc-500">Hasta</label>
                        <select value={hoursEnd}
                          onChange={(e) => { setHoursEnd(Number(e.target.value)); setLimitsDirty(true); }}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none">
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
                          <Globe className="h-3 w-3" /> Zona
                        </label>
                        <select value={timezone}
                          onChange={(e) => { setTimezone(e.target.value); setLimitsDirty(true); }}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none">
                          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <button onClick={handleSaveLimits} disabled={isPending || !limitsDirty}
                    className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Guardar límites
                  </button>
                  <Toast msg={limitsMsg.ok || limitsMsg.err} type={limitsMsg.ok ? "ok" : "err"} />
                </div>
              </SectionCard>
            )}

            {/* --- BLACKLIST --- */}
            {activeSection === "blacklist" && (
              <SectionCard
                title="Blacklist"
                description="Perfiles y emails que NexusAI nunca contactará"
                badge={{ label: `${blEntries.length} bloqueados`, ok: blEntries.length > 0 }}
              >
                {/* Single add */}
                <div className="mb-4 flex gap-2">
                  <input value={blInput} onChange={(e) => setBlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddBlacklist()}
                    placeholder="URL de LinkedIn o email"
                    className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                  <button onClick={handleAddBlacklist} disabled={isPending || !blInput.trim()}
                    className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40">
                    <Plus className="h-3.5 w-3.5" />
                    Agregar
                  </button>
                </div>

                {/* Bulk import toggle */}
                <button onClick={() => setShowBulk((v) => !v)}
                  className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700">
                  <Inbox className="h-3.5 w-3.5" />
                  {showBulk ? "Cancelar importación" : "Importar en bloque (una URL/email por línea)"}
                </button>

                {showBulk && (
                  <div className="mb-4 space-y-2">
                    <textarea value={blBulk} onChange={(e) => setBlBulk(e.target.value)} rows={5}
                      placeholder={"https://linkedin.com/in/pepito\nhola@empresa.com\n..."}
                      className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-xs font-mono focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                    <div className="flex gap-2">
                      <button onClick={handleBulkImport} disabled={isPending || !blBulk.trim()}
                        className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40">
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Importar
                      </button>
                    </div>
                  </div>
                )}

                <Toast msg={blMsg.ok || blMsg.err} type={blMsg.ok ? "ok" : "err"} />

                {/* List */}
                <div className="mt-4 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                  {blEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Ban className="mb-2 h-7 w-7 text-zinc-200" />
                      <p className="text-sm text-zinc-400">Blacklist vacía</p>
                    </div>
                  ) : (
                    blEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-800">
                            {entry.linkedin_url ?? entry.email ?? "—"}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            {entry.linkedin_url && (
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">LinkedIn</span>
                            )}
                            {entry.email && (
                              <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">Email</span>
                            )}
                            {entry.reason && (
                              <span className="truncate text-xs text-zinc-400">{entry.reason}</span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => handleRemoveBlacklist(entry.id)}
                          disabled={isPending || deletingBlId === entry.id}
                          className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50">
                          {deletingBlId === entry.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            )}

            {/* --- WEBHOOKS --- */}
            {activeSection === "webhooks" && (
              <SectionCard
                title="Webhooks"
                badge={{ label: `${initialData.webhooks.length} configurados`, ok: initialData.webhooks.length > 0 }}
              >
                <WebhooksSettings initial={initialData.webhooks} />
              </SectionCard>
            )}

          </div>
        </main>
      </div>

      {/* Sticky save button — appears only when there are unsaved changes */}
      {(cuentaDirty || wsDirty || limitsDirty) && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50">
          <button
            onClick={() => {
              if (activeSection === "cuenta") handleSaveProfile();
              else if (activeSection === "workspace") handleSaveWorkspace();
              else if (activeSection === "limites") handleSaveLimits();
            }}
            disabled={isPending}
            className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white shadow-2xl shadow-zinc-900/30 transition-all hover:bg-zinc-700 disabled:opacity-60"
          >
            {isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <CheckCircle2 className="h-4 w-4 text-indigo-300" />}
            Guardar cambios
          </button>
        </div>
      )}
    </div>
  );
}
