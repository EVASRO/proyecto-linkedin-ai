"use client";

import { useState, useTransition } from "react";
import {
  Bot, ChevronDown, Loader2, Plus, Trash2, Zap,
} from "lucide-react";
import type { Column } from "./types";
import {
  upsertCrmAutomation, deleteCrmAutomation, toggleAutomation,
  type CrmAutomationFull,
} from "@/app/dashboard/crm/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type TriggerEvent = "moved_to_column" | "tag_added" | "inactivity";
type ActionType   = "add_to_queue"    | "update_lead";

// ── Constants ─────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerEvent, string> = {
  moved_to_column: "Lead se mueve a columna",
  tag_added:       "Tag agregado al lead",
  inactivity:      "Sin actividad por N días",
};

const ACTION_LABELS: Record<ActionType, string> = {
  add_to_queue: "Agregar a cola del motor",
  update_lead:  "Actualizar campo del lead",
};

const TRIGGER_COLOR: Record<TriggerEvent, string> = {
  moved_to_column: "bg-blue-50 text-blue-700",
  tag_added:       "bg-violet-50 text-violet-700",
  inactivity:      "bg-amber-50 text-amber-700",
};

const ACTION_COLOR: Record<ActionType, string> = {
  add_to_queue: "bg-indigo-50 text-indigo-700",
  update_lead:  "bg-green-50 text-green-700",
};

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
        <Zap className="h-8 w-8 text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-700">Sin automatizaciones</p>
        <p className="mt-1 text-xs text-zinc-400">
          Crea reglas que se ejecutan automáticamente cuando ocurre un evento en el CRM
        </p>
      </div>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-700 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Crear primera automatización
      </button>
    </div>
  );
}

// ── Create form ───────────────────────────────────────────────────────────────

interface CreateFormProps {
  columns: Column[];
  onCreated: (auto: CrmAutomationFull) => void;
  onCancel: () => void;
}

