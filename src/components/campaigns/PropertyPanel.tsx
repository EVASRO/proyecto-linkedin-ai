"use client";

import { useRef } from "react";
import { Trash2, X } from "lucide-react";
import type { PropertyPanelProps, NodeData, ConditionKind } from "./types";

// -- Variable pills ------------------------------------------------------------

const VARS = [
  { token: "{{nombre}}",  label: "nombre"  },
  { token: "{{empresa}}", label: "empresa" },
  { token: "{{cargo}}",   label: "cargo"   },
];

// -- Helpers -------------------------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-zinc-400">
      {children}
    </label>
  );
}

// -- Smart textarea with char counter + cursor-aware variable insertion --------

interface SmartTextareaProps {
  id: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}

function SmartTextarea({ id, value, onChange, placeholder, maxLength, rows = 4 }: SmartTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const len = value.length;
  const limit = maxLength ?? 0;
  const near  = limit > 0 && len >= limit * 0.85;

  function insertAtCursor(token: string) {
    const el = ref.current;
    if (!el) {
      onChange(value + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end   = el.selectionEnd   ?? value.length;
    const next  = value.slice(0, start) + token + value.slice(end);
    if (limit && next.length > limit) return;
    onChange(next);
    // Restore cursor position after react re-render
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + token.length;
      el.focus();
    });
  }

  return (
    <div>
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => {
          if (limit && e.target.value.length > limit) return;
          onChange(e.target.value);
        }}
        rows={rows}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
      />
      <div className="mt-1 flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {VARS.map((v) => (
            <button
              key={v.token}
              type="button"
              onClick={() => insertAtCursor(v.token)}
              className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
            >
              {`{{${v.label}}}`}
            </button>
          ))}
        </div>
        {limit > 0 && (
          <span className={`text-[10px] tabular-nums ${near ? "text-amber-500 font-semibold" : "text-zinc-400"}`}>
            {len}/{limit}
          </span>
        )}
      </div>
    </div>
  );
}

// -- Toggle --------------------------------------------------------------------

function Toggle({
  checked, onChange, label, description, color = "bg-indigo-500",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-800">{label}</p>
        {description && <p className="text-[10px] text-zinc-400 leading-snug">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors",
          checked ? color : "bg-zinc-300",
        ].join(" ")}
      >
        <span className={[
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        ].join(" ")} />
      </button>
    </div>
  );
}

// -- Sub-panels ----------------------------------------------------------------

