"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import {
  AtSign, CheckCircle2, ChevronDown, Columns3, Filter, LayoutList,
  Megaphone, Phone, Plus, Search, Settings, TrendingUp, X, Zap,
} from "lucide-react";
import type { Column, CrmLead, LeadSource, ColumnColor } from "./types";
import { Board } from "./Board";
import { AutomationMatrix } from "./AutomationMatrix";
import { LeadsListView } from "./LeadsListView";
import { LeadModal } from "./LeadModal";
import { LeadDetailPanel } from "./LeadDetailPanel";
import { SettingsModal } from "./SettingsModal";
import { CreateLeadModal } from "./CreateLeadModal";
import { CampaignWizard } from "@/components/campaigns/CampaignWizard";
import type { WizardData, Template } from "@/components/campaigns/types";
import { archiveLead as dbArchiveLead, updateLeadStatus as dbUpdateLeadStatus, deleteLead as dbDeleteLead, enqueueEnrichment } from "@/app/dashboard/crm/actions";
import type {
  CrmLead as DbLead,
  CrmColumn as DbColumn,
  CrmAutomationFull,
} from "@/app/dashboard/crm/actions";

// -- Limpiar nombres con texto de actividad de LinkedIn ------------------------

function cleanLinkedInName(raw: string | null | undefined): string {
  if (!raw) return "Sin nombre";
  const patterns = [
    /^la (?:última|ultima) conexión de (.+?) fue .+$/i,
    /^(.+?) está disponible$/i,
    /^(.+?) estuvo activo.+$/i,
    /^(.+?) responded.+$/i,
    /^(.+?) recently.+$/i,
    /^(.+?) ha (?:compartido|publicado|comentado).+$/i,
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m?.[1]) return m[1].trim();
  }
  if (raw.split(" ").length > 5 && (raw.includes(" fue ") || raw.includes(" está "))) {
    return raw.split(" ").slice(0, 3).join(" ");
  }
  return raw;
}

// -- Map DB → UI ---------------------------------------------------------------

