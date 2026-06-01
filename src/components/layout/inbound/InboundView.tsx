"use client";

import { useState, useEffect } from "react";
import { useDemoMode } from "@/components/providers/demo-mode-provider";
import {
  BookOpen, Calendar, Check, ChevronLeft, ChevronRight,
  Clock, Copy, Edit3, FileText, Image, Layers, Loader2,
  Plus, Sparkles, Trash2, X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContentType = "post" | "articulo" | "carrusel";
type ContentTone = "profesional" | "inspirador" | "educativo" | "conversacional";
type PublishStatus = "draft" | "scheduled" | "published";

interface Post {
  id: string;
  type: ContentType;
  tone: ContentTone;
  topic: string;
  content: string;
  status: PublishStatus;
  scheduledAt?: string; // ISO date
  createdAt: string;
}

// ── Mock calendario inicial ───────────────────────────────────────────────────

const INITIAL_POSTS: Post[] = [
  {
    id: "p1", type: "post", tone: "profesional",
    topic: "Automatización en ventas B2B",
    content: "El 80% del tiempo de un SDR se va en tareas repetitivas. ¿Qué pasaría si pudieras recuperar ese tiempo?\n\nEn NexusAI hemos visto que los equipos que automatizan la prospección consiguen:\n→ 3× más reuniones al mes\n→ 60% menos tiempo en tareas manuales\n→ Mensajes más personalizados, no menos\n\nLa IA no reemplaza al vendedor. Le da superpoderes.\n\n¿Tu equipo ya está automatizando la prospección?",
    status: "scheduled", scheduledAt: "2026-06-02", createdAt: "2026-05-28",
  },
  {
    id: "p2", type: "carrusel", tone: "educativo",
    topic: "5 errores en LinkedIn outreach",
    content: "Slide 1: 5 errores que matan tu tasa de respuesta en LinkedIn\nSlide 2: Error #1 — Mensajes genéricos sin personalización\nSlide 3: Error #2 — Pedir reunión en el primer mensaje\nSlide 4: Error #3 — No seguir up después de la conexión\nSlide 5: Error #4 — Ignorar el perfil del prospecto\nSlide 6: Error #5 — Enviar el mismo mensaje a todos\nSlide 7: La solución: personalización a escala con IA",
    status: "draft", createdAt: "2026-05-29",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { id: ContentType; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "post",     label: "Post",     icon: FileText, desc: "Texto + opcional imagen · hasta 3000 chars" },
  { id: "articulo", label: "Artículo", icon: BookOpen, desc: "Artículo largo · posicionamiento de autoridad" },
  { id: "carrusel", label: "Carrusel", icon: Layers,   desc: "Slides numeradas · alto engagement" },
];

const TONE_OPTIONS: { id: ContentTone; label: string; emoji: string }[] = [
  { id: "profesional",    label: "Profesional",    emoji: "💼" },
  { id: "inspirador",     label: "Inspirador",     emoji: "🚀" },
  { id: "educativo",      label: "Educativo",      emoji: "📚" },
  { id: "conversacional", label: "Conversacional", emoji: "💬" },
];

const STATUS_COLORS: Record<PublishStatus, string> = {
  draft:     "bg-zinc-100 text-zinc-600",
  scheduled: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
};
const STATUS_LABELS: Record<PublishStatus, string> = {
  draft: "Borrador", scheduled: "Programado", published: "Publicado",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ── Creator Panel ─────────────────────────────────────────────────────────────

function CreatorPanel({ onSave }: { onSave: (p: Post) => void }) {
  const [type, setType]   = useState<ContentType>("post");
  const [tone, setTone]   = useState<ContentTone>("profesional");
  const [topic, setTopic] = useState("");
  const [extra, setExtra] = useState("");
  const [content, setContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");

  async function generate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setContent("");
    try {
      const res = await fetch("/api/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_profile: `Tipo de contenido: ${type}\nTono: ${tone}\nTema: ${topic}\nContexto adicional: ${extra || "ninguno"}`,
          tone,
          objective: "nutrir_lead",
        }),
      });
      const data = await res.json();

      // El endpoint devuelve un mensaje corto; lo expandimos con un prompt especializado
      // por ahora usamos el mensaje como semilla y lo enriquecemos
      const seed = data.message ?? "";
      const typeGuide: Record<ContentType, string> = {
        post:     `Escribe un post de LinkedIn sobre "${topic}" en tono ${tone}. Usa saltos de línea, flechas (→) y termina con una pregunta. Máximo 1500 caracteres.`,
        articulo: `Escribe un artículo de LinkedIn sobre "${topic}" en tono ${tone}. Incluye introducción, 3 puntos clave con ejemplos y conclusión. Mínimo 800 palabras.`,
        carrusel: `Crea un carrusel de LinkedIn sobre "${topic}" en tono ${tone}. Formato:\nSlide 1: Título gancho\nSlide 2-6: Un punto por slide con emoji\nSlide 7: CTA final. Total 7 slides.`,
      };

      const res2 = await fetch("/api/agents/test-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_config: {
            tone, objective: "nutrir_lead",
            value_proposition: typeGuide[type],
            objections: [],
          },
          prospect_message: typeGuide[type],
          conversation_history: [],
        }),
      });
      const data2 = await res2.json();
      setContent(data2.reply ?? seed);
    } catch {
      setContent("[Error generando contenido. Verifica que ANTHROPIC_API_KEY esté configurada.]");
    } finally {
      setGenerating(false);
    }
  }

  function copyContent() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function savePost(status: PublishStatus) {
    if (!content.trim()) return;
    const post: Post = {
      id: `p_${Date.now()}`,
      type, tone, topic: topic.trim(),
      content: content.trim(),
      status,
      scheduledAt: status === "scheduled" && scheduleDate ? scheduleDate : undefined,
      createdAt: new Date().toISOString().split("T")[0],
    };
    onSave(post);
    setTopic(""); setExtra(""); setContent(""); setScheduleDate("");
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Tipo de contenido */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Tipo de contenido</p>
        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const sel = type === opt.id;
            return (
              <button key={opt.id} onClick={() => setType(opt.id)}
                className={[
                  "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all text-xs",
                  sel ? "border-indigo-400 bg-indigo-50 text-indigo-800" : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                <span className="font-semibold">{opt.label}</span>
                <span className="text-[10px] leading-tight opacity-70 hidden sm:block">{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tono */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Tono</p>
        <div className="flex flex-wrap gap-2">
          {TONE_OPTIONS.map((t) => (
            <button key={t.id} onClick={() => setTone(t.id)}
              className={[
                "rounded-xl border px-3 py-1.5 text-xs font-medium transition-all",
                tone === t.id ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50",
              ].join(" ")}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tema */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Tema principal *</label>
        <input
          value={topic} onChange={(e) => setTopic(e.target.value)}
          placeholder="Ej: Cómo aumentar la tasa de respuesta en LinkedIn"
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {/* Contexto adicional */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Contexto adicional (opcional)</label>
        <textarea
          value={extra} onChange={(e) => setExtra(e.target.value)} rows={2}
          placeholder="Ej: Enfocado en equipos de ventas SaaS B2B en LATAM, incluir estadísticas..."
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm resize-none focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {/* Generar */}
      <button
        onClick={generate} disabled={!topic.trim() || generating}
        className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {generating ? "Generando con IA…" : "Generar contenido con IA"}
      </button>

      {/* Resultado */}
      {content && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
            <p className="text-xs font-semibold text-zinc-600">Contenido generado</p>
            <div className="flex gap-1.5">
              <button onClick={copyContent}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-200 transition-colors"
              >
                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>
          <textarea
            value={content} onChange={(e) => setContent(e.target.value)} rows={10}
            className="w-full rounded-b-xl bg-transparent px-4 py-3 text-sm text-zinc-800 resize-none focus:outline-none"
          />
          <div className="flex items-center gap-2 border-t border-zinc-200 px-4 py-3">
            <span className="text-[11px] text-zinc-400">{content.length} caracteres</span>
            <div className="ml-auto flex items-center gap-2">
              <input
                type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] text-zinc-600 focus:outline-none focus:border-indigo-400"
              />
              <button onClick={() => savePost("draft")}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                Guardar borrador
              </button>
              <button
                onClick={() => savePost("scheduled")}
                disabled={!scheduleDate}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                <Clock className="mr-1 inline h-3 w-3" />
                Programar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView({ posts, onDelete }: { posts: Post[]; onDelete: (id: string) => void }) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const daysInMonth  = getDaysInMonth(year, month);
  const firstWeekday = getFirstWeekday(year, month);
  const monthName    = new Date(year, month).toLocaleString("es", { month: "long", year: "numeric" });

  const scheduledPosts = posts.filter((p) => p.scheduledAt);
  function postsOnDay(day: number) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return scheduledPosts.filter((p) => p.scheduledAt === date);
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const TYPE_COLORS: Record<ContentType, string> = {
    post:     "bg-indigo-100 text-indigo-700",
    articulo: "bg-violet-100 text-violet-700",
    carrusel: "bg-pink-100 text-pink-700",
  };

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Calendar header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-bold text-zinc-900 capitalize">{monthName}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={nextMonth} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-zinc-100">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[72px] border-b border-r border-zinc-50" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayPosts = postsOnDay(day);
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          return (
            <div
              key={day}
              className={[
                "min-h-[72px] border-b border-r border-zinc-50 p-1.5",
                isToday ? "bg-indigo-50/40" : "hover:bg-zinc-50/60",
              ].join(" ")}
            >
              <span className={[
                "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold mb-1",
                isToday ? "bg-indigo-600 text-white" : "text-zinc-400",
              ].join(" ")}>{day}</span>
              <div className="space-y-0.5">
                {dayPosts.map((p) => (
                  <div key={p.id}
                    className={`group flex items-center justify-between gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_COLORS[p.type]}`}
                  >
                    <span className="truncate">{p.topic.slice(0, 18)}{p.topic.length > 18 ? "…" : ""}</span>
                    <button onClick={() => onDelete(p.id)} className="hidden group-hover:flex text-current opacity-60 hover:opacity-100">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Posts List ────────────────────────────────────────────────────────────────

function PostsList({ posts, onDelete }: { posts: Post[]; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center">
        <Edit3 className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
        <p className="text-sm font-medium text-zinc-500">Sin publicaciones aún</p>
        <p className="text-xs text-zinc-400 mt-1">Genera tu primer contenido con IA</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {posts.map((p) => (
        <div key={p.id} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div
            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-50 transition-colors"
            onClick={() => setExpanded(expanded === p.id ? null : p.id)}
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50">
              {p.type === "post" ? <FileText className="h-4 w-4 text-indigo-600" />
               : p.type === "articulo" ? <BookOpen className="h-4 w-4 text-violet-600" />
               : <Layers className="h-4 w-4 text-pink-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-900 truncate">{p.topic}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[p.status]}`}>
                  {STATUS_LABELS[p.status]}
                </span>
                {p.scheduledAt && (
                  <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <Clock className="h-3 w-3" />
                    {new Date(p.scheduledAt + "T12:00:00").toLocaleDateString("es", { day: "numeric", month: "short" })}
                  </span>
                )}
                <span className="text-[11px] text-zinc-300 capitalize">{p.type} · {p.tone}</span>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
              className="rounded-lg p-1.5 text-zinc-300 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {expanded === p.id && (
            <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3">
              <pre className="whitespace-pre-wrap text-xs text-zinc-700 font-sans leading-relaxed">{p.content}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── MAIN VIEW ─────────────────────────────────────────────────────────────────

type Tab = "crear" | "calendario" | "borradores";

export function InboundView() {
  const { demoMode }      = useDemoMode();
  const [tab, setTab]     = useState<Tab>("crear");
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    setPosts(demoMode ? INITIAL_POSTS : []);
  }, [demoMode]);

  function addPost(p: Post) {
    setPosts((prev) => [p, ...prev]);
    setTab(p.status === "scheduled" ? "calendario" : "borradores");
  }

  function deletePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  const drafts     = posts.filter((p) => p.status === "draft");
  const scheduled  = posts.filter((p) => p.status === "scheduled");
  const published  = posts.filter((p) => p.status === "published");

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "crear",      label: "Crear contenido" },
    { id: "calendario", label: "Calendario", count: scheduled.length },
    { id: "borradores", label: "Borradores",  count: drafts.length },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Inbound — Contenido LinkedIn</h1>
          <p className="text-xs text-zinc-400">Crea, programa y publica contenido inteligente para calentar tu perfil</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="rounded-full bg-green-100 px-2.5 py-1 font-semibold text-green-700">{published.length} publicados</span>
          <span className="rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-700">{scheduled.length} programados</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-shrink-0 gap-1 border-b border-border bg-white px-6">
        {TABS.map((t) => (
          <button
            key={t.id} onClick={() => setTab(t.id)}
            className={[
              "relative flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors",
              tab === t.id
                ? "border-b-2 border-indigo-600 text-indigo-700"
                : "text-zinc-500 hover:text-zinc-700",
            ].join(" ")}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6">
        {tab === "crear" && (
          <div className="mx-auto max-w-2xl">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <h2 className="text-sm font-bold text-zinc-900">Generador de contenido con IA</h2>
              </div>
              <CreatorPanel onSave={addPost} />
            </div>
          </div>
        )}

        {tab === "calendario" && (
          <div className="space-y-6">
            <CalendarView posts={posts} onDelete={deletePost} />
            {scheduled.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Próximas publicaciones</h3>
                <PostsList posts={scheduled} onDelete={deletePost} />
              </div>
            )}
            {scheduled.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 text-center">
                <Calendar className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                <p className="text-sm font-medium text-zinc-500">Sin publicaciones programadas</p>
                <p className="text-xs text-zinc-400 mt-1">Crea contenido y selecciona una fecha para programarlo</p>
                <button onClick={() => setTab("crear")}
                  className="mt-4 flex items-center gap-1.5 mx-auto rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Crear contenido
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "borradores" && (
          <div className="mx-auto max-w-2xl space-y-4">
            {drafts.length > 0 && (
              <>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Borradores ({drafts.length})</h3>
                <PostsList posts={drafts} onDelete={deletePost} />
              </>
            )}
            {published.length > 0 && (
              <>
                <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-zinc-400">Publicados ({published.length})</h3>
                <PostsList posts={published} onDelete={deletePost} />
              </>
            )}
            {drafts.length === 0 && published.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center">
                <Image className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                <p className="text-sm font-medium text-zinc-500">Sin borradores</p>
                <button onClick={() => setTab("crear")}
                  className="mt-4 flex items-center gap-1.5 mx-auto rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Crear contenido
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
