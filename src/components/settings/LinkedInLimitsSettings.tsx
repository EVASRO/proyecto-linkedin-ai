"use client";

import { useState, useCallback, useRef, useTransition } from "react";
import { AlertTriangle, Shield, ShieldAlert, ShieldCheck, Loader2, Check, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { saveWorkspaceSettings } from "@/app/dashboard/settings/actions";
import type { WorkspaceSettingsData, LinkedInStatusData } from "@/app/dashboard/settings/actions";

type Props = {
  initialSettings: WorkspaceSettingsData;
  initialStatus:   LinkedInStatusData;
};

function riskBadge(value: number, thresholds: { safe: number; moderate: number }) {
  if (value <= thresholds.safe)    return { label: "Seguro",   cls: "bg-emerald-900/40 text-emerald-400 border-emerald-800" };
  if (value <= thresholds.moderate) return { label: "Moderado", cls: "bg-yellow-900/40 text-yellow-400 border-yellow-800" };
  return                             { label: "Riesgo",   cls: "bg-red-900/40 text-red-400 border-red-800" };
}

function UsageBar({ current, limit }: { current: number; limit: number }) {
  const pct = Math.min(100, limit > 0 ? (current / limit) * 100 : 0);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-zinc-700">
        <div
          className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-yellow-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-zinc-500">
        {current}/{limit}
      </span>
    </div>
  );
}

type LimitSliderProps = {
  label:    string;
  value:    number;
  onChange: (v: number) => void;
  min:      number;
  max:      number;
  step:     number;
  current:  number;
  thresholds: { safe: number; moderate: number };
};

function LimitSlider({ label, value, onChange, min, max, step, current, thresholds }: LimitSliderProps) {
  const badge = riskBadge(value, thresholds);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="w-8 text-right text-sm font-bold tabular-nums text-zinc-200">{value}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-emerald-500"
      />
      <div className="flex justify-between text-xs text-zinc-600">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      <UsageBar current={current} limit={value} />
    </div>
  );
}

export function LinkedInLimitsSettings({ initialSettings, initialStatus }: Props) {
  const [connectLimit, setConnectLimit] = useState(initialSettings.daily_connect_limit);
  const [messageLimit, setMessageLimit] = useState(initialSettings.daily_message_limit);
  const [viewLimit,    setViewLimit]    = useState(initialSettings.daily_view_limit);
  const [hoursStart,   setHoursStart]   = useState(initialSettings.working_hours_start);
  const [hoursEnd,     setHoursEnd]     = useState(initialSettings.working_hours_end);
  const [timezone,     setTimezone]     = useState(initialSettings.timezone);

  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await saveWorkspaceSettings({
          daily_connect_limit: connectLimit,
          daily_message_limit: messageLimit,
          daily_view_limit:    viewLimit,
          working_hours_start: hoursStart,
          working_hours_end:   hoursEnd,
          timezone,
        });
        if (res.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
        else setError(res.error ?? "Error al guardar");
      });
    }, 1000);
  }, [connectLimit, messageLimit, viewLimit, hoursStart, hoursEnd, timezone]);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveWorkspaceSettings({
        daily_connect_limit: connectLimit,
        daily_message_limit: messageLimit,
        daily_view_limit:    viewLimit,
        working_hours_start: hoursStart,
        working_hours_end:   hoursEnd,
        timezone,
      });
      if (res.success) setSaved(true);
      else setError(res.error ?? "Error al guardar");
    });
  }

  const TIMEZONES = ["America/Lima", "America/Bogota", "America/Mexico_City", "America/Santiago", "America/New_York", "Europe/Madrid", "Europe/London", "Asia/Tokyo"];

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Límites LinkedIn</h2>
        <p className="text-sm text-zinc-400">Configura los límites diarios para proteger tu cuenta</p>
      </div>

      {/* Estado conexión */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${initialStatus.connected ? "border-emerald-800/50 bg-emerald-950/20" : "border-zinc-700 bg-zinc-800/30"}`}>
        {initialStatus.connected
          ? <Wifi className="h-5 w-5 text-emerald-400" />
          : <WifiOff className="h-5 w-5 text-zinc-500" />
        }
        <div>
          <p className={`text-sm font-medium ${initialStatus.connected ? "text-emerald-300" : "text-zinc-400"}`}>
            {initialStatus.connected ? "Cuenta LinkedIn conectada" : "Sin cuenta LinkedIn conectada"}
          </p>
          {initialStatus.lastSeen && (
            <p className="text-xs text-zinc-500">
              Última actividad: {new Date(initialStatus.lastSeen).toLocaleString("es-PE")}
            </p>
          )}
        </div>
      </div>

      {/* Warning */}
      <div className="flex gap-3 rounded-xl border border-yellow-800/40 bg-yellow-950/20 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
        <div className="text-sm">
          <p className="font-semibold text-yellow-300">Protege tu cuenta LinkedIn</p>
          <p className="mt-0.5 text-yellow-600">
            LinkedIn puede restringir tu cuenta si envías demasiadas solicitudes. Recomendamos máx. 20 conexiones/día.
          </p>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <LimitSlider
          label="Conexiones por día"
          value={connectLimit}
          onChange={(v) => { setConnectLimit(v); scheduleSave(); }}
          min={5} max={50} step={5}
          current={initialStatus.dailyConnectsSent}
          thresholds={{ safe: 20, moderate: 35 }}
        />
        <div className="border-t border-zinc-800" />
        <LimitSlider
          label="Mensajes por día"
          value={messageLimit}
          onChange={(v) => { setMessageLimit(v); scheduleSave(); }}
          min={10} max={100} step={10}
          current={initialStatus.dailyMessagesSent}
          thresholds={{ safe: 50, moderate: 75 }}
        />
        <div className="border-t border-zinc-800" />
        <LimitSlider
          label="Vistas de perfil por día"
          value={viewLimit}
          onChange={(v) => { setViewLimit(v); scheduleSave(); }}
          min={20} max={200} step={20}
          current={initialStatus.dailyViewsSent}
          thresholds={{ safe: 100, moderate: 150 }}
        />
      </div>

      {/* Horario */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <p className="mb-4 text-sm font-semibold text-zinc-200">Horario de trabajo</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Desde</label>
            <select
              value={hoursStart}
              onChange={(e) => setHoursStart(Number(e.target.value))}
              className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Hasta</label>
            <select
              value={hoursEnd}
              onChange={(e) => setHoursEnd(Number(e.target.value))}
              className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Zona</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Risk legend */}
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-zinc-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Seguro
        </span>
        <span className="flex items-center gap-1.5 text-zinc-500">
          <Shield className="h-3.5 w-3.5 text-yellow-500" /> Moderado
        </span>
        <span className="flex items-center gap-1.5 text-zinc-500">
          <ShieldAlert className="h-3.5 w-3.5 text-red-500" /> Riesgo de restricción
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-400">
          <Check className="h-4 w-4 shrink-0" />
          Límites guardados
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Guardar límites
      </button>
    </div>
  );
}
