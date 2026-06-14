"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  AlertCircle, AtSign, Bot, CheckCircle2, Clock, Flag,
  GitBranch, Globe, Heart, Mail, MailPlus, MessageSquare,
  Phone, Play, UserMinus, UserPlus,
} from "lucide-react";
import type { NodeData, NodeType } from "./types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isConfigured(data: NodeData): boolean {
  switch (data.nodeType) {
    case "message":
      return !!(data.bodyA?.trim());
    case "email":
    case "email_node":
      return !!(data.subject?.trim() && data.bodyA?.trim());
    case "connect":
      if (data.addNote) return !!(data.connectionNote?.trim() || data.messageA?.trim());
      return true;
    case "delay":
    case "wait":
      return !!(data.days && data.days > 0);
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Design tokens (accent hex per node type)
// ---------------------------------------------------------------------------

const ACCENT: Record<NodeType, string> = {
  start:        "#10B981",
  connect:      "#2563EB",
  message:      "#10B981",
  delay:        "#F59E0B",
  wait:         "#F59E0B",
  condition:    "#06B6D4",
  email:        "#3B82F6",
  email_node:   "#3B82F6",
  end:          "#64748B",
  autopilot:    "#8B5CF6",
  visit:        "#06B6D4",
  like:         "#EC4899",
  withdraw:     "#EF4444",
  find_email:   "#14B8A6",
  find_phone:   "#14B8A6",
  connect_email:"#8B5CF6",
};

function accent(type: NodeType): string {
  return ACCENT[type] ?? "#2563EB";
}

// ---------------------------------------------------------------------------
// AB Badge
// ---------------------------------------------------------------------------

function ABBadge({ variant }: { variant: "A" | "B" }) {
  return (
    <span
      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center
                 rounded-full text-[9px] font-black text-white shadow-sm z-10"
      style={{ background: variant === "A" ? "#2563EB" : "#8B5CF6" }}
    >
      {variant}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status dot
// ---------------------------------------------------------------------------

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-3 w-3 flex-shrink-0 opacity-70" style={{ color: "white" }} />
  ) : (
    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-red-500 ring-1 ring-white/30">
      <AlertCircle className="h-2.5 w-2.5 text-white" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Custom Handle — branded dot
// ---------------------------------------------------------------------------

function TargetHandle({ color }: { color: string }) {
  return (
    <Handle
      type="target"
      position={Position.Top}
      className="!h-3 !w-3 !border-2 !rounded-full"
      style={{ background: color, borderColor: "var(--surface)" }}
    />
  );
}

function SourceHandle({ color, id, style }: { color: string; id?: string; style?: React.CSSProperties }) {
  return (
    <Handle
      type="source"
      position={Position.Bottom}
      id={id}
      className="!h-3 !w-3 !border-2 !rounded-full"
      style={{ background: color, borderColor: "var(--surface)", ...style }}
    />
  );
}

// ---------------------------------------------------------------------------
// BaseNode shell
// ---------------------------------------------------------------------------

interface BaseNodeProps {
  data: NodeData;
  selected: boolean;
  icon: React.ElementType;
  showTarget?: boolean;
  showSource?: boolean;
  children?: React.ReactNode;
  extraHandles?: React.ReactNode;
  /** Override for nodes that need a full-gradient header (autopilot) */
  headerGradient?: string;
  /** Extra badge in header (autopilot PRO, AI, etc.) */
  headerBadge?: React.ReactNode;
}

function BaseNode({
  data,
  selected,
  icon: Icon,
  showTarget = true,
  showSource = true,
  children,
  extraHandles,
  headerGradient,
  headerBadge,
}: BaseNodeProps) {
  const a       = accent(data.nodeType);
  const ok      = isConfigured(data);
  const variant = data.abVariant;

  const headerBg = headerGradient
    ? { background: headerGradient }
    : { background: `${a}18` }; // 18 ≈ 10% opacity in hex

  return (
    <div className="relative">
      {variant && <ABBadge variant={variant} />}

      <div
        className="relative min-w-[220px] overflow-hidden rounded-xl"
        style={{
          background: "var(--surface)",
          border: selected
            ? `2px solid ${a}`
            : "1px solid var(--border)",
          boxShadow: selected
            ? `0 0 0 3px ${a}26, var(--shadow-md)`
            : "var(--shadow-sm)",
          transition: "border-color 150ms, box-shadow 150ms",
        }}
      >
        {/* Target handle */}
        {showTarget && <TargetHandle color={a} />}

        {/* Header */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5"
          style={headerBg}
        >
          {/* Icon circle */}
          <span
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: `${a}30` }}
          >
            <Icon className="h-3 w-3" style={{ color: a }} />
          </span>

          <span
            className="flex-1 truncate text-[11px] font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {data.label}
          </span>

          {headerBadge}
          <StatusDot ok={ok} />
        </div>

        {/* Accent bar */}
        <div className="h-px w-full" style={{ background: `${a}30` }} />

        {/* Body */}
        {children && (
          <div className="px-3 py-2.5 text-[var(--foreground-muted)]">
            {children}
          </div>
        )}

        {/* Source handle */}
        {showSource && !extraHandles && <SourceHandle color={a} />}
        {extraHandles}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// START
// ---------------------------------------------------------------------------

export function StartNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const a = accent("start");

  return (
    <div className="relative">
      {d.abVariant && <ABBadge variant={d.abVariant} />}
      <div
        className="relative min-w-[220px] overflow-hidden rounded-2xl"
        style={{
          background: "var(--surface)",
          border: selected ? `2px solid ${a}` : `1px solid ${a}40`,
          boxShadow: selected
            ? `0 0 0 3px ${a}26, var(--shadow-md)`
            : `var(--shadow-sm)`,
          transition: "border-color 150ms, box-shadow 150ms",
        }}
      >
        {/* Gradient background strip */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ background: "linear-gradient(135deg, #10B981, #2563EB)" }}
        />

        <div
          className="relative flex items-center gap-2.5 px-3 py-2.5"
          style={{ background: `${a}18` }}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ background: `${a}30` }}
          >
            <Play className="h-3 w-3 fill-current" style={{ color: a }} />
          </span>
          <span className="flex-1 text-[11px] font-semibold" style={{ color: "var(--foreground)" }}>
            {d.label}
          </span>
          <CheckCircle2 className="h-3.5 w-3.5 opacity-70" style={{ color: a }} />
        </div>

        <div className="h-px w-full" style={{ background: `${a}30` }} />

        <div className="px-3 py-2.5">
          <p className="text-[10px]" style={{ color: "var(--foreground-faint)" }}>
            Punto de inicio de la secuencia
          </p>
        </div>

        <SourceHandle color={a} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CONNECT
// ---------------------------------------------------------------------------

export function ConnectNode({ data, selected }: NodeProps) {
  const d    = data as NodeData;
  const note = d.connectionNote ?? d.messageA ?? "";

  return (
    <BaseNode data={d} selected={selected} icon={UserPlus}>
      {d.addNote ? (
        note ? (
          <p className="line-clamp-2 text-[10px]">&ldquo;{note}&rdquo;</p>
        ) : (
          <p className="text-[10px] italic" style={{ color: "var(--danger)" }}>
            Añade una nota de conexión
          </p>
        )
      ) : (
        <p className="text-[10px]" style={{ color: "var(--foreground-faint)" }}>
          Sin nota · Conexión directa
        </p>
      )}
      {d.useABTest && (
        <span
          className="mt-1.5 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold"
          style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
        >
          A/B
        </span>
      )}
    </BaseNode>
  );
}

// ---------------------------------------------------------------------------
// MESSAGE
// ---------------------------------------------------------------------------

export function MessageNode({ data, selected }: NodeProps) {
  const d = data as NodeData;

  return (
    <BaseNode data={d} selected={selected} icon={MessageSquare}>
      {d.bodyA ? (
        <p className="line-clamp-2 text-[10px]">&ldquo;{d.bodyA}&rdquo;</p>
      ) : (
        <p className="text-[10px] italic" style={{ color: "var(--danger)" }}>
          Escribe el mensaje
        </p>
      )}
      {d.useABTest && (
        <span
          className="mt-1.5 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold"
          style={{ background: "var(--success-soft)", color: "var(--success)" }}
        >
          A/B
        </span>
      )}
    </BaseNode>
  );
}

// ---------------------------------------------------------------------------
// DELAY / WAIT
// ---------------------------------------------------------------------------

export function DelayNode({ data, selected }: NodeProps) {
  const d    = data as NodeData;
  const days = d.days ?? 1;
  const unit = d.delayUnit ?? "dias";
  const a    = accent("delay");

  return (
    <BaseNode data={d} selected={selected} icon={Clock}>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-2xl font-black tabular-nums"
          style={{ color: a }}
        >
          {days}
        </span>
        <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
          {unit === "horas"
            ? `hora${days !== 1 ? "s" : ""}`
            : `día${days !== 1 ? "s" : ""}`}
        </span>
      </div>
    </BaseNode>
  );
}

// ---------------------------------------------------------------------------
// CONDITION
// ---------------------------------------------------------------------------

const CONDITION_LABELS: Record<string, string> = {
  conexion_aceptada:   "¿Aceptó la conexión?",
  respondio:           "¿Respondió el mensaje?",
  no_respondio:        "Sin respuesta",
  accepted_connection: "¿Aceptó la conexión?",
  replied:             "¿Respondió el mensaje?",
  no_response:         "Sin respuesta",
};

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const a = accent("condition");

  return (
    <div className="relative">
      {d.abVariant && <ABBadge variant={d.abVariant} />}

      <div
        className="relative min-w-[220px] overflow-hidden rounded-xl"
        style={{
          background: "var(--surface)",
          border: selected ? `2px solid ${a}` : "1px solid var(--border)",
          borderLeft: `4px solid ${a}`,
          boxShadow: selected
            ? `0 0 0 3px ${a}26, var(--shadow-md)`
            : "var(--shadow-sm)",
          transition: "border-color 150ms, box-shadow 150ms",
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !rounded-full"
          style={{ background: a, borderColor: "var(--surface)" }}
        />

        {/* Header */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5"
          style={{ background: `${a}18` }}
        >
          <span
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: `${a}30` }}
          >
            <GitBranch className="h-3 w-3" style={{ color: a }} />
          </span>
          <span className="flex-1 truncate text-[11px] font-semibold" style={{ color: "var(--foreground)" }}>
            {d.label || "Condición"}
          </span>
          <CheckCircle2 className="h-3 w-3 opacity-70" style={{ color: a }} />
        </div>

        <div className="h-px w-full" style={{ background: `${a}30` }} />

        {/* Body */}
        <div className="px-3 py-2.5">
          <p className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>
            {d.conditionType
              ? CONDITION_LABELS[d.conditionType] ?? d.conditionType
              : "Selecciona condición →"}
          </p>
        </div>

        {/* Yes/No labels */}
        <div
          className="flex justify-between px-4 pb-3 pt-0.5"
        >
          <span className="flex items-center gap-1 text-[9px] font-bold">
            <span
              className="rounded-full px-1.5 py-0.5"
              style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}
            >
              SÍ
            </span>
          </span>
          <span className="flex items-center gap-1 text-[9px] font-bold">
            <span
              className="rounded-full px-1.5 py-0.5"
              style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}
            >
              NO
            </span>
          </span>
        </div>

        {/* Dual source handles */}
        <Handle
          type="source" id="yes" position={Position.Bottom}
          style={{ left: "28%", background: "#10B981", borderColor: "var(--surface)" }}
          className="!h-3 !w-3 !border-2 !rounded-full"
        />
        <Handle
          type="source" id="no" position={Position.Bottom}
          style={{ left: "72%", background: "#EF4444", borderColor: "var(--surface)" }}
          className="!h-3 !w-3 !border-2 !rounded-full"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EMAIL
// ---------------------------------------------------------------------------

export function EmailNode({ data, selected }: NodeProps) {
  const d = data as NodeData;

  return (
    <BaseNode data={d} selected={selected} icon={Mail}>
      {d.subject ? (
        <p className="truncate text-[10px] font-medium" style={{ color: "var(--foreground)" }}>
          {d.subject}
        </p>
      ) : (
        <p className="text-[10px] italic" style={{ color: "var(--danger)" }}>
          Añade asunto y cuerpo
        </p>
      )}
      {d.bodyA && (
        <p className="mt-0.5 line-clamp-1 text-[10px]" style={{ color: "var(--foreground-faint)" }}>
          {d.bodyA}
        </p>
      )}
      {d.useABTest && (
        <span
          className="mt-1.5 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold"
          style={{ background: "rgba(59,130,246,0.12)", color: "#3B82F6" }}
        >
          A/B
        </span>
      )}
    </BaseNode>
  );
}

// ---------------------------------------------------------------------------
// END
// ---------------------------------------------------------------------------

export function EndNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const a = "#10B981";

  return (
    <div className="relative">
      {d.abVariant && <ABBadge variant={d.abVariant} />}

      <div
        className="relative min-w-[200px] overflow-hidden rounded-xl"
        style={{
          background: "var(--surface)",
          border: selected ? `2px solid ${a}` : `1px solid ${a}50`,
          boxShadow: selected
            ? `0 0 0 3px ${a}26, var(--shadow-md)`
            : "var(--shadow-sm)",
          transition: "border-color 150ms, box-shadow 150ms",
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !rounded-full"
          style={{ background: a, borderColor: "var(--surface)" }}
        />

        <div
          className="flex items-center gap-2.5 px-3 py-2.5"
          style={{ background: `${a}18` }}
        >
          <span
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: `${a}30` }}
          >
            <CheckCircle2 className="h-3 w-3" style={{ color: a }} />
          </span>
          <span className="flex-1 text-[11px] font-semibold" style={{ color: "var(--foreground)" }}>
            Fin del flujo
          </span>
          <Flag className="h-3 w-3 opacity-50" style={{ color: a }} />
        </div>

        <div className="h-px w-full" style={{ background: `${a}30` }} />

        <div className="px-3 py-2.5">
          <p className="text-[10px]" style={{ color: "var(--foreground-faint)" }}>
            Lead archivado automáticamente.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AUTOPILOT (AI Node)
// ---------------------------------------------------------------------------

export function AutopilotNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const a = accent("autopilot");

  return (
    <div className="relative">
      {d.abVariant && <ABBadge variant={d.abVariant} />}

      <div
        className="relative min-w-[220px] overflow-hidden rounded-xl"
        style={{
          background: "var(--surface)",
          border: selected ? `2px solid ${a}` : "1px solid var(--border)",
          boxShadow: selected
            ? `0 0 0 3px ${a}26, var(--shadow-md)`
            : "var(--shadow-sm)",
          transition: "border-color 150ms, box-shadow 150ms",
        }}
      >
        <TargetHandle color={a} />

        {/* Full gradient header */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5"
          style={{
            background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(6,182,212,0.12))",
          }}
        >
          <span
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgba(6,182,212,0.2)" }}
          >
            <Bot className="h-3 w-3" style={{ color: "#06B6D4" }} />
          </span>
          <span className="flex-1 text-[11px] font-semibold" style={{ color: "var(--foreground)" }}>
            Autopilot IA
          </span>
          {/* CAZARY AI badge */}
          <span
            className="rounded-full px-1.5 py-0.5 text-[8px] font-black tracking-wide"
            style={{
              background: "linear-gradient(90deg, #2563EB, #06B6D4)",
              color: "white",
            }}
          >
            CAZARY AI
          </span>
        </div>

        <div
          className="h-px w-full"
          style={{ background: "linear-gradient(90deg, rgba(37,99,235,0.3), rgba(6,182,212,0.3))" }}
        />

        <div className="px-3 py-2.5">
          <p className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>
            {d.autopilotEnabled ? "Claude negocia y cierra la reunión." : "Configura el agente →"}
          </p>
        </div>

        <SourceHandle color={a} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GENERIC (visit / like)
// ---------------------------------------------------------------------------

export function GenericNode({ data, selected }: NodeProps) {
  const d    = data as NodeData;
  const Icon = d.nodeType === "like" ? Heart : Globe;
  return (
    <BaseNode data={d} selected={selected} icon={Icon}>
      <p className="text-[10px]" style={{ color: "var(--foreground-faint)" }}>{d.label}</p>
    </BaseNode>
  );
}

// ---------------------------------------------------------------------------
// WITHDRAW
// ---------------------------------------------------------------------------

export function WithdrawNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  return (
    <BaseNode data={d} selected={selected} icon={UserMinus}>
      <p className="text-[10px]" style={{ color: "var(--foreground-faint)" }}>
        Retira solicitud pendiente o desconecta al lead
      </p>
    </BaseNode>
  );
}

// ---------------------------------------------------------------------------
// FIND EMAIL
// ---------------------------------------------------------------------------

export function FindEmailNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  return (
    <BaseNode data={d} selected={selected} icon={AtSign}>
      {(d as NodeData & { foundEmail?: boolean }).foundEmail ? (
        <p className="text-[10px] font-medium" style={{ color: "var(--success)" }}>✓ Email guardado</p>
      ) : (
        <p className="text-[10px]" style={{ color: "var(--foreground-faint)" }}>
          Buscando email del lead...
        </p>
      )}
    </BaseNode>
  );
}

// ---------------------------------------------------------------------------
// FIND PHONE
// ---------------------------------------------------------------------------

export function FindPhoneNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  return (
    <BaseNode data={d} selected={selected} icon={Phone}>
      {(d as NodeData & { foundPhone?: boolean }).foundPhone ? (
        <p className="text-[10px] font-medium" style={{ color: "var(--success)" }}>✓ Teléfono guardado</p>
      ) : (
        <p className="text-[10px]" style={{ color: "var(--foreground-faint)" }}>
          Buscando teléfono...
        </p>
      )}
    </BaseNode>
  );
}

// ---------------------------------------------------------------------------
// CONNECT EMAIL
// ---------------------------------------------------------------------------

export function ConnectEmailNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const a = accent("connect_email");

  return (
    <div className="relative">
      {d.abVariant && <ABBadge variant={d.abVariant} />}

      <div
        className="relative min-w-[220px] overflow-hidden rounded-xl"
        style={{
          background: "var(--surface)",
          border: selected ? `2px solid ${a}` : "1px solid var(--border)",
          boxShadow: selected
            ? `0 0 0 3px ${a}26, var(--shadow-md)`
            : "var(--shadow-sm)",
          transition: "border-color 150ms, box-shadow 150ms",
        }}
      >
        <TargetHandle color={a} />

        <div
          className="flex items-center gap-2.5 px-3 py-2.5"
          style={{ background: `${a}18` }}
        >
          <span
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: `${a}30` }}
          >
            <MailPlus className="h-3 w-3" style={{ color: a }} />
          </span>
          <span className="flex-1 truncate text-[11px] font-semibold" style={{ color: "var(--foreground)" }}>
            {d.label}
          </span>
          <span
            className="rounded-full px-1.5 py-0.5 text-[8px] font-bold"
            style={{ background: `${a}20`, color: a }}
          >
            PRO
          </span>
        </div>

        <div className="h-px w-full" style={{ background: `${a}30` }} />

        <div className="px-3 py-2.5">
          <p className="text-[10px]" style={{ color: "var(--foreground-faint)" }}>
            Usa email del lead para conectar
          </p>
        </div>

        <SourceHandle color={a} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// nodeTypes map — unchanged, must stay identical for React Flow to work
// ---------------------------------------------------------------------------

export const nodeTypes = {
  start:        StartNode,
  connect:      ConnectNode,
  message:      MessageNode,
  delay:        DelayNode,
  wait:         DelayNode,         // legacy alias
  condition:    ConditionNode,
  email:        EmailNode,
  email_node:   EmailNode,         // legacy alias
  end:          EndNode,
  autopilot:    AutopilotNode,
  visit:        GenericNode,
  like:         GenericNode,
  withdraw:     WithdrawNode,
  find_email:   FindEmailNode,
  find_phone:   FindPhoneNode,
  connect_email: ConnectEmailNode,
} as const;
