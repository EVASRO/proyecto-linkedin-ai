"use client";

import { Globe, Link2, Mail, Phone, Users, Zap } from "lucide-react";
import type { CrmLead, Column, TagColor } from "./types";

const TAG_CLS: Record<TagColor, string> = {
  blue:   "bg-blue-50   text-blue-700",
  violet: "bg-violet-50 text-violet-700",
  green:  "bg-green-50  text-green-700",
  amber:  "bg-amber-50  text-amber-700",
  red:    "bg-red-50    text-red-700",
  pink:   "bg-pink-50   text-pink-700",
  sky:    "bg-sky-50    text-sky-700",
  gray:   "bg-zinc-100  text-zinc-600",
  indigo: "bg-indigo-50 text-indigo-700",
};

const SOURCE_ICON: Record<string, React.ElementType> = {
  LinkedIn: Link2,
  Web:      Globe,
  Email:    Mail,
  Llamada:  Phone,
  Referido: Users,
};

const AVATAR_PALETTE = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-pink-500",  "bg-indigo-600", "bg-sky-500",     "bg-orange-500",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

interface LeadsListViewProps {
  leads: CrmLead[];
  columns: Column[];
  onLeadClick?: (lead: CrmLead) => void;
}

export function LeadsListView({ leads, columns, onLeadClick }: LeadsListViewProps) {
  const colMap = Object.fromEntries(columns.map((c) => [c.id, c.title]));

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50/80">
            {["Contacto", "Empresa", "Valor", "Etapa actual", "Etiquetas", "Fuente", "Última acción"].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {leads.map((lead) => {
            const Icon = SOURCE_ICON[lead.source] ?? Globe;
            return (
              <tr
                key={lead.id}
                onClick={() => onLeadClick?.(lead)}
                className="group cursor-pointer transition-colors hover:bg-indigo-50/50"
              >
                {/* Contacto */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(lead.name)}`}
                    >
                      {initials(lead.name)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{lead.name}</p>
                      <p className="text-[10px] text-zinc-400">#{lead.id}</p>
                    </div>
                  </div>
                </td>

                {/* Empresa */}
                <td className="px-4 py-3 text-sm text-zinc-600">{lead.company}</td>

                {/* Valor */}
                <td className="px-4 py-3">
                  <span className="text-sm font-bold text-zinc-900">
                    {lead.value >= 1000 ? `$${(lead.value / 1000).toFixed(0)}K` : `$${lead.value}`}
                  </span>
                </td>

                {/* Etapa */}
                <td className="px-4 py-3">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
                    {colMap[lead.status] ?? lead.status}
                  </span>
                </td>

                {/* Etiquetas */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {lead.tags.map((t) => (
                      <span
                        key={t.label}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TAG_CLS[t.color] ?? TAG_CLS.gray}`}
                      >
                        {t.label}
                      </span>
                    ))}
                  </div>
                </td>

                {/* Fuente */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-xs">{lead.source}</span>
                  </div>
                </td>

                {/* Última acción */}
                <td className="px-4 py-3">
                  {lead.nextTask ? (
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-400" />
                      <span className="text-[11px] font-medium text-amber-600">
                        {lead.nextTask}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] italic text-zinc-400">Sin tareas</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
