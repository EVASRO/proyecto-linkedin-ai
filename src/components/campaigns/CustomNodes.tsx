"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  AlertCircle, Bot, CheckCircle2, Clock, Flag, GitBranch,
  Globe, Heart, Mail, Play, Sparkles, UserPlus, Eye,
} from "lucide-react";
import type { NodeData, CampaignNodeType } from "./types";

// ── Validation ────────────────────────────────────────────────────────────────

function isConfigured(data: NodeData): boolean {
  switch (data.nodeType) {
    case "message":
      return !!(data.bodyA?.trim());
    case "email_node":
      return !!(data.subject?.trim() && data.bodyA?.trim());
    case "connect":
      if (data.addNote) return !!(data.messageA?.trim());
      return true;
    case "wait":
      return !!(data.days && data.days > 0);
    default:
      return true;
  }
}

// ── Color registry ────────────────────────────────────────────────────────────

const NODE_PALETTE: Record<CampaignNodeType, { header: string; icon: React.ElementType; ring: string }> = {
  start:      { header: "bg-green-500",    icon: Play,       ring: "ring-green-200"  },
  connect:    { header: "bg-blue-500",     icon: UserPlus,   ring: "ring-blue-200"   },
  message:    { header: "bg-indigo-600",   icon: Sparkles,   ring: "ring-indigo-200" },
  email_node: { header: "bg-sky-500",      icon: Mail,       ring: "ring-sky-200"    },
  wait:       { header: "bg-amber-500",    icon: Clock,      ring: "ring-amber-200"  },
  condition:  { header: "bg-orange-500",   icon: GitBranch,  ring: "ring-orange-200" },
  autopilot:  { header: "bg-purple-600",   icon: Bot,        ring: "ring-purple-200" },
  visit:      { header: "bg-cyan-500",     icon: Eye,        ring: "ring-cyan-200"   },
  like:       { header: "bg-pink-500",     icon: Heart,      ring: "ring-pink-200"   },
  end:        { header: "bg-red-500",      icon: Flag,       ring: "ring-red-200"    },
};

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ configured }: { configured: boolean }) {
  if (configured) {
    return (
      <span title="Configurado" className="flex h-4 w-4 items-center justify-center">
        <CheckCircle2 className="h-3.5 w-3.5 text-white/80" />
      </span>
    );
  }
  return (
    <span title="Falta configuración" className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 ring-1 ring-white">
      <AlertCircle className="h-2.5 w-2.5 text-white" />
    </span>
  );
}

// ── Base Node Shell ───────────────────────────────────────────────────────────

function NodeShell({
  data,
  isSelected,
  showSource = true,
  showTarget = true,
  children,
  extraSources,
}: {
  data: NodeData;
  isSelected?: boolean;
  showSource?: boolean;
  showTarget?: boolean;
  children?: React.ReactNode;
  extraSources?: React.ReactNode;
}) {
  const palette = NODE_PALETTE[data.nodeType] ?? NODE_PALETTE.connect;
  const Icon = palette.icon;
  const configured = isConfigured(data);

  return (
    <div
      className={[
        "w-56 overflow-hidden rounded-xl border-2 bg-white shadow-md transition-all duration-100",
        isSelected
          ? `${palette.ring} ring-2 ring-offset-1 border-transparent shadow-lg`
          : "border-zinc-200",
      ].join(" ")}
    >
      {showTarget && (
        <Handle
          type="target"
          position={Position.Top}
          className="!border-2 !border-white !h-3 !w-3 !bg-zinc-400"
        />
      )}

      {/* Header */}
      <div className={`flex items-center gap-2 ${palette.header} px-3 py-2`}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25">
          <Icon className="h-2.5 w-2.5 text-white" />
        </span>
        <span className="flex-1 truncate text-[11px] font-bold text-white">
          {data.label}
        </span>
        <StatusBadge configured={configured} />
      </div>

      {/* Body */}
      {children && <div className="px-3 py-2.5">{children}</div>}

      {showSource && !extraSources && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!border-2 !border-white !h-3 !w-3 !bg-zinc-400"
        />
      )}
      {extraSources}
    </div>
  );
}

// ── Individual Nodes ──────────────────────────────────────────────────────────

export function StartNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  return (
    <div className="w-56 overflow-hidden rounded-xl border-2 border-green-200 bg-white shadow-md">
      <div className="flex items-center gap-2 bg-green-500 px-3 py-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25">
          <Play className="h-2.5 w-2.5 fill-white text-white" />
        </span>
        <span className="flex-1 text-[11px] font-bold text-white">{d.label}</span>
        <CheckCircle2 className="h-3.5 w-3.5 text-white/80" />
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[10px] text-zinc-400">Punto de inicio de la secuencia</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!border-2 !border-white !h-3 !w-3 !bg-green-500" />
    </div>
  );
}

