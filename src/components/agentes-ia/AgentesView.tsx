"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Bot, Brain, ChevronRight, MessageSquare, Pause, Play,
  Plus, Send, Sparkles, Target, Trash2, X, Zap,
} from "lucide-react";
import {
  getAgents,
  upsertAgent,
  toggleAgentStatus,
  deleteAgent as deleteAgentAction,
  type AgentRow,
} from "@/app/dashboard/agentes-ia/actions";


// -- Types ---------------------------------------------------------------------

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

// -- Mock data -----------------------------------------------------------------

const AVATAR_GRADS = [
  "from-[#2563EB] to-[#06B6D4]",
  "from-[#06B6D4] to-[#2563EB]",
  "from-[#1D4ED8] to-[#0891B2]",
  "from-[#3B82F6] to-[#06B6D4]",
  "from-[#2563EB] to-[#0EA5E9]",
  "from-[#0369A1] to-[#06B6D4]",
];

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

// -- Subcomponents --------------------------------------------------------------

function AgentCard({ agent, onSelect, onToggle, onDelete }: {
  agent: Agent;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const statusCls = {
    active: "bg-[rgba(16,185,129,0.12)] text-[#10B981]",
    paused: "bg-[rgba(245,158,11,0.12)] text-[#F59E0B]",
    draft:  "bg-[var(--border)] text-[var(--foreground-faint)]",
  }[agent.status];

  const objLabel = OBJECTIVE_OPTIONS.find((o) => o.id === agent.objective)?.label ?? agent.objective;

  return (
    <div className="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition-all hover:shadow-md hover:border-[rgba(37,99,235,0.4)]">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onSelect} className="flex items-center gap-3 text-left flex-1 min-w-0">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[rgba(37,99,235,0.12)] text-2xl">
            {agent.emoji}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--foreground)]">{agent.name}</p>
            <p className="text-[11px] text-[var(--foreground-muted)] truncate">{objLabel}</p>
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
                ? "text-[#F59E0B] hover:bg-[rgba(245,158,11,0.1)]"
                : "text-[#10B981] hover:bg-[rgba(16,185,129,0.1)]",
            ].join(" ")}
            title={agent.status === "active" ? "Pausar" : "Activar"}
          >
            {agent.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-[var(--foreground-faint)] transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[#EF4444]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
        <div className="rounded-lg bg-[var(--background)] px-3 py-2 text-center">
          <p className="text-lg font-black tabular-nums text-[var(--foreground)]">{agent.conversations}</p>
          <p className="text-[10px] text-[var(--foreground-muted)]">conversaciones</p>
        </div>
        <div className="rounded-lg bg-[rgba(37,99,235,0.08)] px-3 py-2 text-center">
          <p className="text-lg font-black tabular-nums text-[#2563EB]">{agent.meetings}</p>
          <p className="text-[10px] text-[#06B6D4]">reuniones</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {agent.icp.industries.slice(0, 2).map((i) => (
          <span key={i} className="rounded-full bg-[rgba(37,99,235,0.1)] px-2 py-0.5 text-[10px] font-medium text-[#2563EB]">{i}</span>
        ))}
        {agent.icp.roles.slice(0, 2).map((r) => (
          <span key={r} className="rounded-full bg-[rgba(6,182,212,0.1)] px-2 py-0.5 text-[10px] font-medium text-[#06B6D4]">{r}</span>
        ))}
      </div>

      <button
        onClick={onSelect}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] py-2 text-xs font-medium text-[var(--foreground-muted)] transition-colors hover:border-[rgba(37,99,235,0.4)] hover:bg-[rgba(37,99,235,0.06)] hover:text-[#2563EB]"
      >
        Editar agente <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// -- Wizard ---------------------------------------------------------------------

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
          isCurrent ? "bg-gradient-to-r from-[#2563EB] to-[#06B6D4] text-white scale-110" : isDone ? "bg-[rgba(37,99,235,0.2)] text-[#2563EB]" : "bg-[var(--border)] text-[var(--foreground-faint)]",
        ].join(" ")}>
          {isDone ? "✓" : idx + 1}
        </div>
        <span className={`text-[10px] font-medium ${isCurrent ? "text-[#2563EB]" : "text-[var(--foreground-muted)]"}`}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-4 bg-[var(--surface)]">
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">
              {initial ? "Editar agente" : "Crear nuevo agente"}
            </h2>
            <p className="text-[11px] text-[var(--foreground-muted)]">Configura el comportamiento de tu agente IA</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--foreground-muted)] hover:bg-[var(--border)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <StepDot s={s} />
              {i < STEPS.length - 1 && (
                <div className={`mx-1.5 h-px w-8 ${STEPS.indexOf(step) > i ? "bg-[#2563EB]" : "bg-[var(--border)]"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* -- IDENTIDAD -- */}
          {step === "identidad" && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">Nombre del agente</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Sofia SDR, Max Reclutador..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">Avatar</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEmoji(e)}
                      className={[
                        "flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all",
                        emoji === e ? "bg-[rgba(37,99,235,0.15)] ring-2 ring-[#2563EB] scale-110" : "bg-[var(--background)] hover:bg-[rgba(37,99,235,0.08)]",
                      ].join(" ")}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">Objetivo principal</label>
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
                            ? "border-[#2563EB] bg-[rgba(37,99,235,0.1)] text-[#2563EB]"
                            : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground-muted)] hover:border-[rgba(37,99,235,0.4)]",
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
                <label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">O elige una plantilla</label>
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
                      className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-center text-xs transition-all hover:border-[rgba(37,99,235,0.4)]"
                    >
                      <span className="text-2xl">{t.emoji}</span>
                      <p className="mt-1 font-bold text-[var(--foreground)]">{t.name}</p>
                      <p className="text-[10px] text-[var(--foreground-muted)]">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* -- ICP -- */}
          {step === "icp" && (
            <div className="space-y-5">
              <p className="text-sm text-[var(--foreground-muted)]">Define a quién debe prospectar tu agente — el Perfil de Cliente Ideal (ICP).</p>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">Industrias objetivo</label>
                <div className="flex flex-wrap gap-2">
                  {ICP_INDUSTRIES.map((i) => (
                    <button
                      key={i}
                      onClick={() => setIndustries((p) => toggle(p, i))}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        industries.includes(i)
                          ? "border-[#2563EB] bg-[rgba(37,99,235,0.12)] text-[#2563EB]"
                          : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground-muted)] hover:border-[rgba(37,99,235,0.4)]",
                      ].join(" ")}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">Cargos / Roles objetivo</label>
                <div className="flex flex-wrap gap-2">
                  {ICP_ROLES.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRoles((p) => toggle(p, r))}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        roles.includes(r)
                          ? "border-[#2563EB] bg-[rgba(37,99,235,0.12)] text-[#2563EB]"
                          : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground-muted)] hover:border-[rgba(37,99,235,0.4)]",
                      ].join(" ")}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">Tamaño de empresa</label>
                <div className="flex flex-wrap gap-2">
                  {ICP_SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSizes((p) => toggle(p, s))}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        sizes.includes(s)
                          ? "border-[#2563EB] bg-[rgba(37,99,235,0.12)] text-[#2563EB]"
                          : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground-muted)] hover:border-[rgba(37,99,235,0.4)]",
                      ].join(" ")}
                    >
                      {s} empleados
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* -- TONO -- */}
          {step === "tono" && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--foreground-muted)]">El tono determina cómo escribe y habla tu agente en cada conversación.</p>
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setTone(opt.id)}
                  className={[
                    "w-full rounded-xl border-2 p-4 text-left transition-all",
                    tone === opt.id
                      ? "border-[#2563EB] bg-[rgba(37,99,235,0.08)]"
                      : "border-[var(--border)] bg-[var(--background)] hover:border-[rgba(37,99,235,0.4)]",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--foreground)]">{opt.label}</span>
                    {tone === opt.id && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4]">
                        <span className="text-[10px] text-white">✓</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 rounded-lg bg-[var(--surface)] px-3 py-2 text-xs italic text-[var(--foreground-muted)] border border-[var(--border)]">
                    "{opt.example}"
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* -- PROPUESTA -- */}
          {step === "propuesta" && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">Propuesta de valor principal</label>
                <p className="mb-3 text-[12px] text-[var(--foreground-muted)]">
                  En 2-3 frases, explica qué problema resuelves y qué beneficio tangible obtendrá el prospecto.
                </p>
                <textarea
                  value={valueProp}
                  onChange={(e) => setValueProp(e.target.value)}
                  rows={4}
                  placeholder="Ej: cazary.ai automatiza el 80% del proceso de prospección en LinkedIn, permitiendo que tu equipo de SDRs se enfoque en cerrar deals. Nuestros clientes consiguen 3x más reuniones sin contratar más personal..."
                  className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
                />
                <p className="mt-1 text-right text-[11px] text-[var(--foreground-faint)]">{valueProp.length} / 500 caracteres</p>
              </div>
              <div className="rounded-xl border border-[rgba(37,99,235,0.15)] bg-[rgba(37,99,235,0.06)] p-4">
                <div className="flex gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#2563EB]" />
                  <div>
                    <p className="text-xs font-semibold text-[#2563EB]">Tip IA</p>
                    <p className="text-[11px] text-[var(--foreground-muted)]">
                      Las mejores propuestas de valor mencionan un número concreto (3x, 80%, 5h/semana) y hacen referencia al cargo o industria del prospecto.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* -- OBJECIONES -- */}
          {step === "objeciones" && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--foreground-muted)]">
                Enseña a tu agente cómo responder a las objeciones más comunes. Cuantas más entrenadas, mejor tasa de conversión.
              </p>

              {objections.map((obj, idx) => (
                <div key={obj.id} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[var(--foreground-muted)] mb-1">Objeción #{idx + 1}</p>
                      <p className="text-sm font-medium text-[var(--foreground)]">"{obj.question}"</p>
                      <p className="mt-1.5 text-xs text-[var(--foreground-muted)] italic">→ "{obj.answer}"</p>
                    </div>
                    <button
                      onClick={() => setObjections((p) => p.filter((o) => o.id !== obj.id))}
                      className="text-[var(--foreground-faint)] hover:text-[#EF4444]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--background)] p-4 space-y-3">
                <p className="text-xs font-semibold text-[var(--foreground-muted)]">+ Agregar objeción</p>
                <input
                  value={newObj.question}
                  onChange={(e) => setNewObj((p) => ({ ...p, question: e.target.value }))}
                  placeholder="Objeción del prospecto..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
                />
                <textarea
                  value={newObj.answer}
                  onChange={(e) => setNewObj((p) => ({ ...p, answer: e.target.value }))}
                  rows={2}
                  placeholder="Respuesta sugerida del agente..."
                  className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
                />
                <button
                  onClick={addObjection}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[rgba(37,99,235,0.1)] hover:text-[#2563EB]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              </div>
            </div>
          )}

          {/* -- TEST CHAT -- */}
          {step === "test" && (
            <div className="flex flex-col" style={{ height: "380px" }}>
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-[rgba(37,99,235,0.15)] bg-[rgba(37,99,235,0.06)] px-4 py-2.5">
                <Bot className="h-4 w-4 text-[#2563EB]" />
                <p className="text-[12px] text-[var(--foreground-muted)]">
                  Escribe como si fueras un prospecto. El agente <strong className="text-[var(--foreground)]">{name || "IA"}</strong> responderá con tono <strong className="text-[var(--foreground)]">{tone}</strong>.
                </p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                {testMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "prospect" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "agent" && (
                      <div className="mr-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(37,99,235,0.12)] text-base">
                        {emoji}
                      </div>
                    )}
                    <div className={[
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                      msg.role === "agent"
                        ? "rounded-tl-none bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]"
                        : "rounded-tr-none bg-gradient-to-r from-[#2563EB] to-[#06B6D4] text-white",
                    ].join(" ")}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(37,99,235,0.12)] text-base">{emoji}</div>
                    <div className="flex gap-1 rounded-2xl rounded-tl-none bg-[var(--surface)] border border-[var(--border)] px-4 py-3">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-1.5 w-1.5 rounded-full bg-[var(--foreground-muted)] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
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
                  className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[rgba(37,99,235,0.3)]"
                />
                <button
                  onClick={handleTestSend}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] text-white hover:opacity-90"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
          <button
            onClick={() => {
              const prev = STEPS[stepIdx - 1];
              if (prev) setStep(prev);
            }}
            disabled={stepIdx === 0}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-30"
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
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleSave("draft")}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-5 py-2 text-sm font-semibold text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.04)]"
                >
                  Guardar borrador
                </button>
                <button
                  onClick={() => handleSave("active")}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
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

// -- MAIN VIEW -----------------------------------------------------------------

function mapRowToAgent(row: AgentRow): Agent {
  return {
    id:            row.id,
    name:          row.name,
    emoji:         row.emoji,
    tone:          row.tone as AgentTone,
    objective:     row.objective as AgentObjective,
    icp:           row.icp as Agent["icp"],
    valueProp:     row.value_proposition,
    objections:    row.objections as Objection[],
    status:        row.status,
    conversations: 0,
    meetings:      0,
  };
}

export function AgentesView() {
  const [agents, setAgents]           = useState<Agent[]>([]);
  const [wizardOpen, setWizardOpen]   = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isPending, startTransition]  = useTransition();

  useEffect(() => {
    getAgents().then((result) => {
      if (result.success && result.data) {
        setAgents(result.data.map(mapRowToAgent));
      }
    });
  }, []);

  function toggleAgent(id: string) {
    const agent = agents.find((a) => a.id === id);
    if (!agent) return;
    setAgents((p) =>
      p.map((a) => a.id === id ? { ...a, status: a.status === "active" ? "paused" : "active" } : a)
    );
    startTransition(async () => {
      await toggleAgentStatus(id, agent.status);
    });
  }

  function deleteAgent(id: string) {
    setAgents((p) => p.filter((a) => a.id !== id));
    startTransition(async () => {
      await deleteAgentAction(id);
    });
  }

  function saveAgent(data: Omit<Agent, "id" | "conversations" | "meetings">) {
    startTransition(async () => {
      const result = await upsertAgent({
        id:                editingAgent?.id,
        name:              data.name,
        emoji:             data.emoji,
        tone:              data.tone,
        objective:         data.objective,
        icp:               data.icp,
        value_proposition: data.valueProp,
        objections:        data.objections,
        status:            data.status,
      });
      if (result.success && result.data) {
        const updated = mapRowToAgent(result.data);
        if (editingAgent) {
          setAgents((p) => p.map((a) => a.id === editingAgent.id ? updated : a));
        } else {
          setAgents((p) => [...p, updated]);
        }
      }
      setWizardOpen(false);
      setEditingAgent(null);
    });
  }

  const activeCount = agents.filter((a) => a.status === "active").length;
  const totalMeetings = agents.reduce((s, a) => s + a.meetings, 0);
  const totalConvs = agents.reduce((s, a) => s + a.conversations, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-[var(--background)] px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--foreground)]">Agentes IA</h1>
          <p className="text-xs text-[var(--foreground-muted)]">Crea y entrena agentes que prospectan y convierten de forma autónoma</p>
        </div>
        <button
          onClick={() => { setEditingAgent(null); setWizardOpen(true); }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(37,99,235,0.3)] hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Crear agente
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex flex-shrink-0 gap-6 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
        {[
          { label: "Agentes activos", value: activeCount, icon: Zap, color: "text-[#10B981] bg-[rgba(16,185,129,0.12)]" },
          { label: "Conversaciones totales", value: totalConvs, icon: MessageSquare, color: "text-[#2563EB] bg-[rgba(37,99,235,0.12)]" },
          { label: "Reuniones generadas", value: totalMeetings, icon: Target, color: "text-[#06B6D4] bg-[rgba(6,182,212,0.12)]" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${color}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--foreground-muted)]">{label}</p>
              <p className="text-sm font-black tabular-nums text-[var(--foreground)]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[var(--background)] p-6">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
              <Bot className="h-8 w-8 text-[var(--foreground-muted)]" />
            </div>
            <p className="text-base font-semibold text-[var(--foreground)]">Sin agentes configurados</p>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">Crea tu primer agente IA para empezar a prospectar de forma autónoma</p>
            <button
              onClick={() => { setEditingAgent(null); setWizardOpen(true); }}
              className="mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(37,99,235,0.3)] hover:opacity-90"
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
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] p-8 transition-all hover:border-[rgba(37,99,235,0.4)] hover:bg-[rgba(37,99,235,0.04)]"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface)]">
                <Plus className="h-6 w-6 text-[var(--foreground-faint)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--foreground-muted)]">Nuevo agente</p>
              <p className="mt-1 text-[12px] text-[var(--foreground-faint)]">Haz clic para crear</p>
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
