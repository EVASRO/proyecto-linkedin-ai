"use client";

import { useState, useTransition } from "react";
import {
  Wifi, WifiOff, RefreshCw, Loader2, Check, AlertTriangle,
  ChevronDown, ChevronUp, Flame,
} from "lucide-react";
import {
  verifyLinkedInConnection,
  updateLinkedInLimits,
  disconnectLinkedInAccount,
} from "@/app/dashboard/perfil/actions";
import type { LinkedInAccountRow } from "@/app/dashboard/perfil/actions";

interface Props {
  account: LinkedInAccountRow;
  onChange: (updated: LinkedInAccountRow) => void;
  onDisconnect: (id: string) => void;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-gradient-to-r from-[#2563EB] to-[#06B6D4]" : "bg-[var(--border)]",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

export function LinkedInAccountCard({ account, onChange, onDisconnect }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showLimits, setShowLimits] = useState(false);
  const [connLimit, setConnLimit] = useState(account.daily_connection_limit ?? 20);
  const [msgLimit, setMsgLimit] = useState(account.daily_message_limit ?? 30);
  const [ultraSafe, setUltraSafe] = useState(false);
  const [warmup, setWarmup] = useState(false);
  const [heartbeatStatus, setHeartbeatStatus] = useState<
    "idle" | "checking" | "active" | "inactive" | "not_found"
  >("idle");
  const [limitsMsg, setLimitsMsg] = useState({ ok: "", err: "" });

  const initials = (account.name ?? "LI")
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function handleVerify() {
    setHeartbeatStatus("checking");
    startTransition(async () => {
      const res = await verifyLinkedInConnection(account.id);
      if (res.success && res.data) {
        setHeartbeatStatus(res.data.status);
      } else {
        setHeartbeatStatus("inactive");
      }
    });
  }

  function handleSaveLimits() {
    setLimitsMsg({ ok: "", err: "" });
    const effectiveConn = ultraSafe ? Math.min(connLimit, 10) : connLimit;
    startTransition(async () => {
      const res = await updateLinkedInLimits({
        id: account.id,
        daily_connection_limit: effectiveConn,
        daily_message_limit: msgLimit,
      });
      if (res.success && res.data) {
        onChange({ ...account, ...res.data });
        setShowLimits(false);
        setLimitsMsg({ ok: "Límites guardados", err: "" });
      } else {
        setLimitsMsg({ ok: "", err: res.error ?? "Error al guardar" });
      }
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      const res = await disconnectLinkedInAccount(account.id);
      if (res.success) onDisconnect(account.id);
    });
  }

  const heartbeatMap = {
    idle:      null,
    checking:  null,
    active:    { label: "Extensión activa ✓",                cls: "text-[#10B981] bg-[rgba(16,185,129,0.12)] border-[rgba(16,185,129,0.3)]"  },
    inactive:  { label: "Extensión inactiva — abre LinkedIn", cls: "text-[#F59E0B] bg-[rgba(245,158,11,0.12)] border-[rgba(245,158,11,0.3)]"  },
    not_found: { label: "Sin sesión registrada",              cls: "text-[var(--foreground-muted)] bg-[var(--background)] border-[var(--border)]" },
  };
  const hb = heartbeatStatus !== "idle" && heartbeatStatus !== "checking"
    ? heartbeatMap[heartbeatStatus]
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(16,185,129,0.3)] bg-[var(--surface)] shadow-sm">
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.08)] px-5 py-3">
        <Wifi className="h-4 w-4 shrink-0 text-[#10B981]" />
        <p className="flex-1 text-xs font-bold text-[#10B981]">Cuenta LinkedIn conectada</p>
        <span className="flex items-center gap-1 rounded-full bg-[rgba(16,185,129,0.2)] px-2.5 py-0.5 text-[10px] font-bold text-[#10B981]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10B981]" />
          Via Extensión
        </span>
      </div>

      {/* Profile row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {account.avatar_url ? (
          <img
            src={account.avatar_url}
            alt={account.name ?? ""}
            className="h-12 w-12 rounded-full object-cover ring-2 ring-[rgba(16,185,129,0.3)]"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4] text-sm font-bold text-white ring-2 ring-[rgba(37,99,235,0.3)]">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--foreground)]">{account.name ?? "LinkedIn"}</p>
          {account.headline && (
            <p className="truncate text-[11px] text-[var(--foreground-muted)]">{account.headline}</p>
          )}
          {account.profile_url && (
            <a
              href={account.profile_url}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-[#2563EB] hover:underline"
            >
              {account.profile_url}
            </a>
          )}
        </div>
        <button
          onClick={handleDisconnect}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground-muted)] transition-colors hover:border-[rgba(239,68,68,0.4)] hover:bg-[rgba(239,68,68,0.08)] hover:text-[#EF4444] disabled:opacity-50"
        >
          <WifiOff className="h-3.5 w-3.5" />
          Desconectar
        </button>
      </div>

      {/* Verify connection */}
      <div className="border-t border-[var(--border)] px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleVerify}
            disabled={isPending || heartbeatStatus === "checking"}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background)] disabled:opacity-50"
          >
            {heartbeatStatus === "checking" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Verificar conexión
          </button>
          {hb && (
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${hb.cls}`}>
              {hb.label}
            </span>
          )}
        </div>
      </div>

      {/* Warm-up toggle */}
      <div className="border-t border-[var(--border)] px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-[#F59E0B]" />
            <div>
              <p className="text-xs font-semibold text-[var(--foreground)]">Warm-up gradual</p>
              <p className="text-[10px] text-[var(--foreground-faint)]">Aumenta límites progresivamente para cuentas nuevas</p>
            </div>
          </div>
          <Toggle checked={warmup} onChange={setWarmup} />
        </div>
      </div>

      {/* Daily limits */}
      <div className="border-t border-[var(--border)] px-5 py-4">
        <button
          onClick={() => setShowLimits((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <p className="text-xs font-bold text-[var(--foreground)]">Límites diarios</p>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--foreground-muted)]">
              {account.daily_connection_limit ?? 20} conn · {account.daily_message_limit ?? 30} msg
            </span>
            {showLimits ? (
              <ChevronUp className="h-3.5 w-3.5 text-[var(--foreground-faint)]" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-[var(--foreground-faint)]" />
            )}
          </div>
        </button>

        {showLimits && (
          <div className="mt-4 space-y-4 rounded-xl border border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.06)] p-4">
            {/* Ultra-safe toggle */}
            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
              <div>
                <p className="text-xs font-semibold text-[var(--foreground)]">Modo Ultra-Safe</p>
                <p className="text-[10px] text-[var(--foreground-faint)]">Máx. 10 conexiones/día + jitter extra</p>
              </div>
              <Toggle
                checked={ultraSafe}
                onChange={(v) => {
                  setUltraSafe(v);
                  if (v) setConnLimit((c) => Math.min(c, 10));
                }}
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between">
                <label className="text-[11px] font-semibold text-[var(--foreground-muted)]">Conexiones/día</label>
                <span className="text-[11px] font-bold text-[var(--foreground)]">{connLimit}</span>
              </div>
              <input
                type="range"
                min={5}
                max={ultraSafe ? 10 : 50}
                value={connLimit}
                onChange={(e) => setConnLimit(Number(e.target.value))}
                className="w-full accent-[#2563EB]"
              />
              <div className="flex justify-between text-[9px] text-[var(--foreground-faint)]">
                <span>5</span>
                <span>{ultraSafe ? 10 : 50}</span>
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between">
                <label className="text-[11px] font-semibold text-[var(--foreground-muted)]">Mensajes/día</label>
                <span className="text-[11px] font-bold text-[var(--foreground)]">{msgLimit}</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                value={msgLimit}
                onChange={(e) => setMsgLimit(Number(e.target.value))}
                className="w-full accent-[#2563EB]"
              />
              <div className="flex justify-between text-[9px] text-[var(--foreground-faint)]">
                <span>5</span>
                <span>100</span>
              </div>
            </div>

            {limitsMsg.err && (
              <div className="flex items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-xs text-[#EF4444]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {limitsMsg.err}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSaveLimits}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Guardar límites
              </button>
              <button
                onClick={() => setShowLimits(false)}
                className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--foreground-muted)] hover:bg-[var(--background)]"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {!showLimits && limitsMsg.ok && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)] px-3 py-2 text-xs text-[#10B981]">
            <Check className="h-3.5 w-3.5 shrink-0" />
            {limitsMsg.ok}
          </div>
        )}
      </div>
    </div>
  );
}