export function ConnectNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const configured = isConfigured(d);
  const palette = NODE_PALETTE.connect;

  return (
    <div className={["w-56 overflow-hidden rounded-xl border-2 bg-white shadow-md", selected ? "ring-2 ring-offset-1 ring-blue-200 border-transparent" : "border-zinc-200"].join(" ")}>
      <Handle type="target" position={Position.Top} className="!border-2 !border-white !h-3 !w-3 !bg-zinc-400" />
      <div className={`flex items-center gap-2 ${palette.header} px-3 py-2`}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25">
          <UserPlus className="h-2.5 w-2.5 text-white" />
        </span>
        <span className="flex-1 truncate text-[11px] font-bold text-white">{d.label}</span>
        <StatusBadge configured={configured} />
      </div>
      <div className="px-3 py-2.5 space-y-1">
        {d.addNote ? (
          d.messageA ? (
            <p className="line-clamp-2 text-[10px] text-zinc-600">
              &ldquo;{d.messageA}&rdquo;
            </p>
          ) : (
            <p className="text-[10px] italic text-red-400">← Añade una nota de conexión</p>
          )
        ) : (
          <p className="text-[10px] text-zinc-400">Sin nota · Conexión directa</p>
        )}
        {d.useABTest && <span className="inline-flex rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-600">A/B</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!border-2 !border-white !h-3 !w-3 !bg-blue-400" />
    </div>
  );
}

export function MessageNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const configured = isConfigured(d);
  const palette = NODE_PALETTE.message;

  return (
    <div className={["w-56 overflow-hidden rounded-xl border-2 bg-white shadow-md", selected ? "ring-2 ring-offset-1 ring-indigo-200 border-transparent" : "border-zinc-200"].join(" ")}>
      <Handle type="target" position={Position.Top} className="!border-2 !border-white !h-3 !w-3 !bg-zinc-400" />
      <div className={`flex items-center gap-2 ${palette.header} px-3 py-2`}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25">
          <Sparkles className="h-2.5 w-2.5 text-white" />
        </span>
        <span className="flex-1 truncate text-[11px] font-bold text-white">{d.label}</span>
        <StatusBadge configured={configured} />
      </div>
      <div className="px-3 py-2.5 space-y-1">
        {d.bodyA ? (
          <p className="line-clamp-2 text-[10px] text-zinc-600">&ldquo;{d.bodyA}&rdquo;</p>
        ) : (
          <p className="text-[10px] italic text-red-400">← Escribe el mensaje</p>
        )}
        {d.useABTest && <span className="inline-flex rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">A/B</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!border-2 !border-white !h-3 !w-3 !bg-indigo-400" />
    </div>
  );
}

export function EmailNodeComponent({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const configured = isConfigured(d);
  const palette = NODE_PALETTE.email_node;

  return (
    <div className={["w-56 overflow-hidden rounded-xl border-2 bg-white shadow-md", selected ? "ring-2 ring-offset-1 ring-sky-200 border-transparent" : "border-zinc-200"].join(" ")}>
      <Handle type="target" position={Position.Top} className="!border-2 !border-white !h-3 !w-3 !bg-zinc-400" />
      <div className={`flex items-center gap-2 ${palette.header} px-3 py-2`}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25">
          <Mail className="h-2.5 w-2.5 text-white" />
        </span>
        <span className="flex-1 truncate text-[11px] font-bold text-white">{d.label}</span>
        <StatusBadge configured={configured} />
      </div>
      <div className="px-3 py-2.5 space-y-1">
        {d.subject ? (
          <p className="truncate text-[10px] font-medium text-zinc-700">📧 {d.subject}</p>
        ) : (
          <p className="text-[10px] italic text-red-400">← Añade asunto y cuerpo</p>
        )}
        {d.useABTest && <span className="inline-flex rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold text-sky-600">A/B</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!border-2 !border-white !h-3 !w-3 !bg-sky-400" />
    </div>
  );
}

export function WaitNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const palette = NODE_PALETTE.wait;

  return (
    <div className={["w-56 overflow-hidden rounded-xl border-2 bg-white shadow-md", selected ? "ring-2 ring-offset-1 ring-amber-200 border-transparent" : "border-zinc-200"].join(" ")}>
      <Handle type="target" position={Position.Top} className="!border-2 !border-white !h-3 !w-3 !bg-zinc-400" />
      <div className={`flex items-center gap-2 ${palette.header} px-3 py-2`}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25">
          <Clock className="h-2.5 w-2.5 text-white" />
        </span>
        <span className="flex-1 truncate text-[11px] font-bold text-white">Esperar</span>
        <CheckCircle2 className="h-3.5 w-3.5 text-white/80" />
      </div>
      <div className="flex items-baseline gap-1.5 px-3 py-2.5">
        <span className="text-2xl font-bold tabular-nums text-zinc-900">{d.days ?? 1}</span>
        <span className="text-xs text-zinc-500">día{(d.days ?? 1) !== 1 ? "s" : ""}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!border-2 !border-white !h-3 !w-3 !bg-amber-400" />
    </div>
  );
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const LABELS: Record<string, string> = {
    accepted_connection: "¿Aceptó la conexión?",
    replied:             "¿Respondió el mensaje?",
    no_response:         "Sin respuesta tras",
  };
  return (
    <div className={["w-56 overflow-hidden rounded-xl border-2 bg-white shadow-md", selected ? "ring-2 ring-offset-1 ring-orange-200 border-transparent" : "border-zinc-200"].join(" ")}>
      <Handle type="target" position={Position.Top} className="!border-2 !border-white !h-3 !w-3 !bg-zinc-400" />
      <div className="flex items-center gap-2 bg-orange-500 px-3 py-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25">
          <GitBranch className="h-2.5 w-2.5 text-white" />
        </span>
        <span className="flex-1 truncate text-[11px] font-bold text-white">
          {d.label || "Condición IF"}
        </span>
        <CheckCircle2 className="h-3.5 w-3.5 text-white/80" />
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[10px] text-zinc-600">
          {d.conditionType ? LABELS[d.conditionType] : "Selecciona condición →"}
          {d.conditionType === "no_response" && d.waitDays ? ` ${d.waitDays} días` : ""}
        </p>
      </div>
      {/* Two source handles: YES (left) and NO (right) */}
      <div className="flex justify-between px-3 pb-2">
        <span className="text-[9px] font-bold text-green-500 ml-2">SÍ ↓</span>
        <span className="text-[9px] font-bold text-red-500 mr-2">NO ↓</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: "30%"  }} className="!border-2 !border-white !h-3 !w-3 !bg-green-500" />
      <Handle type="source" position={Position.Bottom} id="no"  style={{ left: "70%"  }} className="!border-2 !border-white !h-3 !w-3 !bg-red-400"   />
    </div>
  );
}

