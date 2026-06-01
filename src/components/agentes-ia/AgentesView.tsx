"use client";

import { useState, useEffect } from "react";
import {
  Bot, Brain, ChevronRight, MessageSquare, Pause, Play,
  Plus, Send, Sparkles, Target, Trash2, X, Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";


// ── Types ─────────────────────────────────────────────────────────────────────

type AgentTone = "formal" | "consultivo" | "amigable" | "directo";
type AgentObjective = "agendar_reunion" | "enviar_propuesta" | "calificar_lead" | "nutrir_lead";
type WizardStep = "identidad" | "icp" | "tono" | "propuesta" | "objeciones" | "test";

interface Objection {
  id: string;
  question: string;
  answer: string;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  tone: AgentTone;
  objective: AgentObjective;
  icp: { industries: string[]; roles: string[]; sizes: string[] };
  valueProp: string;
  objections: Objection[];
  status: "active" | "paused" | "draft";
  conversations: number;
  meetings: number;
}

interface TestMessage {
  role: "prospect" | "agent";
  text: string;
}

// ── Mock data ─────────────────────────────────────────────────────────────────


const TEMPLATES = [
  { emoji: "🎯", name: "SDR B2B", tone: "consultivo" as AgentTone, objective: "agendar_reunion" as AgentObjective, desc: "Prospección SaaS/B2B, cierra demos" },
  { emoji: "💼", name: "Reclutador", tone: "amigable" as AgentTone, objective: "calificar_lead" as AgentObjective, desc: "Búsqueda de talento pasivo" },
  { emoji: "📊", name: "Consultor", tone: "formal" as AgentTone, objective: "enviar_propuesta" as AgentObjective, desc: "Servicios profesionales y consultoría" },
];

const TONE_OPTIONS: { id: AgentTone; label: string; example: string }[] = [
  { id: "formal",     label: "Formal",     example: "Estimado/a [Nombre], me dirijo a usted para..." },
  { id: "consultivo", label: "Consultivo",  example: "Hola [Nombre], vi tu perfil y me pregunto si..." },
  { id: "amigable",   label: "Amigable",   example: "¡Hola [Nombre]! Soy Sofía y quería conectar porque..." },
  { id: "directo",    label: "Directo",     example: "[Nombre], voy al grano: te ahorramos 5h/semana en prospección." },
];

const OBJECTIVE_OPTIONS: { id: AgentObjective; label: string; icon: React.ElementType }[] = [
  { id: "agendar_reunion",  label: "Agendar reunión / demo", icon: Target },
  { id: "enviar_propuesta", label: "Enviar propuesta",        icon: MessageSquare },
  { id: "calificar_lead",   label: "Calificar lead",          icon: Brain },
  { id: "nutrir_lead",      label: "Nutrir lead (seguimiento)", icon: Sparkles },
];

const ICP_INDUSTRIES = ["SaaS", "Fintech", "Reclutamiento", "Consultoría", "E-commerce", "Salud", "Educación", "Retail", "Manufactura", "Inmobiliaria"];
const ICP_ROLES       = ["CEO", "Fundador", "VP Ventas", "Director Comercial", "SDR Manager", "HR Manager", "CTO", "Marketing Manager", "Gerente General"];
const ICP_SIZES       = ["1-10", "10-50", "50-200", "200-1000", "1000+"];

// ── Subcomponents ──────────────────────────────────────────────────────────────

function AgentCard({ agent, onSelect, onToggle, onDelete }: {
  agent: Agent;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const statusCls = {
    active: "bg-green-100 text-green-700",
    paused: "bg-amber-100 text-amber-700",
    draft:  "bg-zinc-100 text-zinc-500",
  }[agent.status];

  const objLabel = OBJECTIVE_OPTIONS.find((o) => o.id === agent.objective)?.label ?? agent.objective;

  return (
    <div className="group relative rounded-2xl border border-border bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onSelect} className="flex items-center gap-3 text-left flex-1 min-w-0">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 text-2xl">
            {agent.emoji}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-900">{agent.name}</p>
            <p className="text-[11px] text-zinc-500 truncate">{objLabel}</p>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${statusCls}`}>
              {agent.status === "active" ? "Activo" : agent.status === "paused" ? "Pausado" : "Borrador"}
            </span>
          </div>
        </button>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={onToggle}
            className={[
              "rounded-lg p-1.5 transition-colors",
              agent.status === "active"
                ? "text-amber-500 hover:bg-amber-50"
                : "text-green-500 hover:bg-green-50",
            ].join(" ")}
            title={agent.status === "active" ? "Pausar" : "Activar"}
          >
            {agent.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-50 pt-4">
        <div className="rounded-lg bg-zinc-50 px-3 py-2 text-center">
          <p className="text-lg font-black tabular-nums text-zinc-900">{agent.conversations}</p>
          <p className="text-[10px] text-zinc-400">conversaciones</p>
        </div>
        <div className="rounded-lg bg-indigo-50 px-3 py-2 text-center">
          <p className="text-lg font-black tabular-nums text-indigo-700">{agent.meetings}</p>
          <p className="text-[10px] text-indigo-400">reuniones</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {agent.icp.industries.slice(0, 2).map((i) => (
          <span key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">{i}</span>
        ))}
        {agent.icp.roles.slice(0, 2).map((r) => (
          <span key={r} className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600">{r}</span>
        ))}
      </div>

      <button
        onClick={onSelect}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-100 py-2 text-xs font-medium text-zinc-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
      >
        Editar agente <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Wizard ─────────────────────────────────────────────────────────────────────

function AgentWizard({ initial, onClose, onSave }: {
  initial?: Partial<Agent>;
  onClose: () => void;
  onSave: (agent: Omit<Agent, "id" | "conversations" | "meetings">) => void;
}) {
  const [step, setStep] = useState<WizardStep>("identidad");
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🤖");
  const [tone, setTone] = useState<AgentTone>(initial?.tone ?? "consultivo");
  const [objective, setObjective] = useState<AgentObjective>(initial?.objective ?? "agendar_reunion");
  const [industries, setIndustries] = useState<string[]>(initial?.icp?.industries ?? []);
  const [roles, setRoles] = useState<string[]>(initial?.icp?.roles ?? []);
  const [sizes, setSizes] = useState<string[]>(initial?.icp?.sizes ?? []);
  const [valueProp, setValueProp] = useState(initial?.valueProp ?? "");
  const [objections, setObjections] = useState<Objection[]>(initial?.objections ?? []);
  const [newObj, setNewObj] = useState({ question: "", answer: "" });

  // Test chat
  const [testMessages, setTestMessages] = useState<TestMessage[]>([
    { role: "agent", text: `¡Hola! Soy ${name || "tu agente"} 👋 Escribe como si fueras un prospecto y veré cómo respondo.` },
  ]);
  const [testInput, setTestInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const STEPS: WizardStep[] = ["identidad", "icp", "tono", "propuesta", "objeciones", "test"];
  const stepIdx = STEPS.indexOf(step);

  const EMOJIS = ["🤖", "🤝", "💼", "🎯", "🧠", "⚡", "🚀", "💡", "🌟", "👔", "📊", "🎪"];

  function toggle<T>(arr: T[], val: T) {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  function addObjection() {
    if (!newObj.question.trim() || !newObj.answer.trim()) return;
    setObjections((p) => [...p, { id: `o_${Date.now()}`, ...newObj }]);
    setNewObj({ question: "", answer: "" });
  }

  async function handleTestSend() {
    if (!testInput.trim() || isTyping) return;
    const userMsg = testInput.trim();
    const prospect: TestMessage = { role: "prospect", text: userMsg };
    const historySnapshot = [...testMessages];
    setTestMessages((p) => [...p, prospect]);
    setTestInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/agents/test-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_config: {
            tone,
            objective,
            value_proposition: valueProp,
            objections,
          },
          prospect_message: userMsg,
          conversation_history: historySnapshot
            .filter((m) => m.role !== "agent" || historySnapshot.indexOf(m) > 0)
            .map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      const reply = data.reply ?? "Lo siento, no pude generar una respuesta.";
      setTestMessages((p) => [...p, { role: "agent", text: reply }]);
    } catch {
      setTestMessages((p) => [...p, { role: "agent", text: "Error al conectar con el backend. Verifica que el servidor esté corriendo." }]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleSave(status: "active" | "draft" = "active") {
    if (!name.trim()) { setStep("identidad"); return; }
    onSave({
      name, emoji, tone, objective,
      icp: { industries, roles, sizes },
      valueProp, objections,
      status,
    });
  }

  const StepDot = ({ s }: { s: WizardStep }) => {
    const idx = STEPS.indexOf(s);
    const isCurrent = s === step;
    const isDone = idx < stepIdx;
    return (
      <button onClick={() => setStep(s)} className="flex flex-col items-center gap-1">
        <div className={[
          "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all",
          isCurrent ? "bg-indigo-600 text-white scale-110" : isDone ? "bg-indigo-100 text-indigo-600" : "bg-zinc-100 text-zinc-400",
        ].join(" ")}>
          {isDone ? "✓" : idx + 1}
        </div>
        <span className={`text-[10px] font-medium ${isCurrent ? "text-indigo-600" : "text-zinc-400"}`}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              {initial ? "Editar agente" : "Crear nuevo agente"}
            </h2>
            <p className="text-[11px] text-zinc-400">Configura el comportamiento de tu agente IA</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-50 bg-zinc-50/50 px-6 py-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <StepDot s={s} />
              {i < STEPS.length - 1 && (
                <div className={`mx-1.5 h-px w-8 ${STEPS.indexOf(step) > i ? "bg-indigo-300" : "bg-zinc-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── IDENTIDAD ── */}
          {step === "identidad" && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-800">Nombre del agente</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Sofia SDR, Max Reclutador..."
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-800">Avatar</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEmoji(e)}
                      className={[
                        "flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all",
                        emoji === e ? "bg-indigo-100 ring-2 ring-indigo-400 scale-110" : "bg-zinc-50 hover:bg-zinc-100",
                      ].join(" ")}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-800">Objetivo principal</label>
                <div className="grid grid-cols-2 gap-2">
                  {OBJECTIVE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setObjective(opt.id)}
                        className={[
                          "flex items-center gap-2.5 rounded-xl border-2 p-3 text-left text-sm transition-all",
                          objective === opt.id
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-zinc-200 text-zinc-600 hover:border-zinc-300",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-800">O elige una plantilla</label>
                <div className="grid grid-cols-3 gap-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => {
                        setName(t.name);
                        setEmoji(t.emoji);
                        setTone(t.tone);
                        setObjective(t.objective);
                      }}
                      className="rounded-xl border border-zinc-200 p-3 text-center text-xs transition-all hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      <span className="text-2xl">{t.emoji}</span>
                      <p className="mt-1 font-bold text-zinc-800">{t.name}</p>
                      <p className="text-[10px] text-zinc-400">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ICP ── */}
          {step === "icp" && (
            <div className="space-y-5">
              <p className="text-sm text-zinc-500">Define a quién debe prospectar tu agente — el Perfil de Cliente Ideal (ICP).</p>
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-800">Industrias objetivo</label>
                <div className="flex flex-wrap gap-2">
                  {ICP_INDUSTRIES.map((i) => (
                    <button
                      key={i}
                      onClick={() => setIndustries((p) => toggle(p, i))}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        industries.includes(i)
                          ? "border-indigo-400 bg-indigo-100 text-indigo-700"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300",
                      ].join(" ")}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-800">Cargos / Roles objetivo</label>
                <div className="flex flex-wrap gap-2">
                  {ICP_ROLES.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRoles((p) => toggle(p, r))}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        roles.includes(r)
                          ? "border-violet-400 bg-violet-100 text-violet-700"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300",
                      ].join(" ")}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-800">Tamaño de empresa</label>
                <div className="flex flex-wrap gap-2">
                  {ICP_SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSizes((p) => toggle(p, s))}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        sizes.includes(s)
                          ? "border-sky-400 bg-sky-100 text-sky-700"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300",
                      ].join(" ")}
                    >
                      {s} empleados
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TONO ── */}
          {step === "tono" && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">El tono determina cómo escribe y habla tu agente en cada conversación.</p>
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setTone(opt.id)}
                  className={[
                    "w-full rounded-xl border-2 p-4 text-left transition-all",
                    tone === opt.id
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-zinc-200 hover:border-zinc-300",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-zinc-900">{opt.label}</span>
                    {tone === opt.id && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600">
                        <span className="text-[10px] text-white">✓</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs italic text-zinc-500 border border-zinc-100">
                    "{opt.example}"
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* ── PROPUESTA ── */}
          {step === "propuesta" && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-800">Propuesta de valor principal</label>
                <p className="mb-3 text-[12px] text-zinc-400">
                  En 2-3 frases, explica qué problema resuelves y qué beneficio tangible obtendrá el prospecto.
                </p>
                <textarea
                  value={valueProp}
                  onChange={(e) => setValueProp(e.target.value)}
                  rows={4}
                  placeholder="Ej: NexusAI automatiza el 80% del proceso de prospección en LinkedIn, permitiendo que tu equipo de SDRs se enfoque en cerrar deals. Nuestros clientes consiguen 3x más reuniones sin contratar más personal..."
                  className="w-full resize-none rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <p className="mt-1 text-right text-[11px] text-zinc-300">{valueProp.length} / 500 caracteres</p>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                <div className="flex gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500" />
                  <div>
                    <p className="text-xs font-semibold text-indigo-800">Tip IA</p>
                    <p className="text-[11px] text-indigo-600">
                      Las mejores propuestas de valor mencionan un número concreto (3x, 80%, 5h/semana) y hacen referencia al cargo o industria del prospecto.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── OBJECIONES ── */}
          {step === "objeciones" && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">
                Enseña a tu agente cómo responder a las objeciones más comunes. Cuantas más entrenadas, mejor tasa de conversión.
              </p>

              {objections.map((obj, idx) => (
                <div key={obj.id} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-zinc-500 mb-1">Objeción #{idx + 1}</p>
                      <p className="text-sm font-medium text-zinc-800">"{obj.question}"</p>
                      <p className="mt-1.5 text-xs text-zinc-500 italic">→ "{obj.answer}"</p>
                    </div>
                    <button
                      onClick={() => setObjections((p) => p.filter((o) => o.id !== obj.id))}
                      className="text-zinc-300 hover:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="rounded-xl border-2 border-dashed border-zinc-200 p-4 space-y-3">
                <p className="text-xs font-semibold text-zinc-600">+ Agregar objeción</p>
                <input
                  value={newObj.question}
                  onChange={(e) => setNewObj((p) => ({ ...p, question: e.target.value }))}
                  placeholder="Objeción del prospecto..."
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
                <textarea
                  value={newObj.answer}
                  onChange={(e) => setNewObj((p) => ({ ...p, answer: e.target.value }))}
                  rows={2}
                  placeholder="Respuesta sugerida del agente..."
                  className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
                <button
                  onClick={addObjection}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              </div>
            </div>
          )}

          {/* ── TEST CHAT ── */}
          {step === "test" && (
            <div className="flex flex-col" style={{ height: "380px" }}>
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-2.5">
                <Bot className="h-4 w-4 text-indigo-500" />
                <p className="text-[12px] text-indigo-700">
                  Escribe como si fueras un prospecto. El agente <strong>{name || "IA"}</strong> responderá con tono <strong>{tone}</strong>.
                </p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                {testMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "prospect" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "agent" && (
                      <div className="mr-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-base">
                        {emoji}
                      </div>
                    )}
                    <div className={[
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                      msg.role === "agent"
                        ? "rounded-tl-none bg-white text-zinc-800 shadow-sm"
                        : "rounded-tr-none bg-indigo-600 text-white",
                    ].join(" ")}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-base">{emoji}</div>
                    <div className="flex gap-1 rounded-2xl rounded-tl-none bg-white px-4 py-3 shadow-sm">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="mt-3 flex gap-2">
                <input
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTestSend()}
                  placeholder="Escribe como el prospecto..."
                  className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  onClick={handleTestSend}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-zinc-100 px-6 py-4">
          <button
            onClick={() => {
              const prev = STEPS[stepIdx - 1];
              if (prev) setStep(prev);
            }}
            disabled={stepIdx === 0}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
          >
            Anterior
          </button>

          <div className="flex gap-2">
            {step !== "test" ? (
              <button
                onClick={() => {
                  const next = STEPS[stepIdx + 1];
                  if (next) setStep(next);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleSave("draft")}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Guardar borrador
                </button>
                <button
                  onClick={() => handleSave("active")}
                  className="flex items-center gap-1.5 rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  <Zap className="h-4 w-4" />
                  Activar agente
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN VIEW ─────────────────────────────────────────────────────────────────

export function AgentesView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase
          .from("agents")
          .select("*")
          .order("created_at", { ascending: false });
        const list: Agent[] = (data ?? []).map((a) => ({
          id:            String(a.id),
          name:          String(a.name ?? "Agente"),
          emoji:         String(a.avatar_emoji ?? "🤖"),
          tone:          (a.tone as Agent["tone"]) ?? "consultivo",
          objective:     (a.objective as Agent["objective"]) ?? "agendar_reunion",
          icp:           { industries: (a.icp_industries as string[]) ?? [], roles: (a.icp_roles as string[]) ?? [], sizes: [] },
          valueProp:     String(a.value_proposition ?? ""),
          objections:    (a.objections as Agent["objections"]) ?? [],
          status:        (a.status as Agent["status"]) ?? "active",
          conversations: Number(a.conversations_count ?? 0),
          meetings:      Number(a.meetings_count ?? 0),
        }));
        setAgents(list);
      } catch { setAgents([]); }
    })();
  }, []);

  function toggleAgent(id: string) {
    setAgents((p) =>
      p.map((a) =>
        a.id === id
          ? { ...a, status: a.status === "active" ? "paused" : "active" }
          : a
      )
    );
  }

  function deleteAgent(id: string) {
    setAgents((p) => p.filter((a) => a.id !== id));
  }

  function saveAgent(data: Omit<Agent, "id" | "conversations" | "meetings">) {
    if (editingAgent) {
      setAgents((p) => p.map((a) => a.id === editingAgent.id ? { ...a, ...data } : a));
    } else {
      setAgents((p) => [...p, {
        id: `a_${Date.now()}`, conversations: 0, meetings: 0, ...data,
      }]);
    }
    setWizardOpen(false);
    setEditingAgent(null);
  }

  const activeCount = agents.filter((a) => a.status === "active").length;
  const totalMeetings = agents.reduce((s, a) => s + a.meetings, 0);
  const totalConvs = agents.reduce((s, a) => s + a.conversations, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Agentes IA</h1>
          <p className="text-xs text-zinc-400">Crea y entrena agentes que prospectan y convierten de forma autónoma</p>
        </div>
        <button
          onClick={() => { setEditingAgent(null); setWizardOpen(true); }}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Crear agente
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex flex-shrink-0 gap-6 border-b border-border bg-white px-6 py-3">
        {[
          { label: "Agentes activos", value: activeCount, icon: Zap, color: "text-green-600 bg-green-50" },
          { label: "Conversaciones totales", value: totalConvs, icon: MessageSquare, color: "text-blue-600 bg-blue-50" },
          { label: "Reuniones generadas", value: totalMeetings, icon: Target, color: "text-indigo-600 bg-indigo-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${color}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">{label}</p>
              <p className="text-sm font-black tabular-nums text-zinc-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
              <Bot className="h-8 w-8 text-indigo-400" />
            </div>
            <p className="text-base font-semibold text-zinc-600">Sin agentes configurados</p>
            <p className="mt-1 text-sm text-zinc-400">Crea tu primer agente IA para empezar a prospectar de forma autónoma</p>
            <button
              onClick={() => { setEditingAgent(null); setWizardOpen(true); }}
              className="mt-5 flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Crear primer agente
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onSelect={() => { setEditingAgent(agent); setWizardOpen(true); }}
                onToggle={() => toggleAgent(agent.id)}
                onDelete={() => deleteAgent(agent.id)}
              />
            ))}
            {/* New agent card */}
            <button
              onClick={() => { setEditingAgent(null); setWizardOpen(true); }}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 p-8 transition-all hover:border-indigo-300 hover:bg-indigo-50/30"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
                <Plus className="h-6 w-6 text-zinc-400" />
              </div>
              <p className="text-sm font-semibold text-zinc-500">Nuevo agente</p>
              <p className="mt-1 text-[12px] text-zinc-300">Haz clic para crear</p>
            </button>
          </div>
        )}
      </div>

      {/* Wizard */}
      {wizardOpen && (
        <AgentWizard
          initial={editingAgent ?? undefined}
          onClose={() => { setWizardOpen(false); setEditingAgent(null); }}
          onSave={saveAgent}
        />
      )}
    </div>
  );
}
