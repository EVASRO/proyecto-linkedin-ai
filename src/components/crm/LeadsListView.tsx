"use client";

import {
  ArrowDown, ArrowUp, ArrowUpDown,
  Building2, Calendar, ChevronRight, CheckCircle2, Circle, Clock,
  Clock3, ExternalLink, Mail, MessageSquare, Phone, Star,
  UserCheck, Users, Zap,
} from "lucide-react";
import type { CrmLead, Column, TagColor } from "./types";

// -- Constantes de diseño ------------------------------------------------------

const TAG_CLS: Record<TagColor, string> = {
  blue:   "bg-blue-50   text-blue-700   border border-blue-100",
  violet: "bg-violet-50 text-violet-700 border border-violet-100",
  green:  "bg-green-50  text-green-700  border border-green-100",
  amber:  "bg-amber-50  text-amber-700  border border-amber-100",
  red:    "bg-red-50    text-red-700    border border-red-100",
  pink:   "bg-pink-50   text-pink-700   border border-pink-100",
  sky:    "bg-sky-50    text-sky-700    border border-sky-100",
  gray:   "bg-zinc-100  text-zinc-600   border border-zinc-200",
  indigo: "bg-indigo-50 text-indigo-700 border border-indigo-100",
};

const CONN_STATUS = {
  none:            { label: "Sin contactar", cls: "bg-zinc-100 text-zinc-500",           Icon: Circle        },
  pending:         { label: "Inv. enviada",  cls: "bg-blue-50 text-blue-600",            Icon: Clock3        },
  connected:       { label: "Conectado",     cls: "bg-violet-50 text-violet-700",        Icon: UserCheck     },
  in_conversation: { label: "Conversando",   cls: "bg-amber-50 text-amber-700",          Icon: MessageSquare },
  meeting:         { label: "Reunión",       cls: "bg-green-50 text-green-700",          Icon: CheckCircle2  },
} as const;

const STAGE_CLS: Record<string, string> = {
  extraido:          "bg-blue-50   text-blue-700",
  conexion_enviada:  "bg-indigo-50 text-indigo-700",
  conexion_aceptada: "bg-violet-50 text-violet-700",
  en_conversacion:   "bg-amber-50  text-amber-700",
  reunion_agendada:  "bg-orange-50 text-orange-700",
  cliente:           "bg-green-50  text-green-700",
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `hace ${d}d`;
  if (h > 0) return `hace ${h}h`;
  if (m > 0) return `hace ${m}m`;
  return "ahora";
}

// -- Tipos de columnas ---------------------------------------------------------

type SortField = "created_at" | "value" | "score" | "days_in_stage";

interface ColDef {
  key:      string;
  label:    string;
  sortable?: SortField;
  width:    string;
}

const COLS: ColDef[] = [
  { key: "contact",     label: "Contacto",           width: "min-w-[220px]" },
  { key: "conn_status", label: "Conexión",            width: "min-w-[130px]" },
  { key: "company",     label: "Empresa",             width: "min-w-[140px]" },
  { key: "stage",       label: "Etapa CRM",           width: "min-w-[140px]" },
  { key: "automation",  label: "Automatización",      width: "min-w-[185px]" },
  { key: "campaign",    label: "Campaña / Segmento",  width: "min-w-[170px]" },
  { key: "email",       label: "Email",               width: "min-w-[170px]" },
  { key: "phone",       label: "Teléfono",            width: "min-w-[120px]" },
  { key: "score",       label: "Score",     sortable: "score",         width: "min-w-[80px]"  },
  { key: "value",       label: "Valor",     sortable: "value",         width: "min-w-[90px]"  },
  { key: "days",        label: "En etapa",  sortable: "days_in_stage", width: "min-w-[90px]"  },
  { key: "tags",        label: "Etiquetas",           width: "min-w-[150px]" },
  { key: "last_action", label: "Última acción",       width: "min-w-[140px]" },
  { key: "actions",     label: "",                    width: "w-10"          },
];

// -- Props ---------------------------------------------------------------------