export function AutopilotNode({ data, selected }: NodeProps) {
  return (
    <div className={["w-56 overflow-hidden rounded-xl border-2 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-md", selected ? "ring-2 ring-offset-1 ring-purple-200 border-transparent" : "border-purple-200"].join(" ")}>
      <Handle type="target" position={Position.Top} className="!border-2 !border-white !h-3 !w-3 !bg-purple-400" />
      <div className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25">
          <Bot className="h-2.5 w-2.5 text-white" />
        </span>
        <span className="flex-1 text-[11px] font-bold text-white">Autopilot IA</span>
        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold text-white">PRO</span>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[10px] text-purple-700">Claude negocia y cierra la reunión de forma autónoma.</p>
      </div>
    </div>
  );
}

export function EndNode({ selected }: NodeProps) {
  return (
    <div className={["w-44 overflow-hidden rounded-xl border-2 shadow-md", selected ? "ring-2 ring-offset-1 ring-red-200 border-transparent" : "border-red-300"].join(" ")}>
      <Handle type="target" position={Position.Top} className="!border-2 !border-white !h-3 !w-3 !bg-red-400" />
      <div className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-rose-500 px-3 py-2">
        <Flag className="h-3.5 w-3.5 text-white" />
        <span className="text-[11px] font-bold text-white">Fin del flujo</span>
      </div>
      <div className="bg-red-50 px-3 py-2">
        <p className="text-[10px] text-red-600">El lead sale de la secuencia. Archivado automáticamente.</p>
      </div>
    </div>
  );
}

export function GenericActionNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const palette = NODE_PALETTE[d.nodeType] ?? NODE_PALETTE.visit;
  const Icon = palette.icon;

  return (
    <div className={["w-56 overflow-hidden rounded-xl border-2 bg-white shadow-md", selected ? `ring-2 ring-offset-1 ${palette.ring} border-transparent` : "border-zinc-200"].join(" ")}>
      <Handle type="target" position={Position.Top} className="!border-2 !border-white !h-3 !w-3 !bg-zinc-400" />
      <div className={`flex items-center gap-2 ${palette.header} px-3 py-2`}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25">
          <Icon className="h-2.5 w-2.5 text-white" />
        </span>
        <span className="flex-1 truncate text-[11px] font-bold text-white">{d.label}</span>
        <CheckCircle2 className="h-3.5 w-3.5 text-white/80" />
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[10px] text-zinc-400">{d.label}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!border-2 !border-white !h-3 !w-3 !bg-zinc-400" />
    </div>
  );
}

export const nodeTypes = {
  start:      StartNode,
  connect:    ConnectNode,
  message:    MessageNode,
  email_node: EmailNodeComponent,
  wait:       WaitNode,
  condition:  ConditionNode,
  autopilot:  AutopilotNode,
  visit:      GenericActionNode,
  like:       GenericActionNode,
  end:        EndNode,
};
