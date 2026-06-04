"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import {
  CheckCircle2, ChevronDown, Columns3, Filter, LayoutList,
  Megaphone, Plus, Settings, TrendingUp, X, Zap,
} from "lucide-react";
import type { Column, CrmLead, LeadSource, ColumnColor } from "./types";
import { Board } from "./Board";
import { AutomationMatrix } from "./AutomationMatrix";
import { LeadsListView } from "./LeadsListView";
import { LeadModal } from "./LeadModal";
import { SettingsModal } from "./SettingsModal";
import { CreateLeadModal } from "./CreateLeadModal";
import { CampaignWizard } from "@/components/campaigns/CampaignWizard";
import type { WizardData, Template } from "@/components/campaigns/types";
import { archiveLead as dbArchiveLead, updateLeadStatus as dbUpdateLeadStatus, deleteLead as dbDeleteLead } from "@/app/dashboard/crm/actions";
import type {
  CrmLead as DbLead,
  CrmColumn as DbColumn,
  CrmAutomationFull,
} from "@/app/dashboard/crm/actions";

// ── Map DB → UI ───────────────────────────────────────────────────────────────

function mapDbLead(l: DbLead): CrmLead {
  return {
    id:          l.id,
    name:        l.full_name,
    company:     l.company ?? "—",
    value:       l.value ?? 0,
    source:      "LinkedIn" as LeadSource,
    tags:        (l.custom_tags ?? []).map((t) => ({ label: t, color: "blue" as const })),
    nextTask:    l.next_task ?? null,
    status:      l.status,
    crmColumn:   l.crm_column ?? l.status ?? null,
    createdAt:   l.created_at?.slice(0, 10) ?? "",
    email:       l.email ?? undefined,
    phone:       l.phone ?? undefined,
    linkedinUrl: l.linkedin_url ?? undefined,
    score:       l.score ?? 0,
  };
}

const VALID_COLORS: ColumnColor[] = [
  "blue", "sky", "violet", "amber", "green", "red", "pink", "orange", "indigo", "purple",
];

