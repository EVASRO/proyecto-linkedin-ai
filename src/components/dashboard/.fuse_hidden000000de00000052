"use client";

import { useState, useCallback } from "react";
import { Sparkles, Copy, Check, AlertCircle, Loader2, Send } from "lucide-react";

const API_URL = "/api/generate-message";

export function AiMessageWidget() {
  const [leadProfile, setLeadProfile] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!leadProfile.trim()) {
      setError("Pega el perfil del prospecto antes de generar.");
      return;
    }

    setIsLoading(true);
    setError("");
    setGeneratedMessage("");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_profile: leadProfile.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.detail ?? `Error del servidor (${res.status})`
        );
      }

      const data = await res.json();
      setGeneratedMessage(data.message);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocurrió un error inesperado.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [leadProfile]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [generatedMessage]);

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-[var(--card-shadow)] overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-emerald-50/80 to-green-50/60 px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-md shadow-emerald-500/20">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Generador de Mensajes IA
          </h2>
          <p className="text-xs text-muted">
            Pega el perfil del lead y Claude redactará un mensaje B2B personalizado
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-6 space-y-5">
        {/* Textarea */}
        <div className="space-y-2">
          <label
            htmlFor="lead-profile-input"
            className="block text-sm font-medium text-foreground"
          >
            Perfil del prospecto
          </label>
          <textarea
            id="lead-profile-input"
            rows={5}
            value={leadProfile}
            onChange={(e) => {
              setLeadProfile(e.target.value);
              if (error) setError("");
            }}
            placeholder={"Ej: María López — VP de Ventas en Acme Corp. 10+ años en SaaS B2B, enfoque en growth y automatización de pipelines…"}
            className="w-full resize-none rounded-xl border border-border bg-white px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-zinc-400 transition-all duration-200 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <p className="text-xs text-muted">
            Mientras más detallado sea el perfil, mejor será el mensaje generado.
          </p>
        </div>

        {/* Button */}
        <button
          id="generate-message-btn"
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
          className="group inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:from-emerald-600 hover:to-green-700 hover:shadow-emerald-500/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-60 disabled:shadow-none"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Pensando…
            </>
          ) : (
            <>
              <Send className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              Generar Mensaje con IA
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div
            id="generation-error"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 animate-in"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm leading-relaxed text-red-700">{error}</p>
          </div>
        )}

        {/* Result Card */}
        {generatedMessage && (
          <div
            id="generated-message-card"
            className="space-y-3 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-green-50/40 p-5 animate-in"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Mensaje generado
                </span>
              </div>
              <button
                id="copy-message-btn"
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-all duration-200 hover:bg-white hover:shadow-sm"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </>
                )}
              </button>
            </div>

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {generatedMessage}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
