"use client";

import {
  AtSign, Bot, Clock, Flag, GitBranch, Globe, Heart, Mail,
  MailPlus, MessageSquare, Phone, Play, UserMinus, UserPlus,
} from "lucide-react";
import type { ElementType } from "react";
import type { NodeType } from "./types";

type PaletteItem = {
  nodeType: NodeType;
  rfType: string;
  label: string;
  description: string;
  Icon: ElementType;
  iconCls: string;
  group: string;
};

const ITEMS: PaletteItem[] = [
  // Inicio
  {
    nodeType: "start", rfType: "start",
    label: "Inicio", description: "Punto de entrada",
    Icon: Play, iconCls: "bg-green-100 text-green-700", group: "Inicio",
  },
  // LinkedIn
  {
    nodeType: "connect", rfType: "connect",
    label: "Enviar Conexión", description: "Solicitud + nota opcional",
    Icon: UserPlus, iconCls: "bg-indigo-100 text-indigo-700", group: "LinkedIn",
  },
  {
    nodeType: "message", rfType: "message",
    label: "Enviar Mensaje", description: "Texto con variables dinámicas",
    Icon: MessageSquare, iconCls: "bg-emerald-100 text-emerald-700", group: "LinkedIn",
  },
  {
    nodeType: "visit", rfType: "visit",
    label: "Visitar Perfil", description: "Abre el perfil del lead",
    Icon: Globe, iconCls: "bg-cyan-100 text-cyan-700", group: "LinkedIn",
  },
  {
    nodeType: "like", rfType: "like",
    label: "Like Post", description: "Dar like a publicación",
    Icon: Heart, iconCls: "bg-pink-100 text-pink-700", group: "LinkedIn",
  },
  {
    nodeType: "withdraw", rfType: "withdraw",
    label: "Quitar Conexión", description: "Retira solicitud o desconecta",
    Icon: UserMinus, iconCls: "bg-red-100 text-red-600", group: "LinkedIn",
  },
  // Email
  {
    nodeType: "email", rfType: "email",
    label: "Enviar Email", description: "Email con asunto y cuerpo",
    Icon: Mail, iconCls: "bg-blue-100 text-blue-700", group: "Email",
  },
  // Especiales
  {
    nodeType: "find_email", rfType: "find_email",
    label: "Buscar Email", description: "Extrae email → guarda en BD",
    Icon: AtSign, iconCls: "bg-teal-100 text-teal-700", group: "Especiales",
  },
  {
    nodeType: "find_phone", rfType: "find_phone",
    label: "Buscar Teléfono", description: "Extrae teléfono → guarda en BD",
    Icon: Phone, iconCls: "bg-teal-100 text-teal-700", group: "Especiales",
  },
  {
    nodeType: "connect_email", rfType: "connect_email",
    label: "Conexión via Email", description: "Invitar usando correo del lead",
    Icon: MailPlus, iconCls: "bg-violet-100 text-violet-700", group: "Especiales",
  },
  // IA
  {
    nodeType: "autopilot", rfType: "autopilot",
    label: "Autopilot IA", description: "IA negocia y cierra la cita",
    Icon: Bot, iconCls: "bg-purple-100 text-purple-700", group: "IA",
  },
  // Flujo
  {
    nodeType: "delay", rfType: "delay",
    label: "Esperar N días", description: "Pausa antes del siguiente paso",
    Icon: Clock, iconCls: "bg-amber-100 text-amber-700", group: "Flujo",
  },
  {
    nodeType: "condition", rfType: "condition",
    label: "Condición IF", description: "Ramifica según respuesta",
    Icon: GitBranch, iconCls: "bg-orange-100 text-orange-700", group: "Flujo",
  },
  {
    nodeType: "end", rfType: "end",
    label: "Fin del flujo", description: "Cierra la secuencia del lead",
    Icon: Flag, iconCls: "bg-slate-100 text-slate-600", group: "Flujo",
  },
];

const GROUPS = ["Inicio", "LinkedIn", "Email", "Especiales", "IA", "Flujo"];

export function NodePalette() {
  function onDragStart(e: React.DragEvent<HTMLDivElement>, item: PaletteItem) {
    e.dataTransfer.setData("application/reactflow/type",     item.rfType);
    e.dataTransfer.setData("application/reactflow/nodeType", item.nodeType);
    e.dataTransfer.setData("application/reactflow/label",    item.label);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-4 py-3">
        <h2 className="text-xs font-bold text-zinc-900">Nodos</h2>
        <p className="mt-0.5 text-[10px] text-zinc-400">Arrastra al lienzo</p>
      </div>

      <div className="flex-1 space-y-4 p-2.5 pb-8">
        {GROUPS.map((group) => {
          const items = ITEMS.filter((n) => n.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <p className="mb-1.5 px-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                {group}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.Icon;
                  return (
                    <div
                      key={`${item.rfType}-${item.label}`}
                      draggable
                      onDragStart={(e) => onDragStart(e, item)}
                      className="flex cursor-grab items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 transition-all select-none hover:border-zinc-200 hover:bg-zinc-50 active:cursor-grabbing active:scale-95"
                    >
                      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${item.iconCls}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-zinc-800">{item.label}</p>
                        <p className="truncate text-[9px] text-zinc-400">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state hint */}
      <div className="border-t border-zinc-100 px-4 py-3 text-[10px] text-zinc-400 leading-relaxed">
        Haz clic en cualquier nodo del lienzo para configurarlo en el panel derecho.
      </div>
    </aside>
  );
}
