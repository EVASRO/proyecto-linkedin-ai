"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight, Check, ChevronRight, ClipboardCopy, ExternalLink,
  Eye, FileText, History, Layers, Link2, Loader2, Megaphone,
  Pause, Play, Plus, RefreshCw, Send, Sparkles, Trash2, X,
} from "lucide-react";
import {
  addPostToMonitor, generateContent, getInboundData,
  getInboundDrafts, publishLinkedInPost, removePost, saveInboundDraft, togglePostStatus,
  type InboundLead, type InboundPost,
} from "@/app/dashboard/inbound/actions";

// -- Types ---------------------------------------------------------------------

type Tab = "monitor" | "generador";

type Tone   = "profesional" | "cercano" | "provocador" | "educativo";
type Format = "post" | "carrusel" | "historia" | "encuesta";

type DraftItem = {
  id: string;
  topic: string;
  format: Format;
  content: string;
  createdAt: string;
};

// -- Helpers -------------------------------------------------------------------

const LS_DRAFTS_KEY = "cazaryai_inbound_drafts";

function saveDraft(d: DraftItem) {
  try {
    const prev: DraftItem[] = JSON.parse(localStorage.getItem(LS_DRAFTS_KEY) ?? "[]");
    localStorage.setItem(LS_DRAFTS_KEY, JSON.stringify([d, ...prev].slice(0, 5)));
  } catch { /* ignore */ }
}

function loadDrafts(): DraftItem[] {
  try {
    return JSON.parse(localStorage.getItem(LS_DRAFTS_KEY) ?? "[]");
  } catch { return []; }
}

function truncateUrl(url: string, max = 55) {
  try {
    const u = new URL(url);
    const path = u.pathname + (u.search ?? "");
    return (u.hostname + path).length > max
      ? (u.hostname + path).slice(0, max) + "…"
      : u.hostname + path;
  } catch {
    return url.length > max ? url.slice(0, max) + "…" : url;
  }
}

function relDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  if (d === 0 && h === 0) return "hace unos minutos";
  if (d === 0) return `hace ${h}h`;
  if (d === 1) return "ayer";
  return `hace ${d}d`;
}

const STATUS_COLORS: Record<string, string> = {
  monitoring: "bg-[rgba(16,185,129,0.12)] text-[#10B981]",
  paused:     "bg-[var(--border)] text-[var(--foreground-faint)]",
  error:      "bg-[rgba(239,68,68,0.12)] text-[#EF4444]",
};

const LEAD_STATUS: Record<string, { label: string; cls: string }> = {
  nuevo:      { label: "Nuevo",      cls: "bg-[rgba(37,99,235,0.12)] text-[#2563EB]" },
  contactado: { label: "Contactado", cls: "bg-[rgba(37,99,235,0.12)] text-[#2563EB]" },
  respondio:  { label: "Respondió",  cls: "bg-[rgba(16,185,129,0.12)] text-[#10B981]" },
  cerrado:    { label: "Cerrado",    cls: "bg-[var(--border)] text-[var(--foreground-faint)]" },
};