function ConnectPanel({ data, update }: { data: NodeData; update: (p: Partial<NodeData>) => void }) {
  const note      = data.connectionNote ?? data.messageA ?? "";
  const abMode    = data.abNoteMode ?? "note_vs_note";

  return (
    <div className="space-y-4">
      <Toggle
        checked={!!data.addNote}
        onChange={(v) => update({ addNote: v })}
        label="Añadir nota de conexión"
        description="Mensaje opcional al enviar la solicitud"
        color="bg-indigo-500"
      />

      {data.addNote && (
        <>
          <Toggle
            checked={!!data.useABTest}
            onChange={(v) => update({ useABTest: v })}
            label="Test A/B en nota"
            color="bg-violet-500"
          />

          {data.useABTest ? (
            <>
              {/* A/B mode selector */}
              <div className="flex overflow-hidden rounded-lg border border-zinc-200">
                {([
                  { value: "note_vs_note",    label: "Nota A vs Nota B"      },
                  { value: "note_vs_no_note", label: "Con nota vs Sin nota"  },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update({ abNoteMode: opt.value })}
                    className={[
                      "flex-1 px-2 py-1.5 text-[10px] font-semibold transition-colors border-r last:border-r-0 border-zinc-200",
                      abMode === opt.value
                        ? "bg-violet-100 text-violet-700 border-violet-300"
                        : "bg-white text-zinc-500 hover:bg-zinc-50",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {abMode === "note_vs_no_note" ? (
                <>
                  <div>
                    <FieldLabel>Nota — Variante A (con nota)</FieldLabel>
                    <SmartTextarea
                      id="noteA"
                      value={data.connectionNote ?? data.messageA ?? ""}
                      onChange={(v) => update({ connectionNote: v, messageA: v })}
                      placeholder="Nota A…"
                      maxLength={300}
                      rows={4}
                    />
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-700">
                    Variante B enviará la solicitud <strong>SIN nota</strong> de conexión
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Variante A</FieldLabel>
                    <SmartTextarea
                      id="noteA"
                      value={data.connectionNote ?? data.messageA ?? ""}
                      onChange={(v) => update({ connectionNote: v, messageA: v })}
                      placeholder="Nota A…"
                      maxLength={300}
                      rows={3}
                    />
                  </div>
                  <div>
                    <FieldLabel>Variante B</FieldLabel>
                    <SmartTextarea
                      id="noteB"
                      value={data.messageB ?? ""}
                      onChange={(v) => update({ messageB: v })}
                      placeholder="Nota B…"
                      maxLength={300}
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div>
              <FieldLabel>Nota de conexión (máx. 300 caracteres)</FieldLabel>
              <SmartTextarea
                id="note"
                value={note}
                onChange={(v) => update({ connectionNote: v, messageA: v })}
                placeholder="Hola {{nombre}}, vi tu perfil en {{empresa}}…"
                maxLength={300}
                rows={4}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MessagePanel({ data, update }: { data: NodeData; update: (p: Partial<NodeData>) => void }) {
  return (
    <div className="space-y-4">
      <Toggle
        checked={!!data.useABTest}
        onChange={(v) => update({ useABTest: v })}
        label="Test A/B"
        description="Probar dos versiones del mensaje"
        color="bg-violet-500"
      />

      {data.useABTest ? (
        <div className="space-y-3">
          <div>
            <FieldLabel>Mensaje — Variante A</FieldLabel>
            <SmartTextarea
              id="bodyA"
              value={data.bodyA ?? ""}
              onChange={(v) => update({ bodyA: v })}
              placeholder="Escribe el mensaje A…"
              rows={4}
            />
          </div>
          <div>
            <FieldLabel>Mensaje — Variante B</FieldLabel>
            <SmartTextarea
              id="bodyB"
              value={data.bodyB ?? ""}
              onChange={(v) => update({ bodyB: v })}
              placeholder="Escribe el mensaje B…"
              rows={4}
            />
          </div>
        </div>
      ) : (
        <div>
          <FieldLabel>Contenido del mensaje</FieldLabel>
          <SmartTextarea
            id="bodyA"
            value={data.bodyA ?? ""}
            onChange={(v) => update({ bodyA: v })}
            placeholder="Hola {{nombre}}, te escribo porque…"
            rows={5}
          />
        </div>
      )}
    </div>
  );
}

function DelayPanel({ data, update }: { data: NodeData; update: (p: Partial<NodeData>) => void }) {
  const days = data.days ?? 1;
  const unit = data.delayUnit ?? "dias";

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Tiempo de espera</FieldLabel>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => update({ days: Math.max(1, days - 1) })}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-lg text-zinc-600 hover:bg-zinc-50"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={unit === "dias" ? 30 : 168}
            value={days}
            onChange={(e) => update({ days: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-16 rounded-lg border border-zinc-200 px-2 py-1.5 text-center text-sm font-bold focus:border-indigo-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => update({ days: days + 1 })}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-lg text-zinc-600 hover:bg-zinc-50"
          >
            +
          </button>

          {/* Unit selector */}
          <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
            {(["dias", "horas"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => update({ delayUnit: u })}
                className={[
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  unit === u
                    ? "bg-amber-500 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50",
                ].join(" ")}
              >
                {u === "dias" ? "Días" : "Horas"}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[10px] text-zinc-400">
          El lead avanzará al siguiente paso después de {days} {unit === "horas" ? `hora${days !== 1 ? "s" : ""}` : `día${days !== 1 ? "s" : ""}`}.
        </p>
      </div>
    </div>
  );
}

function ConditionPanel({ data, update }: { data: NodeData; update: (p: Partial<NodeData>) => void }) {
  const OPTIONS: { value: ConditionKind; label: string; desc: string }[] = [
    { value: "conexion_aceptada", label: "¿Aceptó la conexión?",  desc: "La solicitud fue aceptada"       },
    { value: "respondio",         label: "¿Respondió el mensaje?", desc: "El lead respondió algún mensaje" },
    { value: "no_respondio",      label: "Sin respuesta",          desc: "No hubo reacción tras X días"    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Tipo de condición</FieldLabel>
        <div className="space-y-1.5">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ conditionType: opt.value })}
              className={[
                "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                data.conditionType === opt.value
                  ? "border-orange-300 bg-orange-50"
                  : "border-zinc-200 bg-white hover:bg-zinc-50",
              ].join(" ")}
            >
              <span className="mt-0.5 text-[10px]">{data.conditionType === opt.value ? "●" : "○"}</span>
              <div>
                <p className={`text-[11px] font-semibold ${data.conditionType === opt.value ? "text-orange-800" : "text-zinc-800"}`}>
                  {opt.label}
                </p>
                <p className="text-[10px] text-zinc-400">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {data.conditionType === "no_respondio" && (
        <div>
          <FieldLabel>Días sin respuesta</FieldLabel>
          <input
            type="number"
            min={1}
            max={60}
            value={data.waitDays ?? 5}
            onChange={(e) => update({ waitDays: parseInt(e.target.value) || 5 })}
            className="w-24 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-bold focus:border-orange-400 focus:outline-none"
          />
        </div>
      )}

      <div className="rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-500 space-y-1">
        <p className="font-semibold text-zinc-700">Ramas de salida:</p>
        <p className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
          Rama SÍ — condición cumplida
        </p>
        <p className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-400 flex-shrink-0" />
          Rama NO — condición no cumplida
        </p>
      </div>
    </div>
  );
}

function EmailPanel({ data, update }: { data: NodeData; update: (p: Partial<NodeData>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Asunto del email</FieldLabel>
        <input
          value={data.subject ?? ""}
          onChange={(e) => update({ subject: e.target.value })}
          placeholder="Ej: Una idea para {{empresa}}"
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <Toggle
        checked={!!data.useABTest}
        onChange={(v) => update({ useABTest: v })}
        label="Test A/B"
        description="Probar dos cuerpos diferentes"
        color="bg-violet-500"
      />

      {data.useABTest ? (
        <div className="space-y-3">
          <div>
            <FieldLabel>Cuerpo — Variante A</FieldLabel>
            <SmartTextarea id="emailA" value={data.bodyA ?? ""} onChange={(v) => update({ bodyA: v })} placeholder="Hola {{nombre}}…" rows={4} />
          </div>
          <div>
            <FieldLabel>Cuerpo — Variante B</FieldLabel>
            <SmartTextarea id="emailB" value={data.bodyB ?? ""} onChange={(v) => update({ bodyB: v })} placeholder="Hola {{nombre}}…" rows={4} />
          </div>
        </div>
      ) : (
        <div>
          <FieldLabel>Cuerpo del email</FieldLabel>
          <SmartTextarea id="emailBody" value={data.bodyA ?? ""} onChange={(v) => update({ bodyA: v })} placeholder="Hola {{nombre}}, te escribo porque…" rows={6} />
        </div>
      )}
    </div>
  );
}

function AutopilotPanel({ data, update }: { data: NodeData; update: (p: Partial<NodeData>) => void }) {
  const enabled     = data.autopilotEnabled ?? false;
  const style       = (data.autopilotStyle as string) ?? "professional";
  const maxTurns    = data.autopilotMaxTurns ?? 8;
  const calendarUrl = (data.autopilotCalendar as string) ?? "";
  const objective   = (data.autopilotObjective as string) ?? "";

  const STYLES = [
    { value: "professional", label: "Profesional", desc: "Formal, directo al punto"     },
    { value: "friendly",     label: "Cercano",     desc: "Amigable, conversacional"     },
    { value: "direct",       label: "Directo",     desc: "Sin rodeos, enfoque en valor" },
  ];

  return (
    <div className="space-y-4">
      <Toggle
        checked={enabled}
        onChange={(v) => update({ autopilotEnabled: v })}
        label="Agente Autopilot IA"
        description="Claude toma el control de la conversación"
        color="bg-purple-600"
      />

      {enabled && (
        <>
          <div>
            <FieldLabel>Objetivo principal</FieldLabel>
            <textarea
              value={objective}
              onChange={(e) => update({ autopilotObjective: e.target.value })}
              rows={3}
              placeholder="Ej: Agendar una demo de 30 minutos…"
              className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>

          <div>
            <FieldLabel>Estilo de conversación</FieldLabel>
            <div className="space-y-1.5">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
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

          <div>
            <FieldLabel>Máximo de turnos de negociación</FieldLabel>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => update({ autopilotMaxTurns: Math.max(1, maxTurns - 1) })} className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50">−</button>
              <span className="w-8 text-center text-sm font-bold text-zinc-900">{maxTurns}</span>
              <button type="button" onClick={() => update({ autopilotMaxTurns: Math.min(20, maxTurns + 1) })} className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50">+</button>
              <span className="text-[10px] text-zinc-400">intercambios</span>
            </div>
          </div>

          <div>
            <FieldLabel>URL de Calendario (Calendly / Cal.com)</FieldLabel>
            <input
              value={calendarUrl}
              onChange={(e) => update({ autopilotCalendar: e.target.value })}
              placeholder="https://calendly.com/tu-usuario/demo"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>

          <div className="rounded-lg bg-purple-50 px-3 py-2.5 text-[10px] leading-relaxed text-purple-700">
            <span className="font-bold">Modo Autopilot activo:</span> Claude responderá, gestionará objeciones y enviará el enlace del calendario cuando detecte intención de agendar.
          </div>
        </>
      )}
    </div>
  );
}

function WithdrawPanel() {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-[11px] leading-relaxed text-red-700">
      Este nodo retira la solicitud de conexión pendiente si aún no fue aceptada,
      o elimina la conexión existente. Úsalo al final de flujos de limpieza.
    </div>
  );
}

function FindEmailPanel({ data, update }: { data: NodeData; update: (p: Partial<NodeData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-3 text-[11px] leading-relaxed text-teal-700">
        NexusAI visitará el perfil de LinkedIn del lead y buscará su email en la
        sección &ldquo;Información de contacto&rdquo;. Si lo encuentra, lo guardará en el campo
        email del lead en la base de datos.
      </div>
      <Toggle
        checked={!!data.skipIfExists}
        onChange={(v) => update({ skipIfExists: v })}
        label="Saltar si ya tiene email"
        description="No visitar el perfil si el lead ya tiene email en BD"
        color="bg-teal-500"
      />
    </div>
  );
}

function FindPhonePanel({ data, update }: { data: NodeData; update: (p: Partial<NodeData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-3 text-[11px] leading-relaxed text-teal-700">
        NexusAI visitará el perfil de LinkedIn del lead y buscará su número de teléfono en la
        sección &ldquo;Información de contacto&rdquo;. Si lo encuentra, lo guardará en el campo
        teléfono del lead en la base de datos.
      </div>
      <Toggle
        checked={!!data.skipIfExists}
        onChange={(v) => update({ skipIfExists: v })}
        label="Saltar si ya tiene teléfono"
        description="No visitar el perfil si el lead ya tiene teléfono en BD"
        color="bg-teal-500"
      />
    </div>
  );
}

function ConnectEmailPanel({ data, update }: { data: NodeData; update: (p: Partial<NodeData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-3 text-[11px] leading-relaxed text-violet-700">
        Envía una solicitud de conexión de LinkedIn usando el email del lead.
        Requiere que el lead tenga email guardado en BD (usa &ldquo;Buscar Email&rdquo; antes).
      </div>
      <Toggle
        checked={!!data.addNote}
        onChange={(v) => update({ addNote: v })}
        label="Añadir nota de conexión"
        description="Incluir mensaje personalizado en la solicitud"
        color="bg-violet-500"
      />
      {data.addNote ? (
        <div>
          <FieldLabel>Nota de conexión (máx. 300 caracteres)</FieldLabel>
          <SmartTextarea
            id="connectEmailNote"
            value={(data.connectionNote as string) ?? ""}
            onChange={(v) => update({ connectionNote: v })}
            placeholder="Hola {{nombre}}, vi tu perfil en {{empresa}}…"
            maxLength={300}
            rows={4}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          Se enviará sin nota de conexión
        </div>
      )}
    </div>
  );
}

// -- Node type label map -------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  start:         "Inicio",
  connect:       "Enviar Conexión",
  message:       "Enviar Mensaje",
  delay:         "Esperar",
  wait:          "Esperar",
  condition:     "Condición IF",
  email:         "Enviar Email",
  email_node:    "Enviar Email",
  autopilot:     "Autopilot IA",
  visit:         "Visitar Perfil",
  like:          "Like Post",
  end:           "Fin del flujo",
  withdraw:      "Quitar Conexión",
  find_email:    "Buscar Email",
  find_phone:    "Buscar Teléfono",
  connect_email: "Conexión via Email",
};

// -- Main export ---------------------------------------------------------------

export function PropertyPanel({ node, onUpdate, onDelete, onClose }: PropertyPanelProps) {
  const data     = node.data;
  const nodeType = data.nodeType;
  const isStart  = node.type === "start" || nodeType === "start";
  const isEnd    = node.type === "end"   || nodeType === "end";

  function update(partial: Partial<NodeData>) {
    onUpdate(node.id, partial);
  }

  return (
    <div className="flex h-full w-80 flex-shrink-0 flex-col overflow-hidden border-l border-zinc-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Configurar nodo</p>
          <p className="text-sm font-bold text-zinc-900">
            {TYPE_LABELS[node.type ?? ""] ?? TYPE_LABELS[nodeType] ?? data.label}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Node label editor */}
      {!isStart && !isEnd && (
        <div className="border-b border-zinc-100 px-4 py-3">
          <FieldLabel>Etiqueta del nodo</FieldLabel>
          <input
            value={data.label}
            onChange={(e) => update({ label: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      )}

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {nodeType === "connect"                    && <ConnectPanel   data={data} update={update} />}
        {nodeType === "message"                    && <MessagePanel   data={data} update={update} />}
        {(nodeType === "delay" || nodeType === "wait") && <DelayPanel data={data} update={update} />}
        {nodeType === "condition"                  && <ConditionPanel data={data} update={update} />}
        {(nodeType === "email" || nodeType === "email_node") && <EmailPanel data={data} update={update} />}
        {nodeType === "autopilot"                  && <AutopilotPanel     data={data} update={update} />}
        {nodeType === "withdraw"                   && <WithdrawPanel                                   />}
        {nodeType === "find_email"                 && <FindEmailPanel     data={data} update={update} />}
        {nodeType === "find_phone"                 && <FindPhonePanel     data={data} update={update} />}
        {nodeType === "connect_email"              && <ConnectEmailPanel  data={data} update={update} />}
        {(isStart || isEnd || ["visit", "like"].includes(nodeType)) && (
          <p className="pt-4 text-center text-xs text-zinc-400">
            Este nodo no requiere configuración adicional.
          </p>
        )}
      </div>

      {/* Delete button */}
      {!isStart && (
        <div className="border-t border-zinc-100 px-4 py-3">
          <button
            onClick={() => onDelete(node.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar nodo
          </button>
        </div>
      )}
    </div>
  );
}
