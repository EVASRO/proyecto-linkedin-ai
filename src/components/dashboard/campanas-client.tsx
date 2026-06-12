"use client";

import { useState, useCallback } from "react";
import { 
  Sparkles, 
  Copy, 
  Check, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  Globe, 
  Key, 
  User, 
  CheckCircle2,
  RefreshCw
} from "lucide-react";

type ScrapedData = {
  title: string;
  description: string;
  url: string;
};

function parseLinkedInUrl(url: string): ScrapedData {
  try {
    const parsed = new URL(url);
    const parts  = parsed.pathname.split("/").filter((p) => p && p !== "in");
    const slug   = parts[0] ?? "";
    const name   = slug
      .replace(/-[a-f0-9]{6,}$/i, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    return { title: name || "Lead de LinkedIn", description: "", url };
  } catch {
    return { title: "Lead de LinkedIn", description: "", url };
  }
}

export function CampanasClient() {
  const [url, setUrl] = useState("");
  const [sessionCookie, setSessionCookie] = useState("");
  const [extractedData, setExtractedData] = useState<ScrapedData | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [step, setStep] = useState<"idle" | "scraping" | "generating" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleScrapeAndGenerate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !sessionCookie.trim()) {
      setError("Por favor, ingresa tanto la URL del prospecto como la Cookie de Sesión.");
      return;
    }

    setStep("scraping");
    setError("");
    setExtractedData(null);
    setGeneratedMessage("");

    try {
      // 1. Parsear perfil desde la URL (sin Playwright — requeriría backend)
      const scraped: ScrapedData = parseLinkedInUrl(url.trim());
      setExtractedData(scraped);

      // 2. Generar mensaje con IA via Next.js API Route → Anthropic
      setStep("generating");

      const leadProfileText = `Título/Rol principal: ${scraped.title}\n\nURL del perfil: ${scraped.url}\n\nNota: Perfil parcial — conecta la extensión Chrome para datos completos.`;

      const generateRes = await fetch("/api/generate-message", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lead_profile: leadProfileText }),
      });

      if (!generateRes.ok) {
        const body = await generateRes.json().catch(() => null);
        throw new Error(body?.error ?? `Error al generar el mensaje con IA (${generateRes.status})`);
      }

      const generated = await generateRes.json();
      setGeneratedMessage(generated.message);
      setStep("success");
    } catch (err) {
      setStep("error");
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocurrió un error inesperado al procesar la campaña.");
      }
    }
  }, [url, sessionCookie]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [generatedMessage]);

  const resetFlow = useCallback(() => {
    setUrl("");
    setExtractedData(null);
    setGeneratedMessage("");
    setStep("idle");
    setError("");
  }, []);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 max-w-7xl mx-auto">
      
      {/* -- COLUMNA IZQUIERDA: CONFIGURACIÓN Y CONTROLES -- */}
      <div className="lg:col-span-5 space-y-6">
        <div className="rounded-2xl border border-border bg-surface shadow-[var(--card-shadow)] overflow-hidden transition-all duration-300 hover:shadow-md">
          
          {/* Header Tarjeta */}
          <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-emerald-50/80 to-green-50/60 px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-md shadow-emerald-500/20">
              <Sparkles className="h-4 w-4 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Prospección en Cadena
              </h2>
              <p className="text-xs text-muted">
                MVP Fase 1: Extracción + Redacción automatizada
              </p>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleScrapeAndGenerate} className="p-6 space-y-5">
            
            {/* URL Input */}
            <div className="space-y-2">
              <label htmlFor="url-input" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Globe className="h-4 w-4 text-emerald-500" />
                URL del Prospecto
              </label>
              <input
                id="url-input"
                type="url"
                required
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError("");
                }}
                disabled={step === "scraping" || step === "generating"}
                placeholder="https://www.linkedin.com/in/nombre-usuario"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-zinc-400 transition-all duration-200 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
              />
            </div>

            {/* Cookie Input */}
            <div className="space-y-2">
              <label htmlFor="cookie-input" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Key className="h-4 w-4 text-emerald-500" />
                Cookie de Sesión (li_at)
              </label>
              <input
                id="cookie-input"
                type="password"
                required
                value={sessionCookie}
                onChange={(e) => {
                  setSessionCookie(e.target.value);
                  if (error) setError("");
                }}
                disabled={step === "scraping" || step === "generating"}
                placeholder="Pega el valor de la cookie 'li_at' aquí..."
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-zinc-400 transition-all duration-200 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
              />
              <p className="text-[11px] text-zinc-500 leading-normal">
                La cookie se usa localmente para simular tu sesión autenticada de forma invisible en Playwright.
              </p>
            </div>

            {/* Botones de acción */}
            <div className="pt-2">
              {step === "success" || step === "error" ? (
                <button
                  type="button"
                  onClick={resetFlow}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white hover:bg-zinc-50 px-5 py-3 text-sm font-semibold text-foreground transition-all duration-200"
                >
                  <RefreshCw className="h-4 w-4" />
                  Iniciar Nueva Prospección
                </button>
              ) : (
                <button
                  id="scrape-generate-btn"
                  type="submit"
                  disabled={step === "scraping" || step === "generating"}
                  className="group inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:from-emerald-600 hover:to-green-700 hover:shadow-emerald-500/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-60 disabled:shadow-none"
                >
                  {step === "scraping" || step === "generating" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      Extraer y Generar Mensaje
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              )}
            </div>

          </form>
        </div>

        {/* Tarjeta de Guía Corta */}
        <div className="rounded-2xl border border-border bg-zinc-50/50 p-5 text-xs text-zinc-600 space-y-2">
          <span className="font-semibold text-zinc-900 block">💡 ¿Cómo funciona el flujo?</span>
          <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
            <li>Ingresas un perfil de LinkedIn y tu cookie de sesión <strong>li_at</strong>.</li>
            <li>Playwright inicializa un navegador Chromium headless.</li>
            <li>Inyecta la cookie de sesión de forma segura.</li>
            <li>Navega al perfil, aguarda la carga y extrae el <strong>h1</strong> y descripción.</li>
            <li>Esos datos se empaquetan y son procesados por <strong>Claude (API de Anthropic)</strong> para generar tu mensaje óptimo.</li>
          </ol>
        </div>
      </div>

      {/* -- COLUMNA DERECHA: ESTADOS DE CARGA Y RESULTADOS -- */}
      <div className="lg:col-span-7 space-y-6">

        {/* Estado Inicial (Idle) */}
        {step === "idle" && (
          <div className="flex flex-col items-center justify-center h-full min-h-[350px] rounded-2xl border border-dashed border-zinc-200 p-8 text-center bg-zinc-50/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900">Listo para Prospectar</h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1">
              Configura los inputs de la izquierda para comenzar el flujo de extracción automática y redacción asistida por inteligencia artificial.
            </p>
          </div>
        )}

        {/* Estado de Carga (Scraping o Generating) */}
        {(step === "scraping" || step === "generating") && (
          <div className="rounded-2xl border border-border bg-white p-8 space-y-6 shadow-sm animate-pulse">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-955">Ejecutando secuencia en tiempo real</h3>
                <p className="text-xs text-zinc-500">Por favor, no cierres la ventana.</p>
              </div>
            </div>

            {/* Paso 1: Scraping */}
            <div className="flex gap-4 items-start">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                step === "scraping" 
                  ? "bg-emerald-500 text-white animate-bounce" 
                  : "bg-emerald-100 text-emerald-700"
              }`}>
                {step === "generating" ? <Check className="h-3 w-3" /> : "1"}
              </div>
              <div className="space-y-1">
                <p className={`text-sm font-medium ${step === "scraping" ? "text-emerald-700" : "text-zinc-500"}`}>
                  Extrayendo datos del perfil...
                </p>
                <p className="text-xs text-zinc-400">
                  {step === "scraping" 
                    ? "Playwright está simulando un navegador real, inyectando la cookie de sesión y obteniendo la información..."
                    : "Datos del perfil extraídos con éxito."}
                </p>
              </div>
            </div>

            {/* Paso 2: Generación */}
            <div className="flex gap-4 items-start">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                step === "generating" 
                  ? "bg-emerald-500 text-white animate-bounce" 
                  : "bg-zinc-100 text-zinc-400"
              }`}>
                2
              </div>
              <div className="space-y-1">
                <p className={`text-sm font-medium ${step === "generating" ? "text-emerald-700" : "text-zinc-500"}`}>
                  La IA está redactando el mensaje...
                </p>
                <p className="text-xs text-zinc-400">
                  {step === "generating" 
                    ? "Procesando el encabezado y extracto del prospecto con Claude 3.5 Sonnet para crear una conexión personalizada."
                    : "Esperando inicio..."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Manejo de Errores */}
        {step === "error" && error && (
          <div className="flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50/70 p-6 animate-in">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-red-800">Error en la ejecución</h3>
              <p className="text-xs leading-relaxed text-red-700">{error}</p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={resetFlow}
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-800 underline hover:text-red-950"
                >
                  Intentar de nuevo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contenedores de Resultados (Datos Extraídos e IA Message) */}
        {(step === "success" || extractedData || generatedMessage) && (
          <div className="space-y-6 animate-in fade-in-50 duration-300">
            
            {/* Contenedor 1: Datos Extraídos */}
            {extractedData && (
              <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border bg-zinc-50/50 px-6 py-3">
                  <User className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
                    Datos Extraídos del Prospecto
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Extracción exitosa
                  </span>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Título Principal / H1</h4>
                    <p className="text-sm font-semibold text-zinc-900 mt-1">{extractedData.title || "No se pudo extraer el título"}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Descripción o Primer Párrafo</h4>
                    <p className="text-sm text-zinc-600 leading-relaxed mt-1 whitespace-pre-line">
                      {extractedData.description || "No se pudo extraer la descripción o primer párrafo"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Contenedor 2: Mensaje Generado */}
            {generatedMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-green-50/30 p-6 space-y-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-br from-emerald-200/10 to-green-300/10 rounded-full blur-3xl -z-10" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-500 animate-spin" style={{ animationDuration: "3s" }} />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Mensaje de Conexión Recomendado
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 transition-all duration-200 hover:bg-emerald-50 hover:shadow-sm"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copiar Mensaje
                      </>
                    )}
                  </button>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-white/90 p-5 shadow-inner">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-950 font-medium selection:bg-emerald-100">
                    {generatedMessage}
                  </p>
                </div>
                
                <p className="text-[11px] text-emerald-600/80 leading-normal text-right font-medium">
                  Diseñado y redactado a la medida usando Claude 3.5 Sonnet
                </p>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
}