function CreateForm({ columns, onCreated, onCancel }: CreateFormProps) {
  const [name,      setName]      = useState("");
  const [trigger,   setTrigger]   = useState<TriggerEvent>("moved_to_column");
  const [colTarget, setColTarget] = useState(columns[0]?.id ?? "");
  const [tagVal,    setTagVal]    = useState("");
  const [inactDays, setInactDays] = useState(7);
  const [action,    setAction]    = useState<ActionType>("add_to_queue");
  const [message,   setMessage]   = useState("");
  const [delayH,    setDelayH]    = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error,     setError]     = useState("");

  function buildCondition(): Record<string, unknown> {
    if (trigger === "moved_to_column") return { column: colTarget };
    if (trigger === "tag_added")       return { tag: tagVal };
    return { days: inactDays };
  }

  function buildPayload(): Record<string, unknown> {
    if (action === "add_to_queue") {
      return { action: "message", message, delay_hours: delayH };
    }
    return { fields: { status: colTarget } };
  }

  function submit() {
    if (!name.trim()) { setError("El nombre es requerido"); return; }
    setError("");
    startTransition(async () => {
      const res = await upsertCrmAutomation({
        name:              name.trim(),
        trigger_event:     trigger,
        trigger_condition: buildCondition(),
        action_type:       action,
        action_payload:    buildPayload(),
        is_active:         true,
      });
      if (res.success && res.data) {
        onCreated(res.data);
      } else {
        setError(res.error ?? "Error al guardar");
      }
    });
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
      <p className="mb-5 text-sm font-bold text-zinc-900">Nueva automatización</p>

      {/* Name */}
      <div className="mb-4">
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-zinc-400">Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Mensaje de bienvenida"
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {/* Trigger */}
      <div className="mb-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 flex items-center gap-1.5">
          <Zap className="h-3 w-3" /> Disparador — SI ocurre
        </p>

        <div className="relative">
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as TriggerEvent)}
            className="w-full appearance-none rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-8 text-xs focus:border-indigo-400 focus:outline-none"
          >
            {(Object.keys(TRIGGER_LABELS) as TriggerEvent[]).map((t) => (
              <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-zinc-400" />
        </div>

        {trigger === "moved_to_column" && (
          <div className="relative">
            <select
              value={colTarget}
              onChange={(e) => setColTarget(e.target.value)}
              className="w-full appearance-none rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-8 text-xs focus:border-indigo-400 focus:outline-none"
            >
              {columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          </div>
        )}

        {trigger === "tag_added" && (
          <input
            value={tagVal}
            onChange={(e) => setTagVal(e.target.value)}
            placeholder="Nombre del tag (ej: VIP)"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs focus:border-indigo-400 focus:outline-none"
          />
        )}

        {trigger === "inactivity" && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={90}
              value={inactDays}
              onChange={(e) => setInactDays(parseInt(e.target.value) || 7)}
              className="w-20 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center text-xs focus:border-indigo-400 focus:outline-none"
            />
            <span className="text-xs text-zinc-500">días sin actividad</span>
          </div>
        )}
      </div>

      {/* Action */}
      <div className="mb-5 rounded-xl border border-zinc-100 bg-zinc-50 p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 flex items-center gap-1.5">
          <Bot className="h-3 w-3" /> Acción — ENTONCES ejecutar
        </p>

        <div className="relative">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as ActionType)}
            className="w-full appearance-none rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-8 text-xs focus:border-indigo-400 focus:outline-none"
          >
            {(Object.keys(ACTION_LABELS) as ActionType[]).map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-zinc-400" />
        </div>

        {action === "add_to_queue" && (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Texto del mensaje (puede usar {{nombre}}, {{empresa}})"
              className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs focus:border-indigo-400 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Retraso:</span>
              <input
                type="number"
                min={0}
                value={delayH}
                onChange={(e) => setDelayH(parseInt(e.target.value) || 0)}
                className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-center text-xs focus:border-indigo-400 focus:outline-none"
              />
              <span className="text-xs text-zinc-500">horas</span>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 border border-red-200">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={isPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-2.5 text-xs font-bold text-white hover:bg-zinc-700 disabled:opacity-60 transition-colors"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          Crear automatización
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Automation card ───────────────────────────────────────────────────────────

interface AutoCardProps {
  auto: CrmAutomationFull;
  columns: Column[];
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}

function AutoCard({ auto, columns, onToggle, onDelete }: AutoCardProps) {
  const trigger  = auto.trigger_event as TriggerEvent;
  const action   = auto.action_type  as ActionType;
  const colTitle = columns.find((c) => c.id === (auto.trigger_condition as Record<string,unknown>).column)?.title;

  return (
    <div className={[
      "flex flex-col gap-3 rounded-2xl border p-4 shadow-sm transition-all",
      auto.is_active ? "border-zinc-200 bg-white" : "border-zinc-100 bg-zinc-50 opacity-60",
    ].join(" ")}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-zinc-900 leading-tight">{auto.name}</p>
          <p className="mt-0.5 text-[10px] text-zinc-400">{new Date(auto.created_at).toLocaleDateString("es-PE")}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle */}
          <button
            onClick={() => onToggle(auto.id, !auto.is_active)}
            className={[
              "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors",
              auto.is_active ? "bg-green-500" : "bg-zinc-300",
            ].join(" ")}
          >
            <span className={[
              "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
              auto.is_active ? "translate-x-4" : "translate-x-0.5",
            ].join(" ")} />
          </button>
          <button
            onClick={() => onDelete(auto.id)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* SI block */}
      <div className="flex items-start gap-2.5">
        <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${TRIGGER_COLOR[trigger] ?? "bg-zinc-50 text-zinc-500"}`}>
          <Zap className="h-3 w-3" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">SI</p>
          <p className="text-[11px] text-zinc-700 leading-snug">
            {TRIGGER_LABELS[trigger]}
            {colTitle && <span className="ml-1 font-semibold">→ {colTitle}</span>}
            {trigger === "tag_added" && (
              <span className="ml-1 font-semibold">"{String((auto.trigger_condition as Record<string,unknown>).tag ?? "")}"</span>
            )}
            {trigger === "inactivity" && (
              <span className="ml-1 font-semibold">{String((auto.trigger_condition as Record<string,unknown>).days ?? 7)} días</span>
            )}
          </p>
        </div>
      </div>

      {/* Connector */}
      <div className="ml-3 border-l-2 border-dashed border-zinc-150 pl-5 h-3" />

      {/* ENTONCES block */}
      <div className="flex items-start gap-2.5">
        <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${ACTION_COLOR[action] ?? "bg-zinc-50 text-zinc-500"}`}>
          <Bot className="h-3 w-3" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">ENTONCES</p>
          <p className="text-[11px] text-zinc-700 leading-snug">{ACTION_LABELS[action]}</p>
          {action === "add_to_queue" && !!(auto.action_payload as Record<string,unknown>).message && (
            <p className="mt-0.5 text-[10px] text-zinc-400 line-clamp-1">
              &ldquo;{String((auto.action_payload as Record<string,unknown>).message)}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AutomationMatrixProps {
  columns: Column[];
  initialAutomations: CrmAutomationFull[];
}

export function AutomationMatrix({ columns, initialAutomations }: AutomationMatrixProps) {
  const [automations, setAutomations] = useState<CrmAutomationFull[]>(initialAutomations);
  const [creating,    setCreating]    = useState(false);
  const [, startTransition]           = useTransition();

  function handleCreated(auto: CrmAutomationFull) {
    setAutomations((prev) => [auto, ...prev]);
    setCreating(false);
  }

  function handleToggle(id: string, active: boolean) {
    setAutomations((prev) => prev.map((a) => a.id === id ? { ...a, is_active: active } : a));
    startTransition(async () => {
      await toggleAutomation(id, active);
    });
  }

  function handleDelete(id: string) {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    startTransition(async () => {
      await deleteCrmAutomation(id);
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto pb-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-zinc-900">Automatizaciones CRM</p>
          <p className="text-[11px] text-zinc-400">{automations.length} regla{automations.length !== 1 ? "s" : ""} configurada{automations.length !== 1 ? "s" : ""}</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-200 hover:from-amber-500 hover:to-orange-600 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva automatización
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <CreateForm
          columns={columns}
          onCreated={handleCreated}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* List */}
      {automations.length === 0 && !creating ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {automations.map((auto) => (
            <AutoCard
              key={auto.id}
              auto={auto}
              columns={columns}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
