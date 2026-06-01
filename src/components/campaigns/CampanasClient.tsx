"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
} from "@/app/dashboard/campanas/actions";
import type { CampaignRow } from "@/app/dashboard/campanas/actions";

// ── Props ──────────────────────────────────────────────────────────────────────

interface CampanasClientProps {
  initialData: {
    campaigns: CampaignRow[];
    linkedinAccounts: { id: string; name: string; status: string }[];
  };
}

// ── Map DB row → UI Campaign ───────────────────────────────────────────────────

function mapRow(c: CampaignRow): Campaign {
  return {
    id:           c.id,
    name:         c.name,
    type:         (c.type as CampaignType) ?? "linkedin",
    status:       (c.status as CampaignStatus) ?? "draft",
    createdAt:    c.created_at?.slice(0, 10) ?? "",
    segmentCount: c.segment_count ?? 0,
    totalLeads:   c.total_leads  ?? 0,
  };
}

function extractSegments(c: CampaignRow): Segment[] {
  const segs = c.workflow_json?.segments;
  if (!Array.isArray(segs)) return [];
  return segs as Segment[];
}

// ── View state ─────────────────────────────────────────────────────────────────

type View = "list" | "detail" | "builder";
type ActiveFlow = Campaign & { automationId: string; initialFlow?: FlowConfig; segments?: Segment[] };

// ── Component ──────────────────────────────────────────────────────────────────

export default function CampanasClient({ initialData }: CampanasClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [view,       setView]       = useState<View>("list");
  const [campaigns,  setCampaigns]  = useState<Campaign[]>(() => initialData.campaigns.map(mapRow));
  const [segments,   setSegments]   = useState<Segment[]>(
    () => initialData.campaigns.flatMap(extractSegments)
  );
  const [selected,   setSelected]   = useState<Campaign | null>(null);
  const [activeFlow, setActiveFlow] = useState<ActiveFlow | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [error,      setError]      = useState("");

  // ── Helpers ───────────────────────────────────────────────────────────────

  function segmentsFor(c: Campaign): Segment[] {
    return segments.filter((s) => s.campaignId === c.id);
  }

  // ── openDetail: pull fresh segments from in-memory workflow_json ──────────

  function openDetail(c: Campaign) {
    setSelected(c);
    setView("detail");
    // Refresh from Supabase to get latest workflow_json segments
    startTransition(async () => {
      const { getCampaignsData } = await import("@/app/dashboard/campanas/actions");
      const res = await getCampaignsData();
      if (res.success && res.data) {
        const rawCampaign = res.data.campaigns.find((r) => r.id === c.id);
        if (rawCampaign) {
          const freshSegs = extractSegments(rawCampaign);
          setSegments((prev) => [
            ...prev.filter((s) => s.campaignId !== c.id),
            ...freshSegs,
          ]);
        }
      }
    });
  }

  // ── openFlow ──────────────────────────────────────────────────────────────

  function openFlow(campaign: Campaign, segment: Segment) {
    // Get flow from workflow_json of the campaign we already have
    const rawCampaign = initialData.campaigns.find((r) => r.id === campaign.id);
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

  // ── updateSegments → persist via updateCampaignWorkflow ──────────────────

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

  // ── Wizard complete ───────────────────────────────────────────────────────

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

    // Create campaign in Supabase
    const res = await createCampaign({
      name:  data.campaignName,
      type:  data.campaignType ?? "linkedin",
    });

    let campaignId = `c_local_${Date.now()}`;

    if (res.success && res.data) {
      campaignId      = res.data.id;
      newSeg.campaignId = campaignId;

      // Save segment into workflow_json immediately
      await updateCampaignWorkflow(campaignId, { segments: [newSeg] });
    } else {
      setError(res.error ?? "Error al crear campaña");
      newSeg.campaignId = campaignId;
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

  // ── FlowBuilder save callback ─────────────────────────────────────────────

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

  // ── FlowBuilder launched callback ─────────────────────────────────────────

  function handleLaunched(status: "active" | "draft") {
    if (!activeFlow) return;
    setCampaigns((prev) =>
      prev.map((c) => c.id === activeFlow.id ? { ...c, status } : c)
    );
    if (selected?.id === activeFlow.id) {
      setSelected((prev) => prev ? { ...prev, status } : prev);
    }

    startTransition(async () => {
      if (status === "active") {
        const res = await launchCampaign(activeFlow.id);
        if (!res.success) {
          setError(res.error ?? "Error al lanzar campaña");
          return;
        }
      } else {
        await dbUpdateStatus(activeFlow.id, status);
      }
      router.refresh();
    });

    setView(selected ? "detail" : "list");
    setActiveFlow(null);
  }

  function handleDirectLaunch(campaignId: string) {
    startTransition(async () => {
      const res = await launchCampaign(campaignId);
      if (res.success) {
        setCampaigns((prev) =>
          prev.map((c) => c.id === campaignId ? { ...c, status: "active" } : c)
        );
        if (selected?.id === campaignId) {
          setSelected((prev) => prev ? { ...prev, status: "active" } : prev);
        }
        router.refresh();
      } else {
        setError(res.error ?? "Error al lanzar campaña");
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
          onLaunched={handleLaunched}
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
