"use client";

import {
  ArrowDown, ArrowUp, ArrowUpDown,
  Building2, Calendar, ChevronRight, CheckCircle2, Circle, Clock,
  Clock3, ExternalLink, Mail, MessageSquare, Phone, Star,
  UserCheck, Users, Zap,
} from "lucide-react";
import type { CrmLead, Column, TagColor } from "./types";

// -- Tag colors ----------------------------------------------------------------

const TAG_CLS: Record<TagColor, string> = {
  blue:   "bg-[rgba(59,130,246,0.12)]  text-blue-400   border border-[rgba(59,130,246,0.2)]",
  violet: "bg-[rgba(139,92,246,0.12)]  text-violet-400 border border-[rgba(139,92,246,0.2)]",
  green:  "bg-[rgba(16,185,129,0.12)]  text-emerald-400 border border-[rgba(16,185,129,0.2)]",
  amber:  "bg-[rgba(245,158,11,0.12)]  text-amber-400  border border-[rgba(245,158,11,0.2)]",
  red:    "bg-[rgba(239,68,68,0.12)]   text-red-400    border border-[rgba(239,68,68,0.2)]",
  pink:   "bg-[rgba(236,72,153,0.12)]  text-pink-400   border border-[rgba(236,72,153,0.2)]",
  sky:    "bg-[rgba(14,165,233,0.12)]  text-sky-400    border border-[rgba(14,165,233,0.2)]",
  gray:   "bg-[var(--surface-hover)]   text-[var(--foreground-muted)] border border-[var(--border)]",
  indigo: "bg-[rgba(99,102,241,0.12)]  text-indigo-400 border border-[rgba(99,102,241,0.2)]",
};

const CONN_STATUS = {
  none:            { label: "Sin contactar", cls: "bg-[var(--surface-hover)] text-[var(--foreground-faint)]",           Icon: Circle        },
  pending:         { label: "Inv. enviada",  cls: "bg-[rgba(59,130,246,0.12)] text-blue-400",                           Icon: Clock3        },
  connected:       { label: "Conectado",     cls: "bg-[rgba(139,92,246,0.12)] text-violet-400",                         Icon: UserCheck     },
  in_conversation: { label: "Conversando",   cls: "bg-[rgba(245,158,11,0.12)] text-amber-400",                          Icon: MessageSquare },
  meeting:         { label: "Reunión",       cls: "bg-[rgba(16,185,129,0.12)] text-emerald-400",                        Icon: CheckCircle2  },
} as const;

const STAGE_CLS: Record<string, string> = {
  extraido:          "bg-[rgba(59,130,246,0.12)]  text-blue-400",
  conexion_enviada:  "bg-[rgba(99,102,241,0.12)]  text-indigo-400",
  conexion_aceptada: "bg-[rgba(139,92,246,0.12)]  text-violet-400",
  en_conversacion:   "bg-[rgba(245,158,11,0.12)]  text-amber-400",
  reunion_agendada:  "bg-[rgba(249,115,22,0.12)]  text-orange-400",
  cliente:           "bg-[rgba(16,185,129,0.12)]  text-emerald-400",
};

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

// -- Column definitions -------------------------------------------------------

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

// -- Props --------------------------------------------------------------------

interface LeadsListViewProps {
  leads:            CrmLead[];
  columns:          Column[];
  onLeadClick?:     (lead: CrmLead) => void;
  sortBy?:          SortField;
  sortDir?:         "asc" | "desc";
  onSort?:          (field: SortField) => void;
  selectedIds?:     Set<string>;
  onToggleSelect?:  (id: string) => void;
  onToggleAll?:     (ids: string[]) => void;
}

// -- Component ----------------------------------------------------------------

