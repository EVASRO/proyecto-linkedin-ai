"use client";

import { useState, useTransition } from "react";
import { Loader2, Check, AlertCircle, Bot, Copy, ExternalLink } from "lucide-react";
import { saveWorkspaceSettings, testAutopilotWebhook } from "@/app/dashboard/settings/actions";
import type { WorkspaceSettingsData } from "@/app/dashboard/settings/actions";

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";

const selectCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

const TIMEZONES = [
  { group: "América", zones: ["America/Lima", "America/Bogota", "America/Mexico_City", "America/Santiago", "America/Buenos_Aires", "America/New_York", "America/Los_Angeles"] },
  { group: "Europa",  zones: ["Europe/Madrid", "Europe/London", "Europe/Paris", "Europe/Berlin"] },
  { group: "Asia",    zones: ["Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Asia/Dubai"] },
];

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const AUTOPILOT_SECRET = "nexusai-autopilot-2024";

function AutopilotWebhookInstructions({ appUrl }: { appUrl: string }) {
  const webhookUrl = `${appUrl}/api/autopilot/trigger`;
  const [copied, setCopied] = useState<string | null>(null);

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const rows = [
    { label: "URL del webhook",       value: webhookUrl },
    { label: "Tabla",                 value: "messages" },
    { label: "Eventos",               value: "INSERT" },
    { label: "Authorization header",  value: `Bearer ${AUTOPILOT_SECRET}` },
  ];

  return (
    <div className="rounded-xl border border-violet-800/40 bg-violet-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-violet-400" />
        <h3 className="text-sm font-bold text-zinc-100">Configurar Autopilot IA</h3>
      </div>
      <p className="text-xs text-zinc-400">
        Para activar el Autopilot, configura este webhook en Supabase:
      </p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2"
          >
            <span className="text-[11px] text-zinc-500 w-36 shrink-0">{row.label}</span>
            <code className="text-[11px] text-violet-300 font-mono flex-1 truncate">{row.value}</code>
            <button
              type="button"
              onClick={() => copy(row.value, row.label)}
              className="ml-2 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Copiar"
            >
              {copied === row.label
                ? <Check className="h-3 w-3 text-emerald-400" />
                : <Copy className="h-3 w-3" />}
            </button>
          </div>
        ))}
      </div>
      <a
        href="https://supabase.com/dashboard/project/_/database/hooks"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-violet-400 hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        Ir a Supabase → Database → Webhooks
      </a>
    </div>
  );
}

type Props = { initial: WorkspaceSettingsData; appUrl?: string };

export function WorkspaceSettings({ initial, appUrl = "" }: Props) {
  const [name, setName]         = useState(initial.workspace_name ?? "");
  const [timezone, setTimezone] = useState(initial.timezone ?? "America/Lima");
  const [hoursStart, setHoursStart] = useState(initial.working_hours_start ?? 9);
  const [hoursEnd, setHoursEnd]     = useState(initial.working_hours_end ?? 18);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [testPending, startTestTransition] = useTransition();
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  function handleTest() {
    setTestResult(null);
    startTestTransition(async () => {
      const res = await testAutopilotWebhook();
      if (res.success) {
        const mode = res.data?.mode === "auto" ? "auto-send" : "revisión";
        const preview = res.data?.draftText
          ? `"${res.data.draftText.slice(0, 80)}${res.data.draftText.length > 80 ? "…" : ""}"`
          : "";
        setTestResult({ success: true, message: `Autopilot OK (modo ${mode})${preview ? `: ${preview}` : ""}` });
      } else {
        setTestResult({ success: false, message: res.error ?? "Error desconocido" });
      }
    });
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveWorkspaceSettings({
        workspace_name:      name || undefined,
        timezone,
        working_hours_start: hoursStart,
        working_hours_end:   hoursEnd,
      });
      if (res.success) setSaved(true);
      else setError(res.error ?? "Error al guardar");
    });
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Workspace</h2>
        <p className="text-sm text-zinc-400">Configura la identidad y zona horaria de tu workspace</p>
      </div>


      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <Field label="Nombre del workspace">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Empresa SRL"
            className={inputCls}
          />
        </Field>

        <Field label="Zona horaria">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={selectCls}
          >
            {TIMEZONES.map(({ group, zones }) => (
              <optgroup key={group} label={group}>
                {zones.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Horario inicio">
            <select
              value={hoursStart}
              onChange={(e) => setHoursStart(Number(e.target.value))}
              className={selectCls}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </Field>
          <Field label="Horario fin">
            <select
              value={hoursEnd}
              onChange={(e) => setHoursEnd(Number(e.target.value))}
              className={selectCls}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Días laborables">
          <div className="flex gap-2 flex-wrap">
            {DAYS.map(({ value, label }) => {
              const isActive = [1, 2, 3, 4, 5].includes(value);
              return (
                <span
                  key={value}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                    isActive
                      ? "border-emerald-600 bg-emerald-600/20 text-emerald-300"
                      : "border-zinc-700 bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {label}
                </span>
              );
            })}
          </div>
          <p className="text-xs text-zinc-600 mt-1">Lun–Vie por defecto (edición de días próximamente)</p>
        </Field>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-400">
            <Check className="h-4 w-4 shrink-0" />
            Workspace actualizado
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar
        </button>
      </div>

      {/* Autopilot webhook section */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Autopilot IA</h2>
        <p className="text-sm text-zinc-400 mb-4">Conecta el webhook de Supabase para respuestas automáticas</p>

        <AutopilotWebhookInstructions appUrl={appUrl} />

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={testPending}
            className="flex items-center gap-2 rounded-lg border border-violet-700 bg-violet-900/30 px-4 py-2 text-sm font-semibold text-violet-300 transition-colors hover:bg-violet-800/40 disabled:opacity-60"
          >
            {testPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Bot className="h-4 w-4" />}
            Probar Autopilot
          </button>

          {testResult && (
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
              testResult.success
                ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-400"
                : "border-red-800/50 bg-red-950/30 text-red-400"
            }`}>
              {testResult.success
                ? <Check className="h-4 w-4 shrink-0 mt-0.5" />
                : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