function mapDbColumn(c: DbColumn): Column {
  const color: ColumnColor = VALID_COLORS.includes(c.color as ColumnColor)
    ? (c.color as ColumnColor)
    : "blue";
  return { id: c.id, title: c.title, color, key: c.key };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type View = "kanban" | "list" | "automations" | "forecast";

interface CrmViewProps {
  initialLeads: DbLead[];
  initialColumns: DbColumn[];
  initialAutomations: CrmAutomationFull[];
}

const SOURCES: LeadSource[] = ["LinkedIn", "Web", "Referido", "Email", "Llamada"];

// ── Component ─────────────────────────────────────────────────────────────────

export function CrmView({ initialLeads, initialColumns, initialAutomations }: CrmViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [leads,       setLeads]       = useState<CrmLead[]>(() => initialLeads.map(mapDbLead));
  const [columns,     setColumns]     = useState<Column[]>(() => initialColumns.map(mapDbColumn));
  const [automations]                 = useState<CrmAutomationFull[]>(initialAutomations);
  const [crmError,    setCrmError]    = useState("");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("crm-leads")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        (payload) => {
          const updated = payload.new as DbLead;
          setLeads((prev) =>
            prev.map((l) =>
              l.id === updated.id
                ? {
                    ...l,
                    name:        updated.full_name    ?? l.name,
                    company:     updated.company      ?? l.company,
                    linkedinUrl: updated.linkedin_url ?? l.linkedinUrl,
                    nextTask:    updated.next_task    !== undefined ? updated.next_task : l.nextTask,
                  }
                : l
            )
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const [view,              setView]              = useState<View>("kanban");
  const [selectedLead,      setSelectedLead]      = useState<CrmLead | null>(null);
  const [settingsOpen,      setSettingsOpen]      = useState(false);
  const [wizardOpen,        setWizardOpen]        = useState(false);
  const [createLeadOpen,    setCreateLeadOpen]    = useState(false);
  const [campaignSuccess,   setCampaignSuccess]   = useState<string | null>(null);

  // Filters
  const [filterSource,    setFilterSource]    = useState<LeadSource | "all">("all");
  const [filterTag,       setFilterTag]       = useState<string>("all");
  const [filterMinValue,  setFilterMinValue]  = useState<string>("");
  const [filterMaxValue,  setFilterMaxValue]  = useState<string>("");
  const [filterOpen,      setFilterOpen]      = useState(false);

  const filteredLeads = useMemo(() => leads.filter((l) => {
    if (filterSource !== "all" && l.source !== filterSource) return false;
    if (filterTag !== "all" && !l.tags.some((t) => t.label === filterTag)) return false;
    if (filterMinValue && l.value < parseInt(filterMinValue)) return false;
    if (filterMaxValue && l.value > parseInt(filterMaxValue)) return false;
    return true;
  }), [leads, filterSource, filterTag, filterMinValue, filterMaxValue]);

  const hasFilters = filterSource !== "all" || filterTag !== "all" || !!filterMinValue || !!filterMaxValue;
  const allTags    = Array.from(new Set(leads.flatMap((l) => l.tags.map((t) => t.label))));
  const totalValue = filteredLeads.reduce((s, l) => s + l.value, 0);
  const isAuto     = view === "automations";

  function fmtUSD(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  }

  function handleWizardComplete(data: WizardData, _template: Template | null) {
    setCampaignSuccess(data.campaignName);
    setWizardOpen(false);
    setTimeout(() => {
      setCampaignSuccess(null);
      router.push("/dashboard/campanas");
    }, 2000);
  }

  // ── Board: drag lead between columns ────────────────────────────────────────

  function handleLeadsChange(updated: CrmLead[]) {
    // Find which leads changed status compared to current state
    const prev = new Map(leads.map((l) => [l.id, l.status]));
    updated.forEach((l) => {
      if (prev.get(l.id) !== l.status) {
        startTransition(async () => {
          const res = await dbUpdateLeadStatus(l.id, l.status);
          if (!res.success) setCrmError(res.error ?? "Error al mover lead");
        });
      }
    });
    setLeads(updated);
  }

  // ── Create lead ──────────────────────────────────────────────────────────────

  function handleCreate(lead: CrmLead) {
    // Modal already persisted to DB — just add to local state
    setLeads((prev) => [lead, ...prev]);
  }

  // ── Delete lead ──────────────────────────────────────────────────────────────

  function handleLeadDelete(lead: CrmLead) {
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    startTransition(async () => {
      const res = await dbDeleteLead(lead.id);
      if (!res.success) {
        setLeads((prev) => [lead, ...prev]); // revert
        setCrmError(res.error ?? "Error al eliminar lead");
      }
    });
  }

  // ── Archive lead ─────────────────────────────────────────────────────────────

  function handleLeadArchive(leadId: string) {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    startTransition(async () => {
      const res = await dbArchiveLead(leadId);
      if (!res.success) {
        router.refresh(); // revert via server data
        setCrmError(res.error ?? "Error al archivar lead");
      }
    });
  }

  // ── Lead modal stage change ───────────────────────────────────────────────────

  function handleStageChange(leadId: string, newStatus: string) {
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: newStatus } : l));
    startTransition(async () => {
      const res = await dbUpdateLeadStatus(leadId, newStatus);
      if (!res.success) setCrmError(res.error ?? "Error al actualizar estado");
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {crmError && (
        <div className="flex flex-shrink-0 items-center gap-3 bg-red-500 px-5 py-2 text-white text-sm">
          <span className="flex-1">{crmError}</span>
          <button onClick={() => setCrmError("")}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ── Campaign success banner ───────────────────────────────────── */}
      {campaignSuccess && (
        <div className="flex flex-shrink-0 items-center gap-3 bg-green-500 px-5 py-2.5 text-white">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm font-medium">
            Campaña <strong>&ldquo;{campaignSuccess}&rdquo;</strong> creada — redirigiendo al Flow Builder…
          </p>
          <button onClick={() => setCampaignSuccess(null)} className="ml-auto opacity-80 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-border bg-white px-5 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">Pipeline CRM</p>
          <p className="text-[11px] text-zinc-500 tabular-nums">
            {filteredLeads.length}/{leads.length} lead{leads.length !== 1 ? "s" : ""}
            &nbsp;·&nbsp;{fmtUSD(totalValue)} en pipeline
            {hasFilters && <span className="ml-1 text-indigo-500 font-medium">(filtrado)</span>}
            {isPending && <span className="ml-1 text-zinc-400">· guardando…</span>}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Filtros */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={[
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                hasFilters
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
              ].join(" ")}
            >
              <Filter className="h-3.5 w-3.5" />
              Filtros
              {hasFilters && <span className="rounded-full bg-indigo-600 px-1.5 text-[9px] font-bold text-white">ON</span>}
              <ChevronDown className={`h-3 w-3 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Filtrar leads</p>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-600">Fuente</label>
                    <select value={filterSource} onChange={(e) => setFilterSource(e.target.value as LeadSource | "all")}
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-xs focus:border-indigo-400 focus:outline-none">
                      <option value="all">Todas las fuentes</option>
                      {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-600">Etiqueta</label>
                    <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-xs focus:border-indigo-400 focus:outline-none">
                      <option value="all">Todas las etiquetas</option>
                      {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-600">Valor mín. ($)</label>
                      <input type="number" value={filterMinValue} onChange={(e) => setFilterMinValue(e.target.value)}
                        placeholder="0" className="w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-xs focus:border-indigo-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-600">Valor máx. ($)</label>
                      <input type="number" value={filterMaxValue} onChange={(e) => setFilterMaxValue(e.target.value)}
                        placeholder="∞" className="w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-xs focus:border-indigo-400 focus:outline-none" />
                    </div>
                  </div>
                  {hasFilters && (
                    <button onClick={() => { setFilterSource("all"); setFilterTag("all"); setFilterMinValue(""); setFilterMaxValue(""); }}
                      className="w-full rounded-lg border border-zinc-200 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-50">
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <button onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50">
            <Settings className="h-3.5 w-3.5" />
            Columnas
          </button>

          <button onClick={() => setView(view === "forecast" ? "kanban" : "forecast")}
            className={["flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              view === "forecast" ? "border-green-300 bg-green-50 text-green-700" : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
            ].join(" ")}>
            <TrendingUp className="h-3.5 w-3.5" />
            Forecast
          </button>

          <button onClick={() => setWizardOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-700">
            <Megaphone className="h-3.5 w-3.5" />
            Campaña
          </button>

          <button onClick={() => setCreateLeadOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" />
            Nuevo lead
          </button>

          <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white p-1">
            {(["kanban", "list"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={["flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === v ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-800",
                ].join(" ")}>
                {v === "kanban" ? <Columns3 className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
                {v === "kanban" ? "Kanban" : "Lista"}
              </button>
            ))}
          </div>

          <button onClick={() => setView(isAuto ? "kanban" : "automations")}
            className={["flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              isAuto
                ? "bg-amber-500 text-white shadow-md shadow-amber-200"
                : "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md shadow-amber-200 hover:from-amber-500 hover:to-orange-600",
            ].join(" ")}>
            <Zap className="h-3.5 w-3.5" />
            {isAuto ? "← Pipeline" : "⚡ AUTOMATIZA"}
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className={["flex flex-1 min-h-0 overflow-hidden",
        view === "list" || view === "forecast" ? "overflow-y-auto px-5 pt-4" : "px-5 pt-4",
      ].join(" ")}>

        {view === "kanban" && (
          <Board
            leads={filteredLeads}
            columns={columns}
            onLeadsChange={handleLeadsChange}
            onColumnsChange={setColumns}
            onLeadClick={setSelectedLead}
            onLeadDelete={handleLeadDelete}
            onLeadArchive={handleLeadArchive}
          />
        )}

        {view === "list" && (
          <div className="flex-1">
            <LeadsListView leads={filteredLeads} columns={columns} onLeadClick={setSelectedLead} />
          </div>
        )}

        {view === "automations" && (
          <AutomationMatrix
            columns={columns}
            initialAutomations={automations}
          />
        )}

        {view === "forecast" && (
          <div className="flex-1 space-y-4 pb-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {columns.map((col) => {
                const colLeads = filteredLeads.filter((l) => l.status === col.id);
                const colValue = colLeads.reduce((s, l) => s + l.value, 0);
                const probability: Record<string, number> = {
                  leads_entrantes: 10, en_contacto: 25, demo_agendada: 50,
                  propuesta: 70, cerrado: 100, perdido: 0,
                };
                const prob     = probability[col.id] ?? 30;
                const weighted = Math.round((colValue * prob) / 100);
                return (
                  <div key={col.id} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-zinc-700 truncate">{col.title}</p>
                      <span className="text-[11px] font-medium text-zinc-400">{prob}% prob.</span>
                    </div>
                    <p className="text-2xl font-black tabular-nums text-zinc-900">
                      {colValue >= 1000 ? `$${(colValue / 1000).toFixed(0)}K` : `$${colValue}`}
                    </p>
                    <p className="text-[11px] text-zinc-400">{colLeads.length} leads</p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-400" style={{ width: `${prob}%` }} />
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-indigo-600">
                      ≈ {weighted >= 1000 ? `$${(weighted / 1000).toFixed(0)}K` : `$${weighted}`} ponderado
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
              <p className="text-sm font-bold text-green-800">Pipeline total ponderado</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-green-700">
                {(() => {
                  const probability: Record<string, number> = {
                    leads_entrantes: 10, en_contacto: 25, demo_agendada: 50,
                    propuesta: 70, cerrado: 100, perdido: 0,
                  };
                  const total = filteredLeads.reduce((s, l) => {
                    const p = probability[l.status] ?? 30;
                    return s + Math.round((l.value * p) / 100);
                  }, 0);
                  return total >= 1000 ? `$${(total / 1000).toFixed(1)}K` : `$${total}`;
                })()}
              </p>
              <p className="mt-1 text-xs text-green-600">Valor esperado ponderado por probabilidad de cierre</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Lead Modal ───────────────────────────────────────────────── */}
      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStageChange={handleStageChange}
          onDeleted={(id) => { setLeads((prev) => prev.filter((l) => l.id !== id)); setSelectedLead(null); }}
          onArchived={(id) => { handleLeadArchive(id); setSelectedLead(null); }}
        />
      )}

      {/* ── Settings Modal ───────────────────────────────────────────── */}
      {settingsOpen && (
        <SettingsModal leads={leads} onClose={() => setSettingsOpen(false)} />
      )}

      {/* ── Campaign Wizard ──────────────────────────────────────────── */}
      {wizardOpen && (
        <CampaignWizard
          onComplete={handleWizardComplete}
          onClose={() => setWizardOpen(false)}
        />
      )}

      {/* ── Create Lead Modal ────────────────────────────────────────── */}
      {createLeadOpen && (
        <CreateLeadModal
          columns={columns}
          onClose={() => setCreateLeadOpen(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
