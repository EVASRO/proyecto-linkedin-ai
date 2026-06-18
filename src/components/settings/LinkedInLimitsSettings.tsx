"use client";

import { useState, useCallback, useRef, useTransition } from "react";
import {
  AlertTriangle, Shield, ShieldAlert, ShieldCheck, Loader2, Check, AlertCircle,
  Wifi, WifiOff, Clock, Heart, Mail, Phone, Zap, Calendar,
} from "lucide-react";
import { saveWorkspaceSettings } from "@/app/dashboard/settings/actions";
import type { WorkspaceSettingsData, LinkedInStatusData } from "@/app/dashboard/settings/actions";

type Props = {
  initialSettings: WorkspaceSettingsData;
  initialStatus:   LinkedInStatusData;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function riskBadge(value: number, thresholds: { safe: number; moderate: number }) {
  if (value <= thresholds.safe)     return { label: "Seguro",   cls: "bg-[rgba(16,185,129,0.15)] text-[#10B981] border-[rgba(16,185,129,0.3)]" };
  if (value <= thresholds.moderate) return { label: "Moderado", cls: "bg-yellow-900/40 text-yellow-400 border-yellow-800" };
  return                             { label: "Riesgo",   cls: "bg-red-900/40 text-red-400 border-red-800" };
}

function UsageBar({ current, limit }: { current: number; limit: number }) {
  const pct = Math.min(100, limit > 0 ? (current / limit) * 100 : 0);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-[var(--border)]">
        <div
          className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-yellow-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-[var(--foreground-faint)]">{current}/{limit}</span>
    </div>
  );
}

function LimitSlider({
  label, icon: Icon, value, onChange, min, max, step, current = 0, thresholds,
}: {
  label: string; icon?: React.ElementType; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; current?: number;
  thresholds: { safe: number; moderate: number };
}) {
  const badge = riskBadge(value, thresholds);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground-muted)]">
          {Icon && <Icon className="h-3.5 w-3.5" />}{label}
        </span>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
          <span className="w-10 text-right text-sm font-bold tabular-nums text-[var(--foreground)]">{value}</span>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--border)] accent-[#2563EB]"
      />
      <div className="flex justify-between text-xs text-[var(--foreground-faint)]">
        <span>{min}</span><span>{max}</span>
      </div>
      <UsageBar current={current} limit={value} />
    </div>
  );
}

