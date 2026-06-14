"use client";

import { useState, useTransition } from "react";
import {
  Plus, Trash2, Loader2, Zap, Copy, Check, AlertTriangle,
  ExternalLink, Play,
} from "lucide-react";
import {
  upsertWebhook,
  deleteWebhook,
  testWebhookDelivery,
} from "@/app/dashboard/perfil/actions";
import type { WebhookRow } from "@/app/dashboard/perfil/actions";

const WEBHOOK_EVENTS = [
  "connection_sent",
  "connection_accepted",
  "message_sent",
  "reply_received",
  "meeting_booked",
] as const;

type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

function generateSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

interface Props {
  initial: WebhookRow[];
}

export function WebhooksSettings({ initial }: Props) {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState<WebhookEvent[]>([]);
  const [whSecret] = useState(generateSecret);
  const [formMsg, setFormMsg] = useState({ ok: "", err: "" });

  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { httpStatus: number; body: string }>>({});

  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function toggleEvent(ev: WebhookEvent) {
    setWhEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  }

  function handleSave() {
    setFormMsg({ ok: "", err: "" });
    if (!whName.trim() || !whUrl.trim() || whEvents.length === 0) {
      setFormMsg({ ok: "", err: "Completa nombre, URL y selecciona al menos un evento" });
      return;
    }
    startTransition(async () => {
      const res = await upsertWebhook({
        name:      whName.trim(),
        url:       whUrl.trim(),
        events:    whEvents,
        is_active: true,
      });
      if (res.success && res.data) {
        setWebhooks((prev) => [res.data!, ...prev]);
        setShowForm(false);
        setWhName("");
        setWhUrl("");
        setWhEvents([]);
        setFormMsg({ ok: "Webhook guardado", err: "" });
      } else {
        setFormMsg({ ok: "", err: res.error ?? "Error al guardar" });
      }
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteWebhook(id);
      if (res.success) setWebhooks((prev) => prev.filter((w) => w.id !== id));
      setDeletingId(null);
    });
  }

  function handleToggle(wh: WebhookRow) {
    startTransition(async () => {
      const res = await upsertWebhook({
        id:        wh.id,
        name:      wh.name ?? "",
        url:       wh.url ?? "",
        events:    (wh.events ?? []) as WebhookEvent[],
        is_active: !wh.is_active,
      });
      if (res.success) {
        setWebhooks((prev) =>
          prev.map((w) => (w.id === wh.id ? { ...w, is_active: !wh.is_active } : w))
        );
      }
    });
  }

  function handleTest(id: string) {
    setTestingId(id);
    startTransition(async () => {
      const res = await testWebhookDelivery(id);
      const result: { httpStatus: number; body: string } = res.success && res.data
        ? { httpStatus: res.data.httpStatus, body: res.data.body }
        : { httpStatus: 0, body: res.error ?? "Error al conectar" };
      setTestResults((prev) => ({ ...prev, [id]: result }));
      setTestingId(null);
    });
  }

  function copyToken(token: string, id: string) {
    navigator.clipboard.writeText(token);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] text-[var(--foreground-muted)]">
            Recibe notificaciones en tiempo real cuando ocurran eventos en cazary.ai
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-3 py-2 text-xs font-semibold text-white transition-all hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo webhook
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">Nombre</label>
              <input
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                placeholder="Ej: CRM Webhook"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">URL del endpoint</label>
              <input
                value={whUrl}
                onChange={(e) => setWhUrl(e.target.value)}
                placeholder="https://mi-servidor.com/webhook"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-[var(--foreground-muted)]">Eventos</label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvent(ev)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    whEvents.includes(ev)
                      ? "border-[#2563EB] bg-[#2563EB] text-white"
                      : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground-muted)] hover:border-[rgba(37,99,235,0.4)]",
                  ].join(" ")}
                >
                  {ev}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--foreground-muted)]">Secret key (autogenerado)</label>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
              <code className="flex-1 truncate font-mono text-[11px] text-[var(--foreground-faint)]">{whSecret}</code>
            </div>
            <p className="mt-1 text-[10px] text-[var(--foreground-faint)]">
              Se envía como header <code>X-cazary.ai-Signature</code> en cada request.
            </p>
          </div>

          {formMsg.err && (
            <div className="flex items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-xs text-[#EF4444]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {formMsg.err}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2 text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Guardar webhook
            </button>
            <button
              onClick={() => { setShowForm(false); setFormMsg({ ok: "", err: "" }); }}
              className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!showForm && formMsg.ok && (
        <div className="flex items-center gap-2 rounded-lg border border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)] px-3 py-2 text-xs text-[#10B981]">
          <Check className="h-3.5 w-3.5 shrink-0" />
          {formMsg.ok}
        </div>
      )}

      {/* List */}
      {webhooks.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center">
          <Zap className="mb-2 h-7 w-7 text-[var(--foreground-faint)]" />
          <p className="text-sm text-[var(--foreground-muted)]">Sin webhooks configurados</p>
          <p className="text-[12px] text-[var(--foreground-faint)]">Agrega uno para recibir eventos en tu servidor</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => {
            const testResult = testResults[wh.id];
            const isOk = testResult && testResult.httpStatus >= 200 && testResult.httpStatus < 300;
            return (
              <div key={wh.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[var(--foreground)]">{wh.name}</p>
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          wh.is_active
                            ? "bg-[rgba(16,185,129,0.12)] text-[#10B981]"
                            : "bg-[var(--border)] text-[var(--foreground-faint)]",
                        ].join(" ")}
                      >
                        {wh.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </div>

                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--foreground-faint)]">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{wh.url}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {(wh.events ?? []).map((ev) => (
                        <span
                          key={ev}
                          className="rounded-full bg-[rgba(37,99,235,0.12)] px-2 py-0.5 text-[10px] font-semibold text-[#2563EB]"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>

                    {wh.secret_token && (
                      <div className="mt-2 flex items-center gap-2">
                        <code className="font-mono text-[11px] text-[var(--foreground-faint)]">
                          {wh.secret_token.slice(0, 8)}{"•".repeat(10)}
                        </code>
                        <button
                          onClick={() => copyToken(wh.secret_token!, wh.id)}
                          className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]"
                        >
                          {copiedId === wh.id ? (
                            <Check className="h-3 w-3 text-[#10B981]" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {copiedId === wh.id ? "Copiado" : "Copiar"}
                        </button>
                      </div>
                    )}

                    {testResult && (
                      <div
                        className={[
                          "mt-2 rounded-lg border px-3 py-2 text-[11px] font-mono",
                          isOk
                            ? "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)] text-[#10B981]"
                            : "border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] text-[#EF4444]",
                        ].join(" ")}
                      >
                        HTTP {testResult.httpStatus} — {testResult.body || "(sin respuesta)"}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => handleTest(wh.id)}
                      disabled={isPending || testingId === wh.id}
                      title="Probar webhook"
                      className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-50"
                    >
                      {testingId === wh.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      Probar
                    </button>

                    <button
                      onClick={() => handleToggle(wh)}
                      disabled={isPending}
                      className={[
                        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
                        wh.is_active ? "bg-[#2563EB]" : "bg-[var(--border)]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                          wh.is_active ? "translate-x-4" : "translate-x-0.5",
                        ].join(" ")}
                      />
                    </button>

                    <button
                      onClick={() => handleDelete(wh.id)}
                      disabled={isPending || deletingId === wh.id}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--foreground-faint)] hover:bg-[rgba(239,68,68,0.1)] hover:text-[#EF4444] disabled:opacity-50"
                    >
                      {deletingId === wh.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