interface LeadsListViewProps {
  leads:        CrmLead[];
  columns:      Column[];
  onLeadClick?: (lead: CrmLead) => void;
  sortBy?:      SortField;
  sortDir?:     "asc" | "desc";
  onSort?:      (field: SortField) => void;
}

// -- Componente ----------------------------------------------------------------

export function LeadsListView({
  leads, columns, onLeadClick, sortBy, sortDir, onSort,
}: LeadsListViewProps) {
  const colMap = Object.fromEntries(columns.map((c) => [c.key ?? c.id, c.title]));

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 text-zinc-300 ml-1" />;
    return sortDir === "asc"
      ? <ArrowUp   className="h-3 w-3 text-indigo-500 ml-1" />
      : <ArrowDown className="h-3 w-3 text-indigo-500 ml-1" />;
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
        <Users className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No se encontraron leads</p>
        <p className="text-xs mt-1">Intenta ajustar la búsqueda o los filtros</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px] text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/80">
              <th className="w-10 px-3 py-3">
                <input type="checkbox" className="rounded border-zinc-300" />
              </th>
              {COLS.map((col) => (
                <th
                  key={col.key}
                  className={[
                    col.width,
                    "px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-400",
                    col.sortable ? "cursor-pointer select-none hover:text-zinc-600" : "",
                  ].join(" ")}
                  onClick={() => col.sortable && onSort?.(col.sortable)}
                >
                  <div className="flex items-center">
                    {col.label}
                    {col.sortable && <SortIcon field={col.sortable} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-50">
            {leads.map((lead) => {
              const cs = CONN_STATUS[lead.connectionStatus ?? "none"];
              const ConnIcon = cs.Icon;
              const stageCls   = STAGE_CLS[lead.crmColumn ?? ""] ?? "bg-zinc-100 text-zinc-600";
              const stageLabel = colMap[lead.crmColumn ?? ""] ?? lead.crmColumn ?? "—";

              return (
                <tr
                  key={lead.id}
                  onClick={() => onLeadClick?.(lead)}
                  className="group cursor-pointer transition-colors hover:bg-indigo-50/30"
                >
                  {/* Checkbox */}
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-zinc-300" />
                  </td>

                  {/* Contacto */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      {lead.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={lead.avatarUrl}
                          alt={lead.name}
                          className="h-8 w-8 rounded-full object-cover ring-1 ring-zinc-200 flex-shrink-0"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center
                          rounded-full text-[11px] font-bold text-white ${avatarColor(lead.name)}`}>
                          {initials(lead.name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900 leading-tight">
                          {lead.name}
                        </p>
                        {lead.headline && (
                          <p className="truncate text-[10px] text-zinc-400 leading-tight mt-0.5 max-w-[180px]">
                            {lead.headline}
                          </p>
                        )}
                      </div>
                      {lead.linkedinUrl && (
                        <a
                          href={lead.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <ExternalLink className="h-3 w-3 text-zinc-400 hover:text-indigo-500" />
                        </a>
                      )}
                    </div>
                  </td>

                  {/* Estado de conexión */}
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5
                      text-[10px] font-medium ${cs.cls}`}>
                      <ConnIcon className="h-3 w-3 flex-shrink-0" />
                      {cs.label}
                    </span>
                  </td>

                  {/* Empresa */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5 text-zinc-700">
                      <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-zinc-300" />
                      <span className="truncate text-xs max-w-[120px]">
                        {lead.company !== "—" ? lead.company : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </span>
                    </div>
                  </td>

                  {/* Etapa CRM */}
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${stageCls}`}>
                      {stageLabel}
                    </span>
                  </td>

                  {/* Automatización */}
                  <td className="px-3 py-3">
                    {lead.automationStep ? (
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3 flex-shrink-0 text-indigo-400" />
                        <span className="truncate text-[10px] text-zinc-600 max-w-[160px]">
                          {lead.automationStep}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-300">Sin automatización</span>
                    )}
                  </td>

                  {/* Campaña / Segmento */}
                  <td className="px-3 py-3">
                    {lead.campaignName ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate text-[10px] font-medium text-zinc-700 max-w-[155px]">
                          {lead.campaignName}
                        </span>
                        {lead.segmentName && (
                          <span className="truncate text-[9px] text-zinc-400 max-w-[155px]">
                            {lead.segmentName}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-300">—</span>
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-3 py-3">
                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-[10px] text-zinc-600
                                   hover:text-indigo-600 transition-colors"
                      >
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate max-w-[145px]">{lead.email}</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-zinc-300">—</span>
                    )}
                  </td>

                  {/* Teléfono */}
                  <td className="px-3 py-3">
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-[10px] text-zinc-600
                                   hover:text-indigo-600 transition-colors"
                      >
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span>{lead.phone}</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-zinc-300">—</span>
                    )}
                  </td>

                  {/* Score */}
                  <td className="px-3 py-3">
                    {(lead.score ?? 0) > 0 ? (
                      <div className="flex items-center gap-1">
                        <Star className={`h-3 w-3 flex-shrink-0 ${
                          (lead.score ?? 0) >= 80 ? "text-amber-400" :
                          (lead.score ?? 0) >= 50 ? "text-zinc-400"  : "text-zinc-200"
                        }`} />
                        <span className={`text-xs font-bold ${
                          (lead.score ?? 0) >= 80 ? "text-amber-600" :
                          (lead.score ?? 0) >= 50 ? "text-zinc-600"  : "text-zinc-400"
                        }`}>{lead.score}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-300">—</span>
                    )}
                  </td>

                  {/* Valor */}
                  <td className="px-3 py-3">
                    <span className="text-xs font-bold text-zinc-900 tabular-nums">
                      {lead.value >= 1000
                        ? `$${(lead.value / 1000).toFixed(1)}K`
                        : lead.value > 0
                          ? `$${lead.value}`
                          : <span className="font-normal text-zinc-300">$0</span>}
                    </span>
                  </td>

                  {/* Días en etapa */}
                  <td className="px-3 py-3">
                    {(lead.daysInStage ?? 0) > 0 ? (
                      <div className="flex items-center gap-1">
                        <Clock className={`h-3 w-3 flex-shrink-0 ${
                          (lead.daysInStage ?? 0) > 7 ? "text-red-400"   :
                          (lead.daysInStage ?? 0) > 3 ? "text-amber-400" : "text-zinc-300"
                        }`} />
                        <span className={`text-[10px] font-medium tabular-nums ${
                          (lead.daysInStage ?? 0) > 7 ? "text-red-600"   :
                          (lead.daysInStage ?? 0) > 3 ? "text-amber-600" : "text-zinc-500"
                        }`}>{lead.daysInStage}d</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-300">Hoy</span>
                    )}
                  </td>

                  {/* Etiquetas */}
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[140px]">
                      {lead.tags.slice(0, 2).map((t) => (
                        <span
                          key={t.label}
                          className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${TAG_CLS[t.color] ?? TAG_CLS.gray}`}
                        >
                          {t.label}
                        </span>
                      ))}
                      {lead.tags.length > 2 && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] text-zinc-500">
                          +{lead.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Última acción */}
                  <td className="px-3 py-3">
                    {lead.nextPendingTask ? (
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-400 flex-shrink-0" />
                        <span className="text-[10px] font-medium text-amber-600 truncate max-w-[120px]">
                          {lead.nextPendingTask}
                        </span>
                      </div>
                    ) : lead.createdAt ? (
                      <div className="flex items-center gap-1 text-zinc-400">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span className="text-[10px]">{timeAgo(lead.createdAt)}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] italic text-zinc-300">Sin tareas</span>
                    )}
                  </td>

                  {/* Flecha hover */}
                  <td className="px-2 py-3">
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-300 opacity-0
                      group-hover:opacity-100 transition-opacity" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-2.5 flex items-center justify-between">
        <span className="text-[11px] text-zinc-400">
          {leads.length} contacto{leads.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[11px] text-zinc-400">
          Valor total:{" "}
          <span className="font-semibold text-zinc-700">
            ${leads.reduce((s, l) => s + l.value, 0).toLocaleString()}
          </span>
        </span>
      </div>
    </div>
  );
}
