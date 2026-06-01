"use client";

import { X } from "lucide-react";
import type { Node } from "@xyflow/react";
import type { NodeData } from "./types";

// ── Variables ─────────────────────────────────────────────────────────────────

const VARIABLES = [
  { key: "nombre",  label: "{{nombre}}"  },
  { key: "empresa", label: "{{empresa}}" },
  { key: "puesto",  label: "{{puesto}}"  },
  { key: "ciudad",  label: "{{ciudad}}"  },
];

// ── Sub-panels ────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{children}</label>;
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  fieldKey,
  onInsertVariable,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  fieldKey: string;
  onInsertVariable: (field: string, variable: string) => void;
}) {
  return (
    <div>
      <textarea
        id={`ta-${fieldKey}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
      <div className="mt-1.5 flex flex-wrap gap-1">
        {VARIABLES.map((v) => (
          <button
            key={v.key}
            onClick={() => onInsertVariable(fieldKey, v.label)}
            className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ABTestToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2">
      <span className="text-xs font-medium text-zinc-700">Test A/B</span>
      <button
        onClick={() => onChange(!enabled)}
        className={[
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          enabled ? "bg-indigo-500" : "bg-zinc-300",
        ].join(" ")}
      >
        <span className={["inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform", enabled ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
      </button>
    </div>
  );
}

// ── Panel content per node type ───────────────────────────────────────────────

function ConnectPanel({ data, update }: { data: NodeData; update: (d: Partial<NodeData>) => void }) {
  function insertVariable(field: string, variable: string) {
    const current = (data[field as keyof NodeData] as string) ?? "";
    update({ [field]: current + variable });
  }

  return (
    <div className="space-y-4">
      {/* Toggle add note */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5">
        <div>
          <p className="text-xs font-medium text-zinc-800">Añadir nota de conexión</p>
          <p className="text-[10px] text-zinc-400">Mensaje opcional al enviar la solicitud</p>
        </div>
        <button
          onClick={() => update({ addNote: !data.addNote })}
          className={["relative inline-flex h-5 w-9 items-center rounded-full transition-colors", data.addNote ? "bg-blue-500" : "bg-zinc-300"].join(" ")}
        >
          <span className={["inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform", data.addNote ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
        </button>
      </div>

      {data.addNote && (
        <>
          <ABTestToggle enabled={!!data.useABTest} onChange={(v) => update({ useABTest: v })} />

          {data.useABTest ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Variante A</Label>
                <TextArea value={data.messageA ?? ""} onChange={(v) => update({ messageA: v })} placeholder="Nota de conexión A..." rows={3} fieldKey="messageA" onInsertVariable={insertVariable} />
              </div>
              <div>
                <Label>Variante B</Label>
                <TextArea value={data.messageB ?? ""} onChange={(v) => update({ messageB: v })} placeholder="Nota de conexión B..." rows={3} fieldKey="messageB" onInsertVariable={insertVariable} />
              </div>
            </div>
          ) : (
            <div>
              <Label>Nota de conexión</Label>
              <TextArea value={data.messageA ?? ""} onChange={(v) => update({ messageA: v })} placeholder="Hola {{nombre}}, vi tu perfil en {{empresa}}..." rows={4} fieldKey="messageA" onInsertVariable={insertVariable} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MessagePanel({ data, update }: { data: NodeData; update: (d: Partial<NodeData>) => void }) {
  function insertVariable(field: string, variable: string) {
    const current = (data[field as keyof NodeData] as string) ?? "";
    update({ [field]: current + variable });
  }

  return (
    <div className="space-y-4">
      <ABTestToggle enabled={!!data.useABTest} onChange={(v) => update({ useABTest: v })} />

      {data.useABTest ? (
        <div className="space-y-3">
          <div>
            <Label>Mensaje — Variante A</Label>
            <TextArea value={data.bodyA ?? ""} onChange={(v) => update({ bodyA: v })} placeholder="Escribe el mensaje A..." rows={4} fieldKey="bodyA" onInsertVariable={insertVariable} />
          </div>
          <div>
            <Label>Mensaje — Variante B</Label>
            <TextArea value={data.bodyB ?? ""} onChange={(v) => update({ bodyB: v })} placeholder="Escribe el mensaje B..." rows={4} fieldKey="bodyB" onInsertVariable={insertVariable} />
          </div>
        </div>
      ) : (
        <div>
          <Label>Contenido del mensaje</Label>
          <TextArea value={data.bodyA ?? ""} onChange={(v) => update({ bodyA: v })} placeholder="Hola {{nombre}}, te escribo desde NexusAI..." rows={5} fieldKey="bodyA" onInsertVariable={insertVariable} />
        </div>
      )}
    </div>
  );
}

function EmailPanel({ data, update }: { data: NodeData; update: (d: Partial<NodeData>) => void }) {
  function insertVariable(field: string, variable: string) {
    const current = (data[field as keyof NodeData] as string) ?? "";
    update({ [field]: current + variable });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Asunto del email</Label>
        <input
          value={data.subject ?? ""}
          onChange={(e) => update({ subject: e.target.value })}
          placeholder="Ej: Una idea para {{empresa}}"
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      <ABTestToggle enabled={!!data.useABTest} onChange={(v) => update({ useABTest: v })} />

      {data.useABTest ? (
        <div className="space-y-3">
          <div>
            <Label>Cuerpo — Variante A</Label>
            <TextArea value={data.bodyA ?? ""} onChange={(v) => update({ bodyA: v })} placeholder="Hola {{nombre}}..." rows={4} fieldKey="bodyA" onInsertVariable={insertVariable} />
          </div>
          <div>
            <Label>Cuerpo — Variante B</Label>
            <TextArea value={data.bodyB ?? ""} onChange={(v) => update({ bodyB: v })} placeholder="Hola {{nombre}}..." rows={4} fieldKey="bodyB" onInsertVariable={insertVariable} />
          </div>
        </div>
      ) : (
        <div>
          <Label>Cuerpo del email</Label>
          <TextArea value={data.bodyA ?? ""} onChange={(v) => update({ bodyA: v })} placeholder="Hola {{nombre}}, te escribo porque..." rows={6} fieldKey="bodyA" onInsertVariable={insertVariable} />
        </div>
      )}
    </div>
  );
}

function WaitPanel({ data, update }: { data: NodeData; update: (d: Partial<NodeData>) => void }) {
  return (
    <div className="space-y-3">
      <Label>Días de espera</Label>
      <div className="flex items-center gap-3">
        <button onClick={() => update({ days: Math.max(1, (data.days ?? 1) - 1) })} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50">−</button>
        <input
          type="number"
          min={1}
          max={90}
          value={data.days ?? 1}
          onChange={(e) => update({ days: Math.max(1, parseInt(e.target.value) || 1) })}
          className="w-16 rounded-lg border border-zinc-200 px-2 py-1.5 text-center text-sm font-bold focus:border-indigo-400 focus:outline-none"
        />
        <button onClick={() => update({ days: (data.days ?? 1) + 1 })} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50">+</button>
        <span className="text-sm text-zinc-500">días</span>
      </div>
      <p className="text-[11px] text-zinc-400">El lead avanzará al siguiente paso después de este tiempo.</p>
    </div>
  );
}

function ConditionPanel({ data, update }: { data: NodeData; update: (d: Partial<NodeData>) => void }) {
  const OPTIONS = [
    { value: "accepted_connection", label: "¿Aceptó la conexión?"        },
    { value: "replied",             label: "¿Respondió el mensaje?"      },
    { value: "no_response",         label: "Sin respuesta tras X días"   },
  ] as const;

  return (
    <div className="space-y-4">
      <div>
        <Label>Tipo de condición</Label>
        <div className="space-y-1.5">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ conditionType: opt.value })}
              className={[
                "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                data.conditionType === opt.value
                  ? "border-orange-300 bg-orange-50 text-orange-700 font-semibold"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
              ].join(" ")}
            >
              {data.conditionType === opt.value ? "●" : "○"}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {data.conditionType === "no_response" && (
        <div>
          <Label>Días sin respuesta</Label>
          <input
            type="number"
            min={1}
            value={data.waitDays ?? 5}
            onChange={(e) => update({ waitDays: parseInt(e.target.value) || 5 })}
            className="w-24 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs focus:border-orange-400 focus:outline-none"
          />
        </div>
      )}

      <div className="rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-500">
        <p className="font-semibold text-zinc-700 mb-1">Ramas de salida:</p>
        <p className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />Rama SÍ — se cumple la condición</p>
        <p className="flex items-center gap-1 mt-0.5"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" />Rama NO — no se cumple</p>
      </div>
    </div>
  );
}

function AutopilotPanel({ data, update }: { data: NodeData; update: (d: Partial<NodeData>) => void }) {
  const enabled      = (data.autopilotEnabled as boolean)  ?? false;
  const style        = (data.autopilotStyle  as string)    ?? "professional";
  const maxTurns     = (data.autopilotMaxTurns as number)  ?? 8;
  const calendarUrl  = (data.autopilotCalendar as string)  ?? "";
  const objective    = (data.autopilotObjective as string) ?? "";

  const STYLES = [
    { value: "professional", label: "Profesional", desc: "Formal, directo al punto"   },
    { value: "friendly",     label: "Cercano",     desc: "Amigable, conversacional"   },
    { value: "direct",       label: "Directo",     desc: "Sin rodeos, enfoque en ROI" },
  ];

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <div className={`flex items-center justify-between rounded-xl border p-3 transition-all ${enabled ? "border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50" : "border-zinc-200"}`}>
        <div>
          <p className="text-xs font-bold text-zinc-900">Agente Autopilot</p>
          <p className="text-[10px] text-zinc-500">Claude toma el control de la conversación</p>
        </div>
        <button
          onClick={() => update({ autopilotEnabled: !enabled })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? "bg-purple-600" : "bg-zinc-300"}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>

      {enabled && (
        <>
          {/* Objective */}
          <div>
            <Label>Objetivo principal</Label>
            <textarea
              value={objective}
              onChange={(e) => update({ autopilotObjective: e.target.value })}
              rows={3}
              placeholder="Ej: Agendar una demo de 30 minutos para mostrar el producto..."
              className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>

          {/* Style */}
          <div>
            <Label>Estilo de conversación</Label>
            <div className="space-y-1.5">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => update({ autopilotStyle: s.value })}
                  className={[
                    "flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                    style === s.value
                      ? "border-purple-300 bg-purple-50 text-purple-800"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  <span className="mt-0.5 text-[10px]">{style === s.value ? "●" : "○"}</span>
                  <div>
                    <p className="text-[11px] font-semibold">{s.label}</p>
                    <p className="text-[10px] opacity-70">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Max turns */}
          <div>
            <Label>Máximo de turnos de negociación</Label>
            <div className="flex items-center gap-3">
              <button onClick={() => update({ autopilotMaxTurns: Math.max(1, maxTurns - 1) })} className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50">−</button>
              <span className="w-8 text-center text-sm font-bold text-zinc-900">{maxTurns}</span>
              <button onClick={() => update({ autopilotMaxTurns: Math.min(20, maxTurns + 1) })} className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50">+</button>
              <span className="text-xs text-zinc-400">intercambios máx.</span>
            </div>
          </div>

          {/* Calendar URL */}
          <div>
            <Label>URL de Calendario (Calendly / Cal.com)</Label>
            <input
              value={calendarUrl}
              onChange={(e) => update({ autopilotCalendar: e.target.value })}
              placeholder="https://calendly.com/tu-usuario/demo"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>

          <div className="rounded-lg bg-purple-50 px-3 py-2.5 text-[10px] leading-relaxed text-purple-700">
            <span className="font-bold">ℹ️ Modo Autopilot activo:</span> Claude responderá los mensajes, gestionará objeciones y enviará el enlace del calendario cuando detecte intención de agendar.
          </div>
        </>
      )}
    </div>
  );
}

// ── Main PropertyPanel ────────────────────────────────────────────────────────

interface PropertyPanelProps {
  node: Node<NodeData>;
  onUpdate: (id: string, data: Partial<NodeData>) => void;
  onClose: () => void;
}

const NODE_TYPE_LABELS: Record<string, string> = {
  start:      "Inicio",
  connect:    "Enviar Conexión",
  message:    "Mensaje IA",
  email_node: "Email",
  wait:       "Esperar",
  condition:  "Condición IF",
  autopilot:  "Autopilot IA",
  visit:      "Visitar Perfil",
  like:       "Like Post",
};

export function PropertyPanel({ node, onUpdate, onClose }: PropertyPanelProps) {
  const data = node.data as NodeData;

  function update(partial: Partial<NodeData>) {
    onUpdate(node.id, partial);
  }

  return (
    <div className="flex h-full w-80 flex-shrink-0 flex-col overflow-hidden border-l border-border bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-zinc-500">Configurar nodo</p>
          <p className="text-sm font-bold text-zinc-900">
            {NODE_TYPE_LABELS[node.type ?? ""] ?? data.label}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Node label */}
      <div className="border-b border-zinc-100 px-4 py-3">
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Etiqueta del nodo
        </label>
        <input
          value={data.label}
          onChange={(e) => update({ label: e.target.value })}
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {data.nodeType === "connect"    && <ConnectPanel   data={data} update={update} />}
        {data.nodeType === "message"    && <MessagePanel   data={data} update={update} />}
        {data.nodeType === "email_node" && <EmailPanel     data={data} update={update} />}
        {data.nodeType === "wait"       && <WaitPanel      data={data} update={update} />}
        {data.nodeType === "condition"  && <ConditionPanel data={data} update={update} />}
        {data.nodeType === "autopilot"  && <AutopilotPanel data={data} update={update} />}
        {["start", "visit", "like"].includes(data.nodeType) && (
          <p className="text-xs text-zinc-400 text-center pt-4">
            Este nodo no requiere configuración adicional.
          </p>
        )}
      </div>
    </div>
  );
}
