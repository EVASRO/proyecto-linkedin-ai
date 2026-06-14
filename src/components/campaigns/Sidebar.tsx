"use client";

import {
  Bot, Clock, DatabaseZap, Eye, Flag, GitBranch, Heart, Mail,
  Play, Sparkles, UserPlus,
} from "lucide-react";
import type { ElementType } from "react";
import type { CampaignNodeType } from "./types";

type PaletteNode = {
  nodeType: CampaignNodeType;
  reactFlowType: string;
  label: string;
  description: string;
  Icon: ElementType;
  iconBg: string;
  group: string;
};

const NODES: PaletteNode[] = [
  { nodeType: "start",      reactFlowType: "start",      label: "Inicio",           description: "Punto de entrada",             Icon: Play,        iconBg: "bg-[rgba(16,185,129,0.12)] text-[#10B981]",  group: "Inicio"                  },
  { nodeType: "visit",      reactFlowType: "visit",      label: "Visitar Perfil",   description: "Abre el perfil del lead",      Icon: Eye,         iconBg: "bg-[rgba(6,182,212,0.12)] text-[#06B6D4]",   group: "Acciones LinkedIn"       },
  { nodeType: "connect",    reactFlowType: "connect",    label: "Enviar Conexión",  description: "Solicitud + nota opcional",    Icon: UserPlus,    iconBg: "bg-[rgba(37,99,235,0.12)] text-[#2563EB]",   group: "Acciones LinkedIn"       },
  { nodeType: "message",    reactFlowType: "message",    label: "Mensaje IA",       description: "Claude redacta el mensaje",    Icon: Sparkles,    iconBg: "bg-[rgba(37,99,235,0.12)] text-[#2563EB]",   group: "Acciones LinkedIn"       },
  { nodeType: "like",       reactFlowType: "like",       label: "Like Post",        description: "Dar like a publicación",       Icon: Heart,       iconBg: "bg-[rgba(239,68,68,0.12)] text-[#EF4444]",   group: "Acciones LinkedIn"       },
  { nodeType: "email_node", reactFlowType: "email_node", label: "Enviar Email",     description: "Email con soporte A/B",        Icon: Mail,        iconBg: "bg-[rgba(6,182,212,0.12)] text-[#06B6D4]",   group: "Email"                   },
  { nodeType: "message",    reactFlowType: "enrich",     label: "Enriquecer Lead",  description: "Busca email/tel waterfall",    Icon: DatabaseZap, iconBg: "bg-[rgba(6,182,212,0.12)] text-[#06B6D4]",   group: "Enriquecimiento"         },
  { nodeType: "autopilot",  reactFlowType: "autopilot",  label: "Autopilot IA",     description: "IA negocia y cierra la cita",  Icon: Bot,         iconBg: "bg-[rgba(37,99,235,0.12)] text-[#2563EB]",   group: "Inteligencia Artificial" },
  { nodeType: "wait",       reactFlowType: "wait",       label: "Esperar N días",   description: "Pausa antes del próximo paso", Icon: Clock,       iconBg: "bg-[rgba(245,158,11,0.12)] text-[#F59E0B]",  group: "Control de Flujo"        },
  { nodeType: "condition",  reactFlowType: "condition",  label: "Condición IF",     description: "Ramifica según la respuesta",  Icon: GitBranch,   iconBg: "bg-[rgba(245,158,11,0.12)] text-[#F59E0B]",  group: "Control de Flujo"        },
  { nodeType: "end",        reactFlowType: "end",        label: "Fin del flujo",    description: "Cierra la secuencia del lead", Icon: Flag,        iconBg: "bg-[rgba(239,68,68,0.12)] text-[#EF4444]",   group: "Control de Flujo"        },
];

const GROUPS = [
  "Inicio",
  "Acciones LinkedIn",
  "Email",
  "Enriquecimiento",
  "Inteligencia Artificial",
  "Control de Flujo",
];

export function Sidebar() {
  function onDragStart(e: React.DragEvent<HTMLDivElement>, node: PaletteNode) {
    e.dataTransfer.setData("application/reactflow/type",        node.reactFlowType);
    e.dataTransfer.setData("application/reactflow/nodeType",    node.nodeType);
    e.dataTransfer.setData("application/reactflow/label",       node.label);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-xs font-bold text-[var(--foreground)]">Nodos</h2>
        <p className="mt-0.5 text-[10px] text-[var(--foreground-faint)]">Arrastra al lienzo</p>
      </div>

      <div className="flex-1 space-y-4 p-2.5 pb-6">
        {GROUPS.map((group) => {
          const items = NODES.filter((n) => n.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <p className="mb-1.5 px-1 text-[9px] font-bold uppercase tracking-widest text-[var(--foreground-faint)]">
                {group}
              </p>
              <div className="space-y-0.5">
                {items.map((node) => {
                  const Icon = node.Icon;
                  return (
                    <div
                      key={node.label}
                      draggable
                      onDragStart={(e) => onDragStart(e, node)}
                      className="flex cursor-grab items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 transition-all hover:border-[var(--border)] hover:bg-[rgba(255,255,255,0.04)] active:cursor-grabbing active:scale-95"
                    >
                      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${node.iconBg}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-[var(--foreground)]">{node.label}</p>
                        <p className="truncate text-[9px] text-[var(--foreground-faint)]">{node.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