function avatarColor(name: string) {
  const p = ["bg-[#2563EB]","bg-[#06B6D4]","bg-[#10B981]","bg-[#F59E0B]","bg-[#EF4444]","bg-[#0EA5E9]"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

// -- Add-post modal ------------------------------------------------------------

function AddPostModal({ onClose, onAdded }: { onClose: () => void; onAdded: (p: InboundPost) => void }) {
  const [url, setUrl]   = useState("");
  const [note, setNote] = useState("");
  const [loading, startTransition] = useTransition();
  const [err, setErr]   = useState("");

  function submit() {
    const trimmed = url.trim();
    if (!trimmed) { setErr("La URL es obligatoria"); return; }
    if (!trimmed.includes("linkedin.com")) { setErr("Debe ser una URL de LinkedIn"); return; }
    setErr("");
    startTransition(async () => {
      const res = await addPostToMonitor(trimmed, note.trim() || undefined);
      if (res.success) {
        const fake: InboundPost = {
          id: `local_${Date.now()}`,
          workspace_id: "",
          post_url: trimmed,
          status: "monitoring",
          note: note.trim() || null,
          leads_captured: 0,
          created_at: new Date().toISOString(),
        };
        onAdded(fake);
        onClose();
      } else {
        setErr(res.error ?? "Error al guardar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-bold text-[var(--foreground)]">Monitorear post de LinkedIn</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--foreground-faint)] hover:bg-[rgba(255,255,255,0.04)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
              URL del post *
            </label>
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="https://www.linkedin.com/posts/..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
              Nota (opcional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Post sobre AI outreach — capturar CTOs"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
            />
          </div>
          {err && (
            <p className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.1)] px-3 py-2 text-xs text-[#EF4444]">{err}</p>
          )}
        </div>

        <div className="flex gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-xs font-semibold text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] py-2.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Agregar post
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Monitor tab ---------------------------------------------------------------

function MonitorTab({ posts, leads, onPostsChange }: {
  posts: InboundPost[];
  leads: InboundLead[];
  onPostsChange: (fn: (prev: InboundPost[]) => InboundPost[]) => void;
}) {
  const [addOpen, setAddOpen]           = useState(false);
  const [, startTransition]             = useTransition();
  const router                          = useRouter();

  function handleAdded(p: InboundPost) {
    onPostsChange((prev) => [p, ...prev]);
  }

  function handleToggle(post: InboundPost) {
    const next = post.status === "monitoring" ? "paused" : "monitoring";
    onPostsChange((prev) => prev.map((p) => p.id === post.id ? { ...p, status: next } : p));
    startTransition(async () => {
      await togglePostStatus(post.id, next);
    });
  }

  function handleRemove(id: string) {
    onPostsChange((prev) => prev.filter((p) => p.id !== id));
    startTransition(async () => {
      await removePost(id);
    });
  }

  const activeCount = posts.filter(p => p.status === "monitoring").length;
  const totalLeads  = posts.reduce((s, p) => s + (p.leads_captured ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Posts monitoreados", value: posts.length, sub: `${activeCount} activos`, color: "text-[#2563EB]" },
          { label: "Leads capturados",   value: totalLeads,   sub: "vía posts inbound",  color: "text-[#10B981]"  },
          { label: "Leads inbound",      value: leads.length, sub: "en CRM con tag",      color: "text-[#2563EB]" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <p className={`text-2xl font-black tabular-nums ${color}`}>{value}</p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--foreground)]">{label}</p>
            <p className="text-[10px] text-[var(--foreground-faint)]">{sub}</p>
          </div>
        ))}
      </div>

      {/* Posts grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--foreground)]">
            Posts monitoreados
            <span className="ml-2 rounded-full bg-[rgba(37,99,235,0.15)] px-1.5 py-0.5 text-[10px] font-bold text-[#2563EB]">({posts.length})</span>
          </h2>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-3 py-2 text-xs font-bold text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar post
          </button>
        </div>

        {posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface)] py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(37,99,235,0.1)]">
              <Megaphone className="h-6 w-6 text-[var(--foreground-faint)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Sin posts monitoreados</p>
              <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">Agrega URLs de posts de LinkedIn para capturar leads automáticamente</p>
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2 text-xs font-bold text-white hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar primer post
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {posts.map((post) => (
              <div key={post.id} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                {/* URL + status */}
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:underline"
                  >
                    <Link2 className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{truncateUrl(post.post_url)}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
                  </a>
                  <span className={[
                    "flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold flex items-center gap-1",
                    STATUS_COLORS[post.status] ?? "bg-[var(--border)] text-[var(--foreground-faint)]",
                  ].join(" ")}>
                    {post.status === "monitoring" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
                    )}
                    {post.status === "monitoring" ? "Activo" : post.status === "paused" ? "Pausado" : "Error"}
                  </span>
                </div>

                {/* Note */}
                {post.note && (
                  <p className="text-[11px] text-[var(--foreground-muted)] leading-snug">{post.note}</p>
                )}

                {/* Metrics */}
                <div className="flex items-center gap-3 text-[11px] text-[var(--foreground-muted)]">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    <strong className="text-[var(--foreground)]">{post.leads_captured}</strong> leads capturados
                  </span>
                  <span>{relDate(post.created_at)}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
                  <button
                    onClick={() => handleToggle(post)}
                    className={[
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                      post.status === "monitoring"
                        ? "border-[rgba(245,158,11,0.3)] text-[#F59E0B] hover:bg-[rgba(245,158,11,0.1)]"
                        : "border-[rgba(16,185,129,0.3)] text-[#10B981] hover:bg-[rgba(16,185,129,0.1)]",
                    ].join(" ")}
                  >
                    {post.status === "monitoring"
                      ? <><Pause className="h-3 w-3" /> Pausar</>
                      : <><Play  className="h-3 w-3" /> Reanudar</>}
                  </button>
                  <button
                    onClick={() => handleRemove(post.id)}
                    className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-[var(--foreground-faint)] hover:bg-[rgba(239,68,68,0.1)] hover:text-[#EF4444] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leads table */}
      {leads.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-bold text-[var(--foreground)]">
            Leads inbound capturados
            <span className="ml-2 text-xs font-normal text-[var(--foreground-muted)]">({leads.length})</span>
          </h2>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                  {["Lead", "Empresa", "Capturado", "Estado", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-[var(--foreground-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {leads.map((lead) => {
                  const st = LEAD_STATUS[lead.status] ?? { label: lead.status, cls: "bg-[var(--border)] text-[var(--foreground-faint)]" };
                  return (
                    <tr key={lead.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(lead.full_name)}`}>
                            {initials(lead.full_name)}
                          </div>
                          <span className="font-semibold text-[var(--foreground)]">{lead.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--foreground-muted)]">{lead.company ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--foreground-faint)]">{relDate(lead.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => router.push("/dashboard/crm")}
                          className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[10px] font-semibold text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                        >
                          Ver en CRM <ChevronRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {addOpen && <AddPostModal onClose={() => setAddOpen(false)} onAdded={handleAdded} />}
    </div>
  );
}

// -- Content generator tab -----------------------------------------------------

function GeneradorTab() {
  const [topic,    setTopic]    = useState("");
  const [tone,     setTone]     = useState<Tone>("profesional");
  const [format,   setFormat]   = useState<Format>("post");
  const [industry, setIndustry] = useState("");
  const [cta,      setCta]      = useState("");
  const [content,  setContent]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [drafts,   setDrafts]   = useState<DraftItem[]>([]);
  const [draftSaved,     setDraftSaved]     = useState(false);
  const [publishing,     setPublishing]     = useState(false);
  const [publishStatus,  setPublishStatus]  = useState<"idle" | "queued" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Load from Supabase first, fallback to localStorage
    getInboundDrafts().then((res) => {
      if (res.success && res.data && res.data.length > 0) {
        setDrafts(res.data.map(d => ({
          id:        d.id,
          topic:     d.topic ?? '',
          format:    (d.format as Format) ?? 'post',
          content:   d.content ?? '',
          createdAt: d.created_at,
        })));
      } else {
        setDrafts(loadDrafts());
      }
    }).catch(() => setDrafts(loadDrafts()));
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setContent("");
    const res = await generateContent({ topic, tone, format, industry: industry || "B2B general", cta: cta || "Conéctate conmigo" });
    setLoading(false);
    if (res.success && res.data) {
      setContent(res.data.content);
    } else {
      setContent(`[Error: ${res.error ?? "No se pudo generar el contenido"}]`);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSaveDraft() {
    const draft: DraftItem = {
      id:        `d_${Date.now()}`,
      topic,
      format,
      content,
      createdAt: new Date().toISOString(),
    };
    // Persist to Supabase and update local state
    saveDraft(draft); // keep localStorage as fallback
    const res = await saveInboundDraft({ topic, format, content });
    if (res.success) {
      // Reload from Supabase to get server-assigned IDs
      const fresh = await getInboundDrafts();
      if (fresh.success && fresh.data) {
        setDrafts(fresh.data.map(d => ({
          id:        d.id,
          topic:     d.topic ?? '',
          format:    (d.format as Format) ?? 'post',
          content:   d.content ?? '',
          createdAt: d.created_at,
        })));
      } else {
        setDrafts(loadDrafts());
      }
    } else {
      setDrafts(loadDrafts());
    }
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  }

  async function handlePublish() {
    if (!content.trim()) return;
    setPublishing(true);
    setPublishStatus("idle");
    const res = await publishLinkedInPost(content);
    setPublishing(false);
    setPublishStatus(res.success ? "queued" : "error");
    if (res.success) setTimeout(() => setPublishStatus("idle"), 5000);
  }

  function loadFromDraft(d: DraftItem) {
    setContent(d.content);
    setTopic(d.topic);
    setFormat(d.format);
  }

  const charLimit = format === "post" ? 1300 : 3000;
  const overLimit = content.length > charLimit;

  const TONES: { id: Tone; label: string; desc: string }[] = [
    { id: "profesional", label: "Profesional", desc: "Formal + datos"   },
    { id: "cercano",     label: "Cercano",     desc: "Anécdotas + tú"   },
    { id: "provocador",  label: "Provocador",  desc: "Debate + opinión" },
    { id: "educativo",   label: "Educativo",   desc: "Paso a paso"      },
  ];

  const FORMATS: { id: Format; label: string; icon: React.ElementType }[] = [
    { id: "post",     label: "Post",     icon: FileText  },
    { id: "carrusel", label: "Carrusel", icon: Layers    },
    { id: "historia", label: "Historia", icon: ArrowUpRight },
    { id: "encuesta", label: "Encuesta", icon: Megaphone },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      {/* Form panel */}
      <div className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 self-start">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[var(--foreground)]">Generador de contenido IA</h2>
        </div>

        {/* Format */}
        <div>
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)]">Formato</label>
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setFormat(id)}
                className={[
                  "flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-xs font-semibold transition-all",
                  format === id
                    ? "bg-[rgba(37,99,235,0.1)] border-[#2563EB] text-[#2563EB]"
                    : "bg-[var(--background)] border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[rgba(37,99,235,0.4)]",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tone */}
        <div>
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)]">Tono</label>
          <div className="grid grid-cols-2 gap-1.5">
            {TONES.map(({ id, label, desc }) => (
              <button
                key={id}
                onClick={() => setTone(id)}
                className={[
                  "flex flex-col rounded-xl border px-3 py-2 text-left transition-all",
                  tone === id
                    ? "bg-[rgba(37,99,235,0.1)] border-[#2563EB]"
                    : "bg-[var(--background)] border border-[var(--border)] hover:border-[rgba(37,99,235,0.4)]",
                ].join(" ")}
              >
                <span className={`text-xs font-semibold ${tone === id ? "text-[#2563EB]" : "text-[var(--foreground-muted)]"}`}>{label}</span>
                <span className="text-[10px] text-[var(--foreground-faint)]">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Topic */}
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)]">Tema *</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={2}
            placeholder="Ej: Cómo la IA está transformando el outreach de ventas B2B en LATAM"
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
          />
        </div>

        {/* Industry */}
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)]">Industria objetivo</label>
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Ej: SaaS B2B, Fintech, Consultoría"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
          />
        </div>

        {/* CTA */}
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-muted)]">CTA deseado</label>
          <input
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            placeholder="Ej: Agenda una demo gratuita"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={!topic.trim() || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] py-3 text-sm font-semibold text-white hover:opacity-90 shadow-[0_0_16px_rgba(37,99,235,0.3)] disabled:opacity-70 disabled:cursor-not-allowed transition-all"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Generando…" : "✨ Generar contenido"}
        </button>
      </div>

      {/* Result panel */}
      <div className="space-y-4">
        {/* Output */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
            <p className="text-xs font-bold text-[var(--foreground)]">Contenido generado</p>
            {content && (
              <div className="flex items-center gap-2">
                <span className={`text-[11px] tabular-nums font-medium ${overLimit ? "text-[#EF4444]" : "text-[var(--foreground-muted)]"}`}>
                  {content.length}/{charLimit}
                  {overLimit && " ⚠️ Excede el límite"}
                </span>
                <button onClick={handleGenerate} disabled={loading || !topic.trim()}
                  title="Regenerar"
                  className="rounded-lg p-1.5 text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--foreground)] disabled:opacity-40">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button onClick={handleCopy}
                  className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--foreground-muted)] hover:border-[rgba(37,99,235,0.4)] transition-colors">
                  {copied ? <><Check className="h-3 w-3 text-[#10B981]" /> Copiado</> : <><ClipboardCopy className="h-3 w-3" /> Copiar</>}
                </button>
              </div>
            )}
          </div>

          {content ? (
            <>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full min-h-[240px] resize-none bg-[var(--background)] px-5 py-4 text-sm leading-relaxed text-[var(--foreground)] focus:outline-none"
                style={{ overflow: "hidden" }}
              />
              <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={!content.trim()}
                  className={[
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all",
                    draftSaved
                      ? "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.1)] text-[#10B981]"
                      : "border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]",
                  ].join(" ")}
                >
                  {draftSaved ? <><Check className="h-3 w-3" /> Guardado</> : "Guardar borrador"}
                </button>
                <button
                  onClick={handlePublish}
                  disabled={!content.trim() || publishing}
                  title="La extensión de Chrome publicará este post en tu cuenta de LinkedIn"
                  className={[
                    "ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all",
                    publishStatus === "queued"
                      ? "bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] text-[#10B981]"
                      : publishStatus === "error"
                        ? "bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#EF4444]"
                        : "bg-gradient-to-r from-[#2563EB] to-[#06B6D4] text-white hover:opacity-90 disabled:opacity-40",
                  ].join(" ")}
                >
                  {publishing
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Enviando…</>
                    : publishStatus === "queued"
                      ? <><Check className="h-3 w-3" /> En cola para publicar</>
                      : publishStatus === "error"
                        ? "Error — reintentar"
                        : <><Send className="h-3 w-3" /> Publicar ahora</>}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Sparkles className="h-10 w-10 text-[var(--foreground-faint)] opacity-40" />
              <p className="text-sm font-medium text-[var(--foreground-muted)]">El contenido generado aparecerá aquí</p>
              <p className="text-xs text-[var(--foreground-faint)]">Completa el formulario y haz clic en Generar</p>
            </div>
          )}
        </div>

        {/* Draft history */}
        {drafts.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3">
              <History className="h-3.5 w-3.5 text-[var(--foreground-muted)]" />
              <p className="text-xs font-bold text-[var(--foreground)]">Últimos borradores</p>
              <span className="ml-auto text-[10px] text-[var(--foreground-muted)]">{drafts.length} guardados</span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {drafts.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[var(--foreground)]">{d.topic || "(sin tema)"}</p>
                    <p className="text-[10px] text-[var(--foreground-muted)] capitalize">{d.format} · {relDate(d.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => loadFromDraft(d)}
                    className="flex-shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[10px] font-semibold text-[var(--foreground-muted)] hover:border-[rgba(37,99,235,0.4)] transition-colors"
                  >
                    Cargar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -- Main view -----------------------------------------------------------------

interface InboundViewProps {
  initialPosts: InboundPost[];
  initialLeads: InboundLead[];
}

export function InboundView({ initialPosts, initialLeads }: InboundViewProps) {
  const [tab,   setTab]   = useState<Tab>("monitor");
  const [posts, setPosts] = useState<InboundPost[]>(initialPosts);
  const [leads]           = useState<InboundLead[]>(initialLeads);

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "monitor",   label: "Monitor de Posts",       badge: posts.filter(p => p.status === "monitoring").length },
    { id: "generador", label: "Generador de Contenido IA" },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--foreground)]">Inbound</h1>
          <p className="text-xs text-[var(--foreground-muted)]">Captura leads de posts de LinkedIn · Genera contenido con IA</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-shrink-0 border-b border-[var(--border)] bg-[var(--background)] px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-colors",
              tab === t.id
                ? "border-b-2 border-[#2563EB] text-[#2563EB]"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
            ].join(" ")}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="rounded-full bg-[rgba(16,185,129,0.15)] px-1.5 py-0.5 text-[9px] font-bold text-[#10B981]">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[var(--background)] p-6">
        {tab === "monitor" && (
          <MonitorTab posts={posts} leads={leads} onPostsChange={setPosts} />
        )}
        {tab === "generador" && (
          <GeneradorTab />
        )}
      </div>
    </div>
  );
}