function mapDbLead(l: DbLead): CrmLead {
  const col = l.crm_column;
  const connectionStatus = ((): CrmLead["connectionStatus"] => {
    if (col === "cliente" || col === "reunion_agendada") return "meeting";
    if (col === "en_conversacion")   return "in_conversation";
    if (col === "conexion_aceptada") return "connected";
    if (col === "conexion_enviada")  return "pending";
    return "none";
  })();

  return {
    id:               l.id,
    name:             cleanLinkedInName(l.full_name),
    company:          l.company ?? "—",
    value:            l.value ?? 0,
    source:           "LinkedIn" as LeadSource,
    tags:             (l.custom_tags ?? []).map((t) => ({ label: t, color: "blue" as const })),
    nextTask:         l.next_task ?? null,
    status:           l.status,
    crmColumn:        col ?? l.status ?? null,
    createdAt:        l.created_at?.slice(0, 10) ?? "",
    email:            l.email ?? undefined,
    phone:            l.phone ?? undefined,
    linkedinUrl:      l.linkedin_url ?? undefined,
    score:            l.score ?? 0,
    avatarUrl:        l.avatar_url ?? undefined,
    headline:         l.headline ?? undefined,
    daysInStage:      l.days_in_stage ?? 0,
    nextPendingTask:  l.next_pending_task ?? null,
    campaignName:     l.campaign_name ?? undefined,
    segmentName:      l.segment_name  ?? undefined,
    automationStep:   l.automation_step ?? undefined,
    connectionNote:   l.connection_note ?? undefined,
    location:         l.location ?? undefined,
    connectionStatus,
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

// -- Types ---------------------------------------------------------------------

type View = "kanban" | "list" | "automations" | "forecast";

interface CrmViewProps {
  initialLeads: DbLead[];
  initialColumns: DbColumn[];
  initialAutomations: CrmAutomationFull[];
  workspaceId: string;
}

const SOURCES: LeadSource[] = ["LinkedIn", "Web", "Referido", "Email", "Llamada"];

// -- Component -----------------------------------------------------------------

export function CrmView({ initialLeads, initialColumns, initialAutomations, workspaceId }: CrmViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [leads,       setLeads]       = useState<CrmLead[]>(() => initialLeads.map(mapDbLead));
  const [columns,     setColumns]     = useState<Column[]>(() => initialColumns.map(mapDbColumn));
  const [automations]                 = useState<CrmAutomationFull[]>(initialAutomations);
  const [crmError,    setCrmError]    = useState("");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("crm-leads-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads", filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLeads((prev) => [mapDbLead(payload.new as DbLead), ...prev]);
          }
          if (payload.eventType === "UPDATE") {
            setLeads((prev) =>
              prev.map((l) =>
                l.id === payload.new.id ? mapDbLead(payload.new as DbLead) : l
              )
            );
          }
          if (payload.eventType === "DELETE") {
            setLeads((prev) => prev.filter((l) => l.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  const [view,              setView]              = useState<View>("kanban");
  const [selectedIds,       setSelectedIds]       = useState<Set<string>>(new Set());
  const [bulkStatus,        setBulkStatus]        = useState<"idle" | "running" | "done">("idle");
  const [selectedLead,      setSelectedLead]      = useState<CrmLead | null>(null);
  const [selectedLeadId,    setSelectedLeadId]    = useState<string | null>(null);
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
  // List-view extra filters
  const [searchQuery,     setSearchQuery]     = useState("");
  const [filterStage,     setFilterStage]     = useState("all");
  const [filterCampaign,  setFilterCampaign]  = useState("all");
  const [sortBy,          setSortBy]          = useState<"created_at" | "value" | "score" | "days_in_stage">("created_at");
  const [sortDir,         setSortDir]         = useState<"asc" | "desc">("desc");

  const filteredLeads = useMemo(() => {
    let result = leads.filter((l) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          l.name?.toLowerCase().includes(q) ||
          l.company?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.phone?.includes(q) ||
          l.campaignName?.toLowerCase().includes(q) ||
          l.segmentName?.toLowerCase().includes(q) ||
          l.headline?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (filterSource !== "all" && l.source !== filterSource) return false;
      if (filterTag !== "all" && !l.tags.some((t) => t.label === filterTag)) return false;
      if (filterStage !== "all" && l.crmColumn !== filterStage) return false;
      if (filterCampaign !== "all" && l.campaignName !== filterCampaign) return false;
      if (filterMinValue && l.value < parseInt(filterMinValue)) return false;
      if (filterMaxValue && l.value > parseInt(filterMaxValue)) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (sortBy === "value")         { va = a.value;           vb = b.value; }
      if (sortBy === "score")         { va = a.score ?? 0;      vb = b.score ?? 0; }
      if (sortBy === "days_in_stage") { va = a.daysInStage ?? 0; vb = b.daysInStage ?? 0; }
      if (sortBy === "created_at")    { va = a.createdAt;       vb = b.createdAt; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [leads, searchQuery, filterSource, filterTag, filterStage, filterCampaign,
      filterMinValue, filterMaxValue, sortBy, sortDir]);

  const hasFilters = filterSource !== "all" || filterTag !== "all" || !!filterMinValue || !!filterMaxValue;
  const allTags       = Array.from(new Set(leads.flatMap((l) => l.tags.map((t) => t.label))));
  const allCampaigns  = Array.from(new Set(leads.map((l) => l.campaignName).filter((c): c is string => !!c)));
  const totalValue = filteredLeads.reduce((s, l) => s + l.value, 0);
  const isAuto     = view === "automations";

  function fmtUSD(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  }

  async function handleWizardComplete(data: WizardData, _template: Template | null) {
    setCampaignSuccess(data.campaignName);
    setWizardOpen(false);
    setTimeout(() => {
      setCampaignSuccess(null);
      router.push("/dashboard/campanas");
    }, 2000);
  }

  // -- Board: drag lead between columns ----------------------------------------

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

  // -- Create lead --------------------------------------------------------------

  function handleCreate(lead: CrmLead) {
    // Modal already persisted to DB — just add to local state
    setLeads((prev) => [lead, ...prev]);
  }

  // -- Delete lead --------------------------------------------------------------

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

  // -- Archive lead -------------------------------------------------------------

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

  // -- Bulk enrichment ----------------------------------------------------------

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleToggleAll(ids: string[]) {
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(ids);
    });
  }

  async function handleBulkEnrich(type: "find_email" | "find_phone") {
    if (!selectedIds.size) return;
    setBulkStatus("running");
    const targets = filteredLeads.filter((l) =>
      selectedIds.has(l.id) &&
      l.linkedinUrl &&
      (type === "find_email" ? !l.email : !l.phone)
    );
    await Promise.all(
      targets.map((l) => enqueueEnrichment(l.id, type, l.linkedinUrl!).catch(() => {}))
    );
    setBulkStatus("done");
    setSelectedIds(new Set());
    setTimeout(() => setBulkStatus("idle"), 3000);
  }

  // -- Lead modal stage change ---------------------------------------------------

  function handleStageChange(leadId: string, newStatus: string) {
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: newStatus } : l));
    startTransition(async () => {
      const res = await dbUpdateLeadStatus(leadId, newStatus);
      if (!res.success) setCrmError(res.error ?? "Error al actualizar estado");
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">

      {/* -- Error banner ----------------------------------------------- */}
      {crmError && (
        <div className="flex flex-shrink-0 items-center gap-3 bg-red-500 px-5 py-2 text-white text-sm">
          <span className="flex-1">{crmError}</span>
          <button onClick={() => setCrmError("")}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* -- Campaign success banner ------------------------------------- */}
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

      {/* -- Toolbar ---------------------------------------------------- */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">Pipeline CRM</p>
          <p className="text-[11px] text-[var(--foreground-muted)] tabular-nums">
            {filteredLeads.length}/{leads.length} lead{leads.length !== 1 ? "s" : ""}
            &nbsp;·&nbsp;{fmtUSD(totalValue)} en pipeline
            {hasFilters && <span className="ml-1 text-indigo-500 font-medium">(filtrado)</span>}
            {isPending && <span className="ml-1 text-[var(--foreground-muted)]">· guardando…</span>}
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
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground-muted)] hover:border-[rgba(37,99,235,0.4)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              <Filter className="h-3.5 w-3.5" />
              Filtros
              {hasFilters && <span className="rounded-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-1.5 text-[9px] font-bold text-white">ON</span>}
              <ChevronDown className={`h-3 w-3 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--foreground-muted)]">Filtrar leads</p>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--foreground)]">Fuente</label>
                    <select value={filterSource} onChange={(e) => setFilterSource(e.target.value as LeadSource | "all")}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-2.5 py-2 text-xs focus:border-[#2563EB] focus:outline-none">
                      <option value="all">Todas las fuentes</option>
                      {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--foreground)]">Etiqueta</label>
                    <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-2.5 py-2 text-xs focus:border-[#2563EB] focus:outline-none">
                      <option value="all">Todas las etiquetas</option>
                      {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--foreground)]">Valor mín. ($)</label>
                      <input type="number" value={filterMinValue} onChange={(e) => setFilterMinValue(e.target.value)}
                        placeholder="0" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] px-2.5 py-2 text-xs focus:border-[#2563EB] focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--foreground)]">Valor máx. ($)</label>
                      <input type="number" value={filterMaxValue} onChange={(e) => setFilterMaxValue(e.target.value)}
                        placeholder="∞" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] px-2.5 py-2 text-xs focus:border-[#2563EB] focus:outline-none" />
                    </div>
                  </div>
                  {hasFilters && (
                    <button onClick={() => { setFilterSource("all"); setFilterTag("all"); setFilterMinValue(""); setFilterMaxValue(""); }}
                      className="w-full rounded-lg border border-[var(--border)] py-2 text-xs font-semibold text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.05)]">
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <button onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground-muted)] transition-colors hover:border-[rgba(37,99,235,0.4)] hover:text-[var(--foreground)]">
            <Settings className="h-3.5 w-3.5" />
            Columnas
          </button>

          <button onClick={() => setView(view === "forecast" ? "kanban" : "forecast")}
            className={["flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              view === "forecast" ? "border-green-300 bg-green-50 text-green-700" : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground-muted)] hover:border-[rgba(37,99,235,0.4)] hover:text-[var(--foreground)]",
            ].join(" ")}>
            <TrendingUp className="h-3.5 w-3.5" />
            Forecast
          </button>

          <button onClick={() => setWizardOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground-muted)] transition-colors hover:border-[rgba(37,99,235,0.4)] hover:text-[var(--foreground)]">
            <Megaphone className="h-3.5 w-3.5" />
            Campaña
          </button>

          <button onClick={() => setCreateLeadOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90">
            <Plus className="h-3.5 w-3.5" />
            Nuevo lead
          </button>

          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
            {(["kanban", "list"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={["flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === v ? "bg-[var(--border)] text-[var(--foreground)] shadow-sm" : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
                ].join(" ")}>
                {v === "kanban" ? <Columns3 className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
                {v === "kanban" ? "Kanban" : "Lista"}
              </button>
            ))}
          </div>

          <button onClick={() => setView(isAuto ? "kanban" : "automations")}
            className={["flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              isAuto
                ? "bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white font-bold shadow-md shadow-amber-200"
                : "bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white font-bold shadow-md shadow-amber-200 hover:opacity-90",
            ].join(" ")}>
            <Zap className="h-3.5 w-3.5" />
            {isAuto ? "← Pipeline" : "⚡ AUTOMATIZA"}
          </button>
        </div>
      </div>

      {/* -- Content ---------------------------------------------------- */}
      <div className={[
        "flex flex-1 min-h-0",
        view === "kanban"     ? "overflow-hidden px-5 pt-4"          : "",
        view === "list"       ? "overflow-y-auto overflow-x-hidden px-5 pt-4" : "",
        view === "forecast"   ? "overflow-y-auto px-5 pt-4"          : "",
        view === "automations"? "overflow-hidden"                     : "",
      ].join(" ")}>

        {view === "kanban" && (
          <Board
            leads={filteredLeads}
            columns={columns}
            onLeadsChange={handleLeadsChange}
            onColumnsChange={setColumns}
            onLeadClick={(lead) => setSelectedLeadId(lead.id)}
            onLeadDelete={handleLeadDelete}
            onLeadArchive={handleLeadArchive}
          />
        )}

        {view === "list" && (
          <div className="flex flex-col w-full min-h-0 gap-3 pb-4">
            {/* Barra de búsqueda + filtros de lista */}
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--foreground-faint)] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar contacto, empresa, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-8 text-sm
                             text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB]
                             focus:outline-none focus:ring-2 focus:ring-[rgba(37,99,235,0.2)]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)]
                           focus:border-[#2563EB] focus:outline-none"
              >
                <option value="all">Todas las etapas</option>
                {columns.map((c) => (
                  <option key={c.key ?? c.id} value={c.key ?? c.id}>{c.title}</option>
                ))}
              </select>

              {allCampaigns.length > 0 && (
                <select
                  value={filterCampaign}
                  onChange={(e) => setFilterCampaign(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)]
                             focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="all">Todas las campañas</option>
                  {allCampaigns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}

              <select
                value={`${sortBy}-${sortDir}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split("-");
                  setSortBy(field as typeof sortBy);
                  setSortDir(dir as "asc" | "desc");
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)]
                           focus:border-[#2563EB] focus:outline-none"
              >
                <option value="created_at-desc">Más recientes</option>
                <option value="created_at-asc">Más antiguos</option>
                <option value="value-desc">Mayor valor</option>
                <option value="score-desc">Mayor score</option>
                <option value="days_in_stage-desc">Más días en etapa</option>
              </select>

              <span className="ml-auto text-xs text-[var(--foreground-muted)] whitespace-nowrap">
                {filteredLeads.length} de {leads.length} leads
              </span>
            </div>

            {selectedIds.size > 0 && (
              <div className="flex flex-shrink-0 items-center gap-3 rounded-xl border border-[var(--border)]
                              bg-[var(--surface)] px-4 py-2.5 shadow-sm">
                <span className="text-xs font-semibold text-[var(--foreground)]">
                  {selectedIds.size} seleccionado{selectedIds.size > 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => handleBulkEnrich("find_email")}
                    disabled={bulkStatus === "running"}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--primary-soft)] px-3 py-1.5
                               text-xs font-semibold text-[var(--primary)] hover:opacity-80
                               disabled:opacity-40 transition-opacity"
                  >
                    <AtSign className="h-3 w-3" />
                    {bulkStatus === "running" ? "Encolando..." : "Buscar Email"}
                  </button>
                  <button
                    onClick={() => handleBulkEnrich("find_phone")}
                    disabled={bulkStatus === "running"}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--surface-hover)] px-3 py-1.5
                               text-xs font-semibold text-[var(--foreground-muted)] hover:bg-[var(--border)]
                               disabled:opacity-40 transition-colors"
                  >
                    <Phone className="h-3 w-3" />
                    {bulkStatus === "running" ? "Encolando..." : "Buscar Teléfono"}
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="ml-1 text-xs text-[var(--foreground-faint)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Limpiar
                  </button>
                </div>
                {bulkStatus === "done" && (
                  <span className="text-xs text-[var(--success)]">✓ Tareas encoladas en el motor</span>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              <LeadsListView
                leads={filteredLeads}
                columns={columns}
                onLeadClick={(lead) => setSelectedLeadId(lead.id)}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={(field) => {
                  if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                  else { setSortBy(field); setSortDir("desc"); }
                }}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleAll={handleToggleAll}
              />
            </div>
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
                  <div key={col.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-[var(--foreground)] truncate">{col.title}</p>
                      <span className="text-[11px] font-medium text-[var(--foreground-muted)]">{prob}% prob.</span>
                    </div>
                    <p className="text-2xl font-black tabular-nums text-[var(--foreground)]">
                      {colValue >= 1000 ? `$${(colValue / 1000).toFixed(0)}K` : `$${colValue}`}
                    </p>
                    <p className="text-[11px] text-[var(--foreground-muted)]">{colLeads.length} leads</p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-400" style={{ width: `${prob}%` }} />
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-indigo-400">
                      ≈ {weighted >= 1000 ? `$${(weighted / 1000).toFixed(0)}K` : `$${weighted}`} ponderado
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="rounded-2xl border border-green-800 bg-[rgba(16,185,129,0.08)] p-5">
              <p className="text-sm font-bold text-green-400">Pipeline total ponderado</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-green-300">
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
              <p className="mt-1 text-xs text-green-500">Valor esperado ponderado por probabilidad de cierre</p>
            </div>
          </div>
        )}
      </div>

      {/* -- Lead Modal (legacy, kept for fallback) --------------------- */}
      {selectedLead && !selectedLeadId && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStageChange={handleStageChange}
          onDeleted={(id) => { setLeads((prev) => prev.filter((l) => l.id !== id)); setSelectedLead(null); }}
          onArchived={(id) => { handleLeadArchive(id); setSelectedLead(null); }}
        />
      )}

      {/* -- Lead Detail Panel ------------------------------------------ */}
      <LeadDetailPanel
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onStageChange={(leadId, newStage) => {
          setLeads((prev) =>
            prev.map((l) => l.id === leadId ? { ...l, crmColumn: newStage } : l)
          );
        }}
      />

      {/* -- Settings Modal --------------------------------------------- */}
      {settingsOpen && (
        <SettingsModal leads={leads} onClose={() => setSettingsOpen(false)} />
      )}

      {/* -- Campaign Wizard -------------------------------------------- */}
      {wizardOpen && (
        <CampaignWizard
          onComplete={handleWizardComplete}
          onClose={() => setWizardOpen(false)}
        />
      )}

      {/* -- Create Lead Modal ------------------------------------------ */}
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
