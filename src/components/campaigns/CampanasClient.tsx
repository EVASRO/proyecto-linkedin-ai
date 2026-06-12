"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type {
  Campaign, Segment, WizardData, Template,
  FlowConfig, CampaignType, CampaignStatus, SegmentStatus,
} from "./types";
import { CampaignListView }   from "./CampaignListView";
import { CampaignDetailView } from "./CampaignDetailView";
import { CampaignWizard }     from "./CampaignWizard";
import { FlowBuilder }        from "./FlowBuilder";
import {
  createCampaign,
  updateCampaignWorkflow,
  updateCampaignStatus as dbUpdateStatus,
  launchCampaign,
  getActiveCampaignStats,
} from "@/app/dashboard/campanas/actions";
import type { CampaignRow } from "@/app/dashboard/campanas/actions";

// -- Props ----------------------------------------------------------------------

interface CampanasClientProps {
  initialData: {
    campaigns: CampaignRow[];
    linkedinAccounts: { id: string; name: string; status: string }[];
  };
}

// -- Map DB row → UI Campaign ---------------------------------------------------

function mapRow(c: CampaignRow): Campaign {
  return {
    id:            c.id,
    name:          c.name,
    type:          (c.type as CampaignType) ?? "linkedin",
    status:        (c.status as CampaignStatus) ?? "draft",
    createdAt:     c.created_at?.slice(0, 10) ?? "",
    segmentCount:  c.segment_count ?? 0,
    totalLeads:    c.total_leads   ?? 0,
    leadsTotal:    c.leads_total   ?? 0,
    leadsQueued:   c.leads_queued  ?? 0,
    workflow_json: (c.workflow_json as Record<string, unknown>) ?? {},
  };
}

const POLL_INTERVAL_ACTIVE_MS = 15_000;
const POLL_INTERVAL_IDLE_MS   = 60_000;

function extractSegments(c: CampaignRow): Segment[] {
  const wf = c.workflow_json;
  if (!wf) return [];

  // Formato nuevo: workflow_json.segments = [...]
  if (Array.isArray(wf.segments) && wf.segments.length > 0) {
    return (wf.segments as Segment[]).map((s) => ({
      ...s,
      campaignId: c.id, // garantizar campaignId para el poll de stats
      metrics: {
        ...((s as Segment).metrics ?? {}),
        totalLeads: c.total_leads || (s as Segment).metrics?.totalLeads || 0,
      },
    }));
  }

  // Formato legacy: workflow_json = { segment: {...}, automationName: "..." }
  if (wf.segment && typeof wf.segment === "object") {
    const seg = wf.segment as Record<string, unknown>;
    return [{
      id:             `seg_${c.id}`,
      campaignId:     c.id,
      name:           (wf.segmentName as string) ?? "Segmento principal",
      searchUrl:      (seg.url as string) ?? (wf.segmentationUrl as string) ?? "",
      source:         "external_link" as const,
      status:         "active" as const,
      automationId:   `auto_${c.id}`,
      automationName: (wf.automationName as string) ?? "Automatización",
      createdAt:      c.created_at ?? new Date().toISOString(),
      metrics: {
        totalLeads:  c.total_leads ?? 0,
        contacted:   0,
        connected:   0,
        replied:     0,
        meetings:    0,
        duplicates:  0,
        bounced:     0,
      },
    }];
  }

  return [];
}

// -- View state -----------------------------------------------------------------

type View = "list" | "detail" | "builder";
type ActiveFlow = Campaign & { automationId: string; initialFlow?: FlowConfig; segments?: Segment[] };

// -- Component ------------------------------------------------------------------