function ToggleSwitch({ label, sublabel, checked, onChange }: {
  label: string; sublabel?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
        {sublabel && <p className="text-xs text-[var(--foreground-muted)]">{sublabel}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 ${checked ? "bg-[#2563EB]" : "bg-[var(--border)]"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

// ── Días de la semana (0=Dom, 1=Lun, ..., 6=Sáb — JS estándar) ────────────────
const DAYS = [
  { num: 1, short: "Lun", full: "Lunes" },
  { num: 2, short: "Mar", full: "Martes" },
  { num: 3, short: "Mié", full: "Miércoles" },
  { num: 4, short: "Jue", full: "Jueves" },
  { num: 5, short: "Vie", full: "Viernes" },
  { num: 6, short: "Sáb", full: "Sábado" },
  { num: 0, short: "Dom", full: "Domingo" },
];

// ── Main Component ─────────────────────────────────────────────────────────────

export function LinkedInLimitsSettings({ initialSettings, initialStatus }: Props) {
  const s = initialSettings as Record<string, unknown>;

  const [connectLimit, setConnectLimit] = useState(initialSettings.daily_connect_limit);
  const [messageLimit, setMessageLimit] = useState(initialSettings.daily_message_limit);
  const [viewLimit,    setViewLimit]    = useState(initialSettings.daily_view_limit);
  const [likesLimit,   setLikesLimit]   = useState((s.daily_likes_limit  as number) ?? 30);
  const [inmailsLimit, setInmailsLimit] = useState((s.daily_inmails_limit as number) ?? 10);
  const [hoursStart,   setHoursStart]   = useState(initialSettings.working_hours_start);
  const [hoursEnd,     setHoursEnd]     = useState(initialSettings.working_hours_end);
  const [timezone,     setTimezone]     = useState(initialSettings.timezone);
  const [pauseWeekends, setPauseWeekends] = useState((s.pause_on_weekends as boolean) ?? true);
  const [ultraSafe,    setUltraSafe]    = useState((s.ultra_safe_mode    as boolean) ?? false);

  // Días activos — default Lun-Vie [1,2,3,4,5]
  const rawDays = s.active_days;
  const [activeDays, setActiveDays] = useState<number[]>(
    Array.isArray(rawDays) ? (rawDays as number[]) : [1, 2, 3, 4, 5]
  );

  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function collectPayload() {
    return {
      daily_connect_limit:  connectLimit,
      daily_message_limit:  messageLimit,
      daily_view_limit:     viewLimit,
      daily_likes_limit:    likesLimit,
      daily_inmails_limit:  inmailsLimit,
      working_hours_start:  hoursStart,
      working_hours_end:    hoursEnd,
      timezone,
      pause_on_weekends:    pauseWeekends,
      ultra_safe_mode:      ultraSafe,
      active_days:          activeDays,
    };
  }

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await saveWorkspaceSettings(collectPayload());
        if (res.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
        else setError(res.error ?? "Error al guardar");
      });
    }, 1200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectLimit, messageLimit, viewLimit, likesLimit, inmailsLimit, hoursStart, hoursEnd, timezone, pauseWeekends, ultraSafe, activeDays]);

  function toggleDay(dayNum: number) {
    setActiveDays(prev => {
      const next = prev.includes(dayNum) ? prev.filter(d => d !== dayNum) : [...prev, dayNum].sort((a, b) => a - b);
      return next;
    });
    scheduleSave();
  }

  function handleSave() {
    setError(null); setSaved(false);
    startTransition(async () => {
      const res = await saveWorkspaceSettings(collectPayload());
      if (res.success) { setSaved(true); setTimeout(() => setSaved(false), 4000); }
      else setError(res.error ?? "Error al guardar");
    });
  }

  const TIMEZONES = [
    "America/Lima", "America/Bogota", "America/Mexico_City", "America/Santiago",
    "America/Buenos_Aires", "America/New_York", "Europe/Madrid", "Europe/London", "Asia/Tokyo",
  ];

  const activeDayNames = DAYS.filter(d => activeDays.includes(d.num)).map(d => d.full);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Límites LinkedIn</h2>
        <p className="text-sm text-[var(--foreground-muted)]">Configura límites diarios, horarios y días activos para proteger tu cuenta</p>
      </div>

      {/* Estado conexión */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${initialStatus.connected ? "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)]" : "border-[var(--border)] bg-[var(--surface)]"}`}>
        {initialStatus.connected ? <Wifi className="h-5 w-5 text-[#10B981]" /> : <WifiOff className="h-5 w-5 text-[var(--foreground-faint)]" />}
        <div>
          <p className={`text-sm font-medium ${initialStatus.connected ? "text-[#10B981]" : "text-[var(--foreground-muted)]"}`}>
            {initialStatus.connected ? "Cuenta LinkedIn conectada" : "Sin cuenta LinkedIn conectada"}
          </p>
          {initialStatus.lastSeen && (
            <p className="text-xs text-[var(--foreground-faint)]">Última actividad: {new Date(initialStatus.lastSeen).toLocaleString("es-PE")}</p>
          )}
        </div>
      </div>

      {/* Warning */}
      <div className="flex gap-3 rounded-xl border border-yellow-800/40 bg-yellow-950/20 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
        <div className="text-sm">
          <p className="font-semibold text-yellow-300">Protege tu cuenta LinkedIn</p>
          <p className="mt-0.5 text-yellow-600">Recomendamos máx. 20-30 conexiones/día y automatizaciones solo en horario laboral.</p>
        </div>
      </div>

      {/* ── LÍMITES DE ACCIONES ─────────────────────────────────────────────── */}
      <div className="space-y-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-sm font-semibold text-[var(--foreground)]">Acciones por día</p>

        <LimitSlider label="Conexiones" icon={Shield}
          value={connectLimit} onChange={(v) => { setConnectLimit(v); scheduleSave(); }}
          min={5} max={75} step={5} current={initialStatus.dailyConnectsSent}
          thresholds={{ safe: 20, moderate: 40 }}
        />
        <div className="border-t border-[var(--border)]" />
        <LimitSlider label="Mensajes directos" icon={Phone}
          value={messageLimit} onChange={(v) => { setMessageLimit(v); scheduleSave(); }}
          min={5} max={150} step={5} current={initialStatus.dailyMessagesSent}
          thresholds={{ safe: 50, moderate: 100 }}
        />
        <div className="border-t border-[var(--border)]" />
        <LimitSlider label="Vistas de perfil" icon={Zap}
          value={viewLimit} onChange={(v) => { setViewLimit(v); scheduleSave(); }}
          min={20} max={300} step={20} current={initialStatus.dailyViewsSent}
          thresholds={{ safe: 100, moderate: 200 }}
        />
        <div className="border-t border-[var(--border)]" />
        <LimitSlider label="Likes / interacciones" icon={Heart}
          value={likesLimit} onChange={(v) => { setLikesLimit(v); scheduleSave(); }}
          min={0} max={150} step={5}
          thresholds={{ safe: 30, moderate: 80 }}
        />
        <div className="border-t border-[var(--border)]" />
        <LimitSlider label="InMails" icon={Mail}
          value={inmailsLimit} onChange={(v) => { setInmailsLimit(v); scheduleSave(); }}
          min={1} max={45} step={1}
          thresholds={{ safe: 10, moderate: 25 }}
        />
      </div>

      {/* ── DÍAS ACTIVOS ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#2563EB]" />
          <p className="text-sm font-semibold text-[var(--foreground)]">Días activos</p>
        </div>

        {/* Selector de días — fila de 7 botones */}
        <div className="flex gap-1.5">
          {DAYS.map((day) => {
            const isActive = activeDays.includes(day.num);
            const isWeekend = day.num === 0 || day.num === 6;
            return (
              <button
                key={day.num}
                type="button"
                onClick={() => toggleDay(day.num)}
                title={day.full}
                className={[
                  "flex-1 rounded-lg py-2.5 text-xs font-bold transition-all duration-150 border",
                  isActive
                    ? isWeekend
                      ? "bg-amber-600 border-amber-500 text-white"
                      : "bg-[#2563EB] border-[#2563EB] text-white"
                    : "bg-[var(--background)] border-[var(--border)] text-[var(--foreground-faint)] hover:border-[var(--foreground-muted)]",
                ].join(" ")}
              >
                {day.short}
              </button>
            );
          })}
        </div>

        {/* Resumen */}
        <p className="mt-3 text-xs text-[var(--foreground-muted)]">
          {activeDays.length === 0
            ? "⚠️ Ningún día seleccionado — la automatización no correrá"
            : activeDays.length === 7
              ? "Todos los días activos (incluyendo fin de semana)"
              : `Activo ${activeDays.length} días: ${activeDayNames.join(", ")}`
          }
        </p>

        {/* Quick presets */}
        <div className="mt-3 flex gap-2">
          <button type="button"
            onClick={() => { setActiveDays([1,2,3,4,5]); scheduleSave(); }}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
          >
            Lun–Vie
          </button>
          <button type="button"
            onClick={() => { setActiveDays([1,2,3,4,5,6]); scheduleSave(); }}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
          >
            Lun–Sáb
          </button>
          <button type="button"
            onClick={() => { setActiveDays([0,1,2,3,4,5,6]); scheduleSave(); }}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
          >
            Todos
          </button>
          <button type="button"
            onClick={() => { setActiveDays([]); scheduleSave(); }}
            className="rounded-lg border border-red-900/40 px-3 py-1.5 text-xs text-red-500 hover:bg-red-950/20 transition-colors"
          >
            Pausar todo
          </button>
        </div>
      </div>

      {/* ── HORARIO DE TRABAJO ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#2563EB]" />
          <p className="text-sm font-semibold text-[var(--foreground)]">Horario de trabajo</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">Desde</label>
            <select value={hoursStart}
              onChange={(e) => { setHoursStart(Number(e.target.value)); scheduleSave(); }}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[#2563EB]"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">Hasta</label>
            <select value={hoursEnd}
              onChange={(e) => { setHoursEnd(Number(e.target.value)); scheduleSave(); }}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[#2563EB]"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">Zona</label>
            <select value={timezone}
              onChange={(e) => { setTimezone(e.target.value); scheduleSave(); }}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[#2563EB]"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--foreground-faint)]">
          El motor ejecutará acciones entre las {String(hoursStart).padStart(2,"0")}:00 y las {String(hoursEnd).padStart(2,"0")}:00 ({timezone}).
        </p>
      </div>

      {/* ── SEGURIDAD ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#2563EB]" />
          <p className="text-sm font-semibold text-[var(--foreground)]">Seguridad anti-ban</p>
        </div>
        <div className="space-y-5">
          <ToggleSwitch
            label="Pausar fines de semana"
            sublabel="Fuerza pausa Sáb y Dom (ignora la selección de días de arriba)"
            checked={pauseWeekends}
            onChange={(v) => { setPauseWeekends(v); scheduleSave(); }}
          />
          <div className="border-t border-[var(--border)]" />
          <ToggleSwitch
            label="Modo Ultra-Seguro"
            sublabel="Limita acciones a horario de oficina y reduce velocidad"
            checked={ultraSafe}
            onChange={(v) => { setUltraSafe(v); scheduleSave(); }}
          />
          {ultraSafe && (
            <div className="rounded-lg border border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.06)] p-3 text-xs text-[#2563EB]">
              <Shield className="mb-1 inline h-3.5 w-3.5 mr-1" />
              Ultra-Seguro activo: máx. 15 conexiones/día, retrasos aumentados, solo días hábiles.
            </div>
          )}
        </div>
      </div>

      {/* Risk legend */}
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-[var(--foreground-faint)]"><ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" /> Seguro</span>
        <span className="flex items-center gap-1.5 text-[var(--foreground-faint)]"><Shield className="h-3.5 w-3.5 text-yellow-500" /> Moderado</span>
        <span className="flex items-center gap-1.5 text-[var(--foreground-faint)]"><ShieldAlert className="h-3.5 w-3.5 text-red-500" /> Riesgo de restricción</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-400">
          <Check className="h-4 w-4 shrink-0" /> Guardado y sincronizado con la extensión ✓
        </div>
      )}

      <button type="button" onClick={handleSave} disabled={isPending}
        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Guardar y sincronizar con extensión
      </button>
    </div>
  );
}