export function LeadsListView({
  leads, columns, onLeadClick, sortBy, sortDir, onSort,
  selectedIds, onToggleSelect, onToggleAll,
}: LeadsListViewProps) {
  const colMap = Object.fromEntries(columns.map((c) => [c.key ?? c.id, c.title]));

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-[var(--foreground-faint)]" />;
    return sortDir === "asc"
      ? <ArrowUp   className="ml-1 h-3 w-3 text-[var(--primary)]" />
      : <ArrowDown className="ml-1 h-3 w-3 text-[var(--primary)]" />;
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--foreground-faint)]">
        <Users className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">No se encontraron leads</p>
        <p className="mt-1 text-xs">Intenta ajustar la búsqueda o los filtros</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-hover)]">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  className="rounded border-[var(--border)] bg-[var(--surface-hover)]"
                  checked={selectedIds ? leads.length > 0 && leads.every((l) => selectedIds.has(l.id)) : false}
                  onChange={() => onToggleAll?.(leads.map((l) => l.id))}
                />
              </th>
              {COLS.map((col) => (
                <th
                  key={col.key}
                  className={[
                    col.width,
                    "px-3 py-3 text-left text-[11px] font-semibold uppercase",
                    "tracking-wider text-[var(--foreground-faint)]",
                    col.sortable
                      ? "cursor-pointer select-none hover:text-[var(--foreground-muted)] transition-colors"
                      : "",
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

          <tbody className="divide-y divide-[var(--border)]">
            {leads.map((lead) => {
              const cs = CONN_STATUS[lead.connectionStatus ?? "none"];
              const ConnIcon = cs.Icon;
              const stageCls   = STAGE_CLS[lead.crmColumn ?? ""] ?? "bg-[var(--surface-hover)] text-[var(--foreground-muted)]";
              const stageLabel = colMap[lead.crmColumn ?? ""] ?? lead.crmColumn ?? "—";

              return (
                <tr
                  key={lead.id}
                  onClick={() => onLeadClick?.(lead)}
                  className="group cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
                >
                  {/* Checkbox */}
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-[var(--border)] bg-[var(--surface-hover)]"
                      checked={selectedIds?.has(lead.id) ?? false}
                      onChange={() => onToggleSelect?.(lead.id)}
                    />
                  </td>

                  {/* Contacto */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      {lead.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={lead.avatarUrl}
                          alt={lead.name}
                          className="h-8 w-8 flex-shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center
                                     rounded-full text-[11px] font-bold text-white"
                          style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
                        >
                          {initials(lead.name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight text-[var(--foreground)]">
                          {lead.name}
                        </p>
                        {lead.headline && (
                          <p className="mt-0.5 max-w-[180px] truncate text-[10px]
                                        leading-tight text-[var(--foreground-faint)]">
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
                          className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <ExternalLink className="h-3 w-3 text-[var(--foreground-faint)]
                                                   hover:text-[var(--primary)]" />
                        </a>
                      )}
                    </div>
                  </td>

                  {/* Conexión */}
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5
                                      text-[10px] font-medium ${cs.cls}`}>
                      <ConnIcon className="h-3 w-3 flex-shrink-0" />
                      {cs.label}
                    </span>
                  </td>

                  {/* Empresa */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5 text-[var(--foreground-muted)]">
                      <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-[var(--foreground-faint)]" />
                      <span className="max-w-[120px] truncate text-xs">
                        {lead.company !== "—" ? lead.company : (
                          <span className="text-[var(--foreground-faint)]">—</span>
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
                        <Zap className="h-3 w-3 flex-shrink-0 text-[var(--primary)]" />
                        <span className="max-w-[160px] truncate text-[10px] text-[var(--foreground-muted)]">
                          {lead.automationStep}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[var(--foreground-faint)]">Sin automatización</span>
                    )}
                  </td>

                  {/* Campaña */}
                  <td className="px-3 py-3">
                    {lead.campaignName ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="max-w-[155px] truncate text-[10px] font-medium
                                         text-[var(--foreground-muted)]">
                          {lead.campaignName}
                        </span>
                        {lead.segmentName && (
                          <span className="max-w-[155px] truncate text-[9px] text-[var(--foreground-faint)]">
                            {lead.segmentName}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-[var(--foreground-faint)]">—</span>
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-3 py-3">
                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]
                                   transition-colors hover:text-[var(--primary)]"
                      >
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="max-w-[145px] truncate">{lead.email}</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-[var(--foreground-faint)]">—</span>
                    )}
                  </td>

                  {/* Teléfono */}
                  <td className="px-3 py-3">
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]
                                   transition-colors hover:text-[var(--primary)]"
                      >
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span>{lead.phone}</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-[var(--foreground-faint)]">—</span>
                    )}
                  </td>

                  {/* Score */}
                  <td className="px-3 py-3">
                    {(lead.score ?? 0) > 0 ? (
                      <div className="flex items-center gap-1">
                        <Star className={`h-3 w-3 flex-shrink-0 ${
                          (lead.score ?? 0) >= 80 ? "text-[var(--warning)]" :
                          (lead.score ?? 0) >= 50 ? "text-[var(--foreground-faint)]" :
                                                    "text-[var(--foreground-faint)] opacity-40"
                        }`} />
                        <span className={`text-xs font-bold ${
                          (lead.score ?? 0) >= 80 ? "text-[var(--warning)]" :
                          (lead.score ?? 0) >= 50 ? "text-[var(--foreground-muted)]" :
                                                    "text-[var(--foreground-faint)]"
                        }`}>{lead.score}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[var(--foreground-faint)]">—</span>
                    )}
                  </td>

                  {/* Valor */}
                  <td className="px-3 py-3">
                    <span className="text-xs font-bold tabular-nums text-[var(--foreground)]">
                      {lead.value >= 1000
                        ? `$${(lead.value / 1000).toFixed(1)}K`
                        : lead.value > 0
                          ? `$${lead.value}`
                          : <span className="font-normal text-[var(--foreground-faint)]">$0</span>}
                    </span>
                  </td>

                  {/* Días en etapa */}
                  <td className="px-3 py-3">
                    {(lead.daysInStage ?? 0) > 0 ? (
                      <div className="flex items-center gap-1">
                        <Clock className={`h-3 w-3 flex-shrink-0 ${
                          (lead.daysInStage ?? 0) > 7 ? "text-[var(--danger)]"  :
                          (lead.daysInStage ?? 0) > 3 ? "text-[var(--warning)]" :
                                                        "text-[var(--foreground-faint)]"
                        }`} />
                        <span className={`text-[10px] font-medium tabular-nums ${
                          (lead.daysInStage ?? 0) > 7 ? "text-[var(--danger)]"  :
                          (lead.daysInStage ?? 0) > 3 ? "text-[var(--warning)]" :
                                                        "text-[var(--foreground-faint)]"
                        }`}>{lead.daysInStage}d</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[var(--foreground-faint)]">Hoy</span>
                    )}
                  </td>

                  {/* Etiquetas */}
                  <td className="px-3 py-3">
                    <div className="flex max-w-[140px] flex-wrap gap-1">
                      {lead.tags.slice(0, 2).map((t) => (
                        <span
                          key={t.label}
                          className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${TAG_CLS[t.color] ?? TAG_CLS.gray}`}
                        >
                          {t.label}
                        </span>
                      ))}
                      {lead.tags.length > 2 && (
                        <span className="rounded-full border border-[var(--border)]
                                         bg-[var(--surface-hover)] px-2 py-0.5 text-[9px]
                                         text-[var(--foreground-faint)]">
                          +{lead.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Última acción */}
                  <td className="px-3 py-3">
                    {lead.nextPendingTask ? (
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3 flex-shrink-0 text-[var(--warning)]" />
                        <span className="max-w-[120px] truncate text-[10px] font-medium text-[var(--warning)]">
                          {lead.nextPendingTask}
                        </span>
                      </div>
                    ) : lead.createdAt ? (
                      <div className="flex items-center gap-1 text-[var(--foreground-faint)]">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span className="text-[10px]">{timeAgo(lead.createdAt)}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] italic text-[var(--foreground-faint)]">Sin tareas</span>
                    )}
                  </td>

                  {/* Flecha hover */}
                  <td className="px-2 py-3">
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--foreground-faint)] opacity-0
                                             transition-opacity group-hover:opacity-100" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[var(--border)]
                      bg-[var(--surface-hover)] px-4 py-2.5">
        <span className="text-[11px] text-[var(--foreground-faint)]">
          {leads.length} contacto{leads.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[11px] text-[var(--foreground-faint)]">
          Valor total:{" "}
          <span className="font-semibold text-[var(--foreground-muted)]">
            ${leads.reduce((s, l) => s + l.value, 0).toLocaleString()}
          </span>
        </span>
      </div>
    </div>
  );
}