export default function CampanasClient({ initialData }: CampanasClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [view,       setView]       = useState<View>("list");
  const [campaigns,  setCampaigns]  = useState<Campaign[]>(() => initialData.campaigns.map(mapRow));
  const [rawRows,    setRawRows]    = useState<CampaignRow[]>(() => initialData.campaigns);
  const [segments,   setSegments]   = useState<Segment[]>(
    () => initialData.campaigns.flatMap(extractSegments)
  );
  const [selected,   setSelected]   = useState<Campaign | null>(null);
  const [activeFlow, setActiveFlow] = useState<ActiveFlow | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [error,      setError]      = useState("");
  const [toast,      setToast]      = useState<string | null>(null);
  const pollRef                     = useRef<ReturnType<typeof setInterval> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  // -- Polling para campañas activas -----------------------------------------

  useEffect(() => {
    const activeCampaigns = campaigns.filter((c) => c.status === "active");

    if (activeCampaigns.length === 0) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    async function poll() {
      const results = await Promise.allSettled(
        activeCampaigns.map((c) => getActiveCampaignStats(c.id))
      );
      setCampaigns((prev) =>
        prev.map((c) => {
          const idx = activeCampaigns.findIndex((ac) => ac.id === c.id);
          if (idx === -1) return c;
          const res = results[idx];
          if (res.status === "fulfilled" && res.value.success && res.value.data) {
            const s = res.value.data;
            return {
              ...c,
              status:      (s.status as CampaignStatus) ?? c.status,
              leadsTotal:  s.leadsTotal   ?? c.leadsTotal,
              totalLeads:  s.leadsTotal   ?? c.totalLeads,
              leadsQueued: s.leads_queued ?? c.leadsQueued,
            };
          }
          return c;
        })
      );
      // Propagar el count real de leads a metrics.totalLeads de cada segmento
      setSegments((prev) =>
        prev.map((seg) => {
          const idx = activeCampaigns.findIndex((ac) => ac.id === seg.campaignId);
          if (idx === -1) return seg;
          const res = results[idx];
          if (res.status === "fulfilled" && res.value.success && res.value.data) {
            const s = res.value.data;
            if (s.leadsTotal > 0 && s.leadsTotal !== seg.metrics.totalLeads) {
              return {
                ...seg,
                metrics: {
                  ...seg.metrics,
                  totalLeads: s.leadsTotal,
                  connected:  s.conectados  ?? seg.metrics.connected,
                },
              };
            }
          }
          return seg;
        })
      );
      // Actualizar también la campaña seleccionada si está en el poll
      setSelected((prev) => {
        if (!prev) return prev;
        const idx = activeCampaigns.findIndex((ac) => ac.id === prev.id);
        if (idx === -1) return prev;
        const res = results[idx];
        if (res.status === "fulfilled" && res.value.success && res.value.data) {
          const s = res.value.data;
          return {
            ...prev,
            leadsTotal:  s.leadsTotal   ?? prev.leadsTotal,
            totalLeads:  s.leadsTotal   ?? prev.totalLeads,
            leadsQueued: s.leads_queued ?? prev.leadsQueued,
          };
        }
        return prev;
      });
    }

    poll();
    const pollMs = activeCampaigns.length > 0 ? POLL_INTERVAL_ACTIVE_MS : POLL_INTERVAL_IDLE_MS;
    pollRef.current = setInterval(poll, pollMs);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns.filter((c) => c.status === "active").map((c) => c.id).join(",")]);

  // -- Realtime — actualización inmediata al cambiar crm_column de un lead --

  useEffect(() => {
    const activeCampaignIds = campaigns
      .filter((c) => c.status === "active")
      .map((c) => c.id);
    if (activeCampaignIds.length === 0) return;

    const supabase = createClient();
    const channel = supabase
      .channel("nexusai-leads-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        (payload) => {
          const campaignId = (payload.new as Record<string, unknown>)?.campaign_id as string | undefined;
          if (!campaignId || !activeCampaignIds.includes(campaignId)) return;
          getActiveCampaignStats(campaignId)
            .then((res) => {
              if (!res.success || !res.data) return;
              const s = res.data;
              setCampaigns((prev) =>
                prev.map((c) =>
                  c.id === campaignId
                    ? { ...c, leadsTotal: s.leadsTotal ?? c.leadsTotal, totalLeads: s.leadsTotal ?? c.totalLeads }
                    : c
                )
              );
              setSelected((prev) =>
                prev?.id === campaignId
                  ? { ...prev, leadsTotal: s.leadsTotal ?? prev.leadsTotal, totalLeads: s.leadsTotal ?? prev.totalLeads }
                  : prev
              );
            })
            .catch(() => {});
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns.filter((c) => c.status === "active").map((c) => c.id).join(",")]);

  // -- Helpers ---------------------------------------------------------------

  function segmentsFor(c: Campaign): Segment[] {
    return segments.filter((s) => s.campaignId === c.id);
  }

  // -- openDetail: fetch fresh data from Supabase before navigating ----------

  async function openDetail(c: Campaign) {
    // Fetch fresh data first so segments are never stale after a FlowBuilder save
    const { getCampaignsData } = await import("@/app/dashboard/campanas/actions");
    const res = await getCampaignsData();

    if (res.success && res.data) {
      setRawRows(res.data.campaigns);
      const fresh = res.data.campaigns.find((r) => r.id === c.id);
      if (fresh) {
        const freshSegs = extractSegments(fresh);
        const freshCampaign: Campaign = {
          ...c,
          totalLeads:   fresh.total_leads   ?? c.totalLeads,
          segmentCount: fresh.segment_count ?? c.segmentCount,
        };
        setSegments((prev) => [
          ...prev.filter((s) => s.campaignId !== c.id),
          ...freshSegs,
        ]);
        setSelected(freshCampaign);
        setView("detail");
        // Hidratar stats en tiempo real inmediatamente al abrir el detalle
        getActiveCampaignStats(c.id).then((statsRes) => {
          if (statsRes.success && statsRes.data) {
            const s = statsRes.data;
            setSelected((prev) => prev ? {
              ...prev,
              leadsTotal:  s.leadsTotal   ?? prev.leadsTotal,
              totalLeads:  s.leadsTotal   ?? prev.totalLeads,
              leadsQueued: s.leads_queued ?? prev.leadsQueued,
            } : prev);
            setSegments((prev) =>
              prev.map((seg) =>
                seg.campaignId === c.id && s.leadsTotal > 0
                  ? { ...seg, metrics: { ...seg.metrics, totalLeads: s.leadsTotal, connected: s.conectados ?? seg.metrics.connected } }
                  : seg
              )
            );
          }
        }).catch(() => {});
        return;
      }
    }

    // Fallback: use in-memory data
    const raw = rawRows.find((r) => r.id === c.id);
    const segs = raw ? extractSegments(raw) : [];
    setSegments((prev) => [...prev.filter((s) => s.campaignId !== c.id), ...segs]);
    setSelected(c);
    setView("detail");
    getActiveCampaignStats(c.id).then((statsRes) => {
      if (statsRes.success && statsRes.data) {
        const s = statsRes.data;
        setSelected((prev) => prev ? {
          ...prev,
          leadsTotal:  s.leadsTotal   ?? prev.leadsTotal,
          totalLeads:  s.leadsTotal   ?? prev.totalLeads,
          leadsQueued: s.leads_queued ?? prev.leadsQueued,
        } : prev);
        setSegments((prev) =>
          prev.map((seg) =>
            seg.campaignId === c.id && s.leadsTotal > 0
              ? { ...seg, metrics: { ...seg.metrics, totalLeads: s.leadsTotal, connected: s.conectados ?? seg.metrics.connected } }
              : seg
          )
        );
      }
    }).catch(() => {});
  }

  // -- openFlow --------------------------------------------------------------

  function openFlow(campaign: Campaign, segment: Segment) {
    // Always read from live rawRows (kept in sync with Supabase on every openDetail/save)
    const rawCampaign = rawRows.find((r) => r.id === campaign.id);
    const wf          = rawCampaign?.workflow_json ?? {};
    const initialFlow: FlowConfig | undefined =
      wf.nodes && wf.edges
        ? { nodes: wf.nodes as FlowConfig["nodes"], edges: wf.edges as FlowConfig["edges"] }
        : undefined;

    const segsForCampaign = segmentsFor(campaign);
    setActiveFlow({
      ...campaign,
      automationId: segment.automationId,
      initialFlow,
      segments:     segsForCampaign.length > 0 ? segsForCampaign : [segment],
    });
    setView("builder");
  }

  // -- updateSegments → persist via updateCampaignWorkflow ------------------

  function updateSegments(campaignId: string, updater: (prev: Segment[]) => Segment[]) {
    setSegments((prev) => {
      const forCampaign = prev.filter((s) => s.campaignId === campaignId);
      const others      = prev.filter((s) => s.campaignId !== campaignId);
      const updated     = updater(forCampaign);

      startTransition(async () => {
        // Read current workflow_json to preserve nodes/edges
        const { getCampaignsData } = await import("@/app/dashboard/campanas/actions");
        const res = await getCampaignsData();
        if (res.success && res.data) {
          const raw = res.data.campaigns.find((r) => r.id === campaignId);
          const currentWf = raw?.workflow_json ?? {};
          const saveRes = await updateCampaignWorkflow(campaignId, { ...currentWf, segments: updated });
          if (!saveRes.success) setError(saveRes.error ?? "Error al guardar segmentos");
        }
      });

      return [...others, ...updated];
    });
  }

  function handleSegmentStatusChange(campaignId: string, segId: string, status: SegmentStatus) {
    updateSegments(campaignId, (segs) =>
      segs.map((s) => s.id === segId ? { ...s, status } : s)
    );
  }

  function handleSegmentRename(campaignId: string, segId: string, name: string) {
    updateSegments(campaignId, (segs) =>
      segs.map((s) => s.id === segId ? { ...s, name } : s)
    );
  }

  function handleSegmentDelete(campaignId: string, segId: string) {
    updateSegments(campaignId, (segs) => segs.filter((s) => s.id !== segId));
    setCampaigns((prev) => prev.map((c) =>
      c.id === campaignId ? { ...c, segmentCount: Math.max(0, c.segmentCount - 1) } : c
    ));
  }

  function handleSegmentAdd(campaignId: string, seg: Segment) {
    updateSegments(campaignId, (segs) => [...segs, seg]);
    setCampaigns((prev) => prev.map((c) =>
      c.id === campaignId ? { ...c, segmentCount: c.segmentCount + 1 } : c
    ));
  }

  // -- Wizard complete -------------------------------------------------------

  async function handleWizardComplete(data: WizardData, template: Template | null) {
    setError("");
    const segId  = `seg_${Date.now()}`;
    const autoId = `auto_${Date.now()}`;
    const today  = new Date().toISOString().slice(0, 10);

    const newSeg: Segment = {
      id:             segId,
      campaignId:     "PENDING",
      name:           data.segmentName || "Segmento principal",
      searchUrl:      data.segmentationUrl || undefined,
      source:         data.segmentationUrl ? "external_link" : "crm",
      status:         "draft",
      metrics:        { totalLeads: data.estimatedLeads ?? 0, contacted: 0, connected: 0, replied: 0, meetings: 0, duplicates: 0, bounced: 0 },
      automationId:   autoId,
      automationName: data.automationName || "Nueva automatización",
      createdAt:      today,
    };

    let campaignId = `c_local_${Date.now()}`;

    // Reusar draft huérfano con el mismo nombre en lugar de crear duplicado
    const { getCampaignsData } = await import("@/app/dashboard/campanas/actions");
    const existingRes = await getCampaignsData();
    const duplicate = existingRes.data?.campaigns.find(
      (c) => c.name === data.campaignName && c.status === "draft"
    );

    if (duplicate) {
      campaignId        = duplicate.id;
      newSeg.campaignId = campaignId;
      await updateCampaignWorkflow(campaignId, { segments: [newSeg] });
    } else {
      // Create campaign in Supabase
      const res = await createCampaign({
        name: data.campaignName,
        type: data.campaignType ?? "linkedin",
      });

      if (res.success && res.data) {
        campaignId        = res.data.id;
        newSeg.campaignId = campaignId;
        await updateCampaignWorkflow(campaignId, { segments: [newSeg] });
      } else {
        setError(res.error ?? "Error al crear campaña");
        newSeg.campaignId = campaignId;
      }
    }

    const newCampaign: Campaign = {
      id:           campaignId,
      name:         data.campaignName,
      type:         data.campaignType!,
      status:       "draft",
      createdAt:    today,
      segmentCount: 1,
      totalLeads:   newSeg.metrics.totalLeads,
    };

    setCampaigns((prev) => [newCampaign, ...prev.filter((c) => c.id !== campaignId)]);
    setSegments((prev)  => [...prev.filter((s) => s.campaignId !== campaignId), newSeg]);
    setWizardOpen(false);

    setActiveFlow({
      ...newCampaign,
      automationId: autoId,
      initialFlow:  template?.flowConfig,
      segments:     [newSeg],
    });
    setView("builder");
  }

  // -- FlowBuilder save callback ---------------------------------------------

  function handleFlowSave(campaignId: string, flowConfig: FlowConfig) {
    const segsForCampaign = segmentsFor({ id: campaignId } as Campaign);
    startTransition(async () => {
      const res = await updateCampaignWorkflow(campaignId, {
        ...flowConfig,
        segments: segsForCampaign,
      });
      if (!res.success) setError(res.error ?? "Error al guardar flujo");
    });
  }

  // -- FlowBuilder launched callback -----------------------------------------

  function handleLaunched(status: "active" | "draft", currentFlow?: FlowConfig) {
    if (!activeFlow) return;

    const campaignId      = activeFlow.id;
    const segsForCampaign = activeFlow.segments ?? segmentsFor(activeFlow);

    // Optimistic UI update
    setCampaigns((prev) =>
      prev.map((c) => c.id === campaignId ? { ...c, status } : c)
    );
    if (selected?.id === campaignId) {
      setSelected((prev) => prev ? { ...prev, status } : prev);
    }

    startTransition(async () => {
      // 1. Guardar el flujo actual (nodes + edges + segments) antes de lanzar
      //    Así launchCampaign lee un workflow_json completo desde DB
      const flowToSave = currentFlow ?? activeFlow.initialFlow ?? { nodes: [], edges: [] };
      await updateCampaignWorkflow(campaignId, {
        ...flowToSave,
        segments: segsForCampaign,
      });

      if (status === "active") {
        const res = await launchCampaign(campaignId);
        if (!res.success) {
          setError(res.error ?? "Error al lanzar campaña");
          // Revertir optimistic update
          setCampaigns((prev) =>
            prev.map((c) => c.id === campaignId ? { ...c, status: "draft" } : c)
          );
          return;
        }
        setSegments((prev) =>
          prev.map((s) => s.campaignId === campaignId ? { ...s, status: "active" as SegmentStatus } : s)
        );
        showToast("✓ Campaña lanzada. Los leads están siendo procesados.");
      } else {
        await dbUpdateStatus(campaignId, status);
      }
      router.refresh();
    });

    setView(selected ? "detail" : "list");
    setActiveFlow(null);
  }

  function handleDirectLaunch(campaignId: string) {
    const alreadyActive = campaigns.find((c) => c.id === campaignId)?.status === "active";

    startTransition(async () => {
      const res = await launchCampaign(campaignId);
      if (!res.success) {
        setError(res.error ?? "Error al lanzar campaña");
        return;
      }

      // Optimistic update — launchCampaign already persisted segments as active in DB
      setCampaigns((prev) =>
        prev.map((c) => c.id === campaignId ? { ...c, status: "active" } : c)
      );
      setSegments((prev) =>
        prev.map((s) => s.campaignId === campaignId ? { ...s, status: "active" as SegmentStatus } : s)
      );
      if (selected?.id === campaignId) {
        setSelected((prev) => prev ? { ...prev, status: "active" } : prev);
      }

      showToast(alreadyActive
        ? "✓ Esta campaña ya está activa y procesando leads."
        : "✓ Campaña lanzada. Los leads están siendo procesados."
      );
      router.refresh();
    });
  }

  // -- Render ----------------------------------------------------------------

  if (view === "builder" && activeFlow) {
    const segsForFlow = activeFlow.segments ?? segmentsFor(activeFlow);
    return (
      <div className="flex flex-1 overflow-hidden">
        <FlowBuilder
          campaign={activeFlow}
          segments={segsForFlow}
          initialFlow={activeFlow.initialFlow}
          onSave={(flowConfig) => handleFlowSave(activeFlow.id, flowConfig)}
          onBack={() => {
            router.refresh();
            setView(selected ? "detail" : "list");
            setActiveFlow(null);
          }}
          onLaunched={(status, flow) => handleLaunched(status, flow)}
        />
      </div>
    );
  }

  if (view === "detail" && selected) {
    const segsForSelected = segmentsFor(selected);
    return (
      <div className="flex flex-1 overflow-hidden">
        <CampaignDetailView
          campaign={selected}
          segments={segsForSelected}
          onBack={() => { setSelected(null); setView("list"); }}
          onOpenFlow={openFlow}
          onSegmentStatusChange={(segId, status) => handleSegmentStatusChange(selected.id, segId, status)}
          onSegmentRename={(segId, name)           => handleSegmentRename(selected.id, segId, name)}
          onSegmentDelete={(segId)                 => handleSegmentDelete(selected.id, segId)}
          onSegmentAdd={(seg)                      => handleSegmentAdd(selected.id, seg)}
          onLaunch={handleDirectLaunch}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {error && (
        <div className="flex items-center gap-3 bg-red-500 px-5 py-2 text-sm text-white">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")} className="opacity-80 hover:opacity-100">✕</button>
        </div>
      )}
      {toast && (
        <div className="flex items-center gap-3 border-b border-green-200 bg-green-50 px-5 py-2 text-sm font-medium text-green-800">
          <span className="flex-1">{toast}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
      {isPending && (
        <div className="h-0.5 bg-indigo-600 animate-pulse" />
      )}
      <div className="flex flex-1 overflow-hidden">
        <CampaignListView
          campaigns={campaigns}
          onOpen={openDetail}
          onNew={() => setWizardOpen(true)}
          onCampaignsChange={setCampaigns}
        />
        {wizardOpen && (
          <CampaignWizard
            onComplete={handleWizardComplete}
            onClose={() => setWizardOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
