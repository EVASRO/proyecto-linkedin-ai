"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// -- Shared result type --------------------------------------------------------

type Result<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T };

// -- Exported types ------------------------------------------------------------

export type CampaignRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  workflow_json: Record<string, unknown>;
  total_leads: number;
  segment_count: number;
  leads_total: number;
  leads_queued: number;
  linkedin_account_id: string | null;
  priority: number;
  deleted_at: string | null;
  created_at: string;
};

// -- Auth context helper -------------------------------------------------------

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("No autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  if (!profile?.workspace_id || profile.workspace_id === "") {
    const { data: ws } = await supabase
      .from("workspaces")
      .insert({ name: "Mi Workspace", plan_type: "growth" })
      .select("id")
      .single();
    if (ws?.id) {
      await supabase.from("profiles").update({ workspace_id: ws.id }).eq("id", user.id);
      await supabase.from("workspace_settings").insert({ workspace_id: ws.id });
    }
    return { supabase, userId: user.id, workspaceId: ws?.id ?? "" };
  }

  return { supabase, userId: user.id, workspaceId: profile.workspace_id as string };
}

// -- 1. getCampaignsData -------------------------------------------------------

export async function getCampaignsData(): Promise<Result<{
  campaigns: CampaignRow[];
  linkedinAccounts: { id: string; name: string; status: string }[];
}>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const [campaignsRes, liRes] = await Promise.all([
      supabase
        .from("campaigns")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("linkedin_accounts")
        .select("id, name, status")
        .eq("workspace_id", workspaceId),
    ]);

    if (campaignsRes.error) return { success: false, error: campaignsRes.error.message };

    const campaigns = campaignsRes.data ?? [];

    // Replace stale campaigns.total_leads with live count from leads table
    const campaignsWithLiveCount = await Promise.all(
      campaigns.map(async (campaign) => {
        const { count: realLeadCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaign.id);
        return { ...campaign, total_leads: realLeadCount ?? 0 };
      })
    );

    return {
      success: true,
      data: {
        campaigns:        campaignsWithLiveCount as CampaignRow[],
        linkedinAccounts: (liRes.data ?? []) as { id: string; name: string; status: string }[],
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 2. createCampaign ---------------------------------------------------------

export async function createCampaign(data: {
  name: string;
  type: string;
  linkedin_account_id?: string;
  connectionNote?: string;
  followUpMessage?: string;
  followUpDelayDays?: number;
}): Promise<Result<CampaignRow>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert({
        workspace_id:        workspaceId,
        name:                data.name,
        type:                data.type,
        status:              "draft",
        workflow_json: {
          connection_note:      data.connectionNote      ?? "",
          follow_up_message:    data.followUpMessage     ?? "",
          follow_up_delay_days: data.followUpDelayDays   ?? 1,
        },
        total_leads:         0,
        segment_count:       0,
        linkedin_account_id: data.linkedin_account_id ?? null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: campaign as CampaignRow };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 3. updateCampaignWorkflow -------------------------------------------------

export async function updateCampaignWorkflow(
  id: string,
  workflowData: Record<string, unknown>
): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    // Read current workflow to merge — prevents FlowBuilder from wiping segments
    const { data: current } = await supabase
      .from("campaigns")
      .select("workflow_json, total_leads")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    const existingWf = (current?.workflow_json ?? {}) as Record<string, unknown>;

    // Merge: spread existing first, then new data on top.
    // Segments are preserved from whichever source has them.
    const merged: Record<string, unknown> = {
      ...existingWf,
      ...workflowData,
      segments: workflowData.segments ?? existingWf.segments ?? [],
    };

    const segments = Array.isArray(merged.segments)
      ? (merged.segments as Array<{ metrics?: { totalLeads?: number }; maxLeads?: number | null }>)
      : [];

    // Propagate maxLeads from segment to root of workflow_json so the engine can read it
    const maxLeadsFromSegment = segments.find((s) => s.maxLeads != null)?.maxLeads ?? null;
    if (maxLeadsFromSegment != null) {
      merged.maxLeads = maxLeadsFromSegment;
    }

    const segment_count = segments.length > 0
      ? segments.length
      : (typeof merged.segment_count === "number" ? merged.segment_count : 0);

    const total_leads = segments.length > 0
      ? segments.reduce((sum, s) => sum + (s.metrics?.totalLeads ?? 0), 0)
      : (typeof merged.total_leads === "number"
          ? merged.total_leads
          : (current?.total_leads ?? 0));

    const { error } = await supabase
      .from("campaigns")
      .update({ workflow_json: merged, segment_count, total_leads })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };

    // -- Sync A/B columns when the FlowBuilder includes AB config --------------
    if (typeof workflowData.ab_enabled !== "undefined") {
      const abEnabled = workflowData.ab_enabled === true;
      const varA = (workflowData.variant_a ?? {}) as Record<string, unknown>;
      const varB = (workflowData.variant_b ?? {}) as Record<string, unknown>;

      const extractFromNodes = (
        nodes: unknown[],
        edges: unknown[]
      ): { connection_note: string; follow_up_message: string } => {
        const nodeMap = new Map(
          nodes.map((n) => [(n as Record<string, unknown>).id as string, n])
        );
        const next = new Map<string, string>();
        for (const e of edges as Array<Record<string, unknown>>) {
          if (!next.has(e.source as string)) next.set(e.source as string, e.target as string);
        }
        const start = nodes.find((n) => {
          const d = (n as Record<string, unknown>);
          return (d.data as Record<string, unknown>)?.nodeType === "start" || d.type === "start";
        }) as Record<string, unknown> | undefined;

        let connNote = "";
        let followUp = "";
        let cur = start ? next.get(start.id as string) : undefined;
        const visited = new Set<string>();

        while (cur && !visited.has(cur)) {
          visited.add(cur);
          const node = nodeMap.get(cur) as Record<string, unknown> | undefined;
          if (!node) break;
          const data = (node.data ?? {}) as Record<string, unknown>;
          const nodeType = (data.nodeType ?? node.type) as string;
          if (nodeType === "connect") {
            connNote = String(data.connectionNote ?? data.noteA ?? "");
          }
          if (nodeType === "message" && !followUp) followUp = String(data.bodyA ?? data.body ?? "");
          cur = next.get(cur);
        }
        return { connection_note: connNote, follow_up_message: followUp };
      };

      const varANodes = Array.isArray(varA.nodes) ? varA.nodes : (merged.nodes as unknown[] ?? []);
      const varAEdges = Array.isArray(varA.edges) ? varA.edges : (merged.edges as unknown[] ?? []);
      const varBNodes = Array.isArray(varB.nodes) ? varB.nodes : (merged.nodes as unknown[] ?? []);
      const varBEdges = Array.isArray(varB.edges) ? varB.edges : (merged.edges as unknown[] ?? []);

      await supabase
        .from("campaigns")
        .update({
          ab_test_enabled: abEnabled,
          ab_variant_a:    extractFromNodes(varANodes, varAEdges),
          ab_variant_b:    extractFromNodes(varBNodes, varBEdges),
        })
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .then(() => null, () => null);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 4. updateCampaignStatus ---------------------------------------------------

export async function updateCampaignStatus(
  id: string,
  status: "draft" | "active" | "paused" | "completed"
): Promise<Result<{ affectedTasks: number }>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { error } = await supabase
      .from("campaigns")
      .update({ status })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };

    let affectedTasks = 0;

    if (status === "paused") {
      // Pause pending/scheduled tasks — leave running tasks untouched
      const { data } = await supabase
        .from("engine_queue")
        .update({ status: "paused" })
        .eq("campaign_id", id)
        .in("status", ["pending", "scheduled"])
        .select("id");
      affectedTasks = data?.length ?? 0;
    } else if (status === "active") {
      // Resume previously paused tasks
      const { data } = await supabase
        .from("engine_queue")
        .update({ status: "pending" })
        .eq("campaign_id", id)
        .eq("status", "paused")
        .select("id");
      affectedTasks = data?.length ?? 0;
    } else if (status === "completed") {
      // Cancel everything not already running
      const { data } = await supabase
        .from("engine_queue")
        .update({ status: "cancelled" })
        .eq("campaign_id", id)
        .in("status", ["pending", "scheduled", "paused"])
        .select("id");
      affectedTasks = data?.length ?? 0;
    }

    revalidatePath("/dashboard/campanas");
    revalidatePath("/dashboard");
    return { success: true, data: { affectedTasks } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 5. archiveCampaign (soft delete) -----------------------------------------

export async function archiveCampaign(id: string): Promise<Result<{ cancelledTasks: number }>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { error } = await supabase
      .from("campaigns")
      .update({ deleted_at: new Date().toISOString(), status: "archived" })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };

    // Cancel all non-running tasks
    const { data: cancelled } = await supabase
      .from("engine_queue")
      .update({ status: "cancelled" })
      .eq("campaign_id", id)
      .in("status", ["pending", "scheduled", "paused"])
      .select("id");

    revalidatePath("/dashboard/campanas");
    revalidatePath("/dashboard");
    return { success: true, data: { cancelledTasks: cancelled?.length ?? 0 } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 6. permanentlyDeleteCampaign ----------------------------------------------

export async function permanentlyDeleteCampaign(id: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    // Only allow deletion of campaigns archived ≥30 days ago
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("deleted_at, status")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!campaign?.deleted_at || campaign.status !== "archived") {
      return { success: false, error: "Solo se pueden eliminar campañas archivadas" };
    }
    const daysSinceArchived = (Date.now() - new Date(campaign.deleted_at).getTime()) / 86400000;
    if (daysSinceArchived < 30) {
      return { success: false, error: "La campaña debe estar archivada al menos 30 días" };
    }

    await supabase.from("engine_queue").delete().eq("campaign_id", id);
    const { error } = await supabase.from("campaigns").delete().eq("id", id).eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/campanas");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- getLeadCountForCampaign ---------------------------------------------------

export async function getLeadCountForCampaign(campaignId: string): Promise<number> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("workspace_id", workspaceId);
    return count ?? 0;
  } catch { return 0; }
}

// -- deleteCampaignFull --------------------------------------------------------

export async function deleteCampaignFull(
  campaignId: string,
  deleteLeads: boolean
): Promise<Result<{ deletedLeads: number }>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    // 1. Cancel all pending/processing tasks
    await supabase
      .from("engine_queue")
      .update({ status: "cancelled", last_error: "Campaña eliminada" })
      .eq("campaign_id", campaignId)
      .in("status", ["pending", "processing", "scheduled", "paused"]);

    let deletedLeads = 0;

    if (deleteLeads) {
      const { data: deleted } = await supabase
        .from("leads")
        .delete()
        .eq("campaign_id", campaignId)
        .eq("workspace_id", workspaceId)
        .select("id");
      deletedLeads = deleted?.length ?? 0;
    } else {
      // Desvincular leads sin borrarlos
      await supabase
        .from("leads")
        .update({ campaign_id: null })
        .eq("campaign_id", campaignId)
        .eq("workspace_id", workspaceId);
    }

    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/campanas");
    revalidatePath("/dashboard");
    return { success: true, data: { deletedLeads } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 7 (legacy). deleteCampaign → now delegates to archiveCampaign ------------

export async function deleteCampaign(id: string): Promise<Result> {
  return archiveCampaign(id);
}

// -- updateCampaignPriority ----------------------------------------------------

export async function updateCampaignPriority(
  id: string,
  priority: number
): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const clampedPriority = Math.min(10, Math.max(1, Math.round(priority)));
    const { error } = await supabase
      .from("campaigns")
      .update({ priority: clampedPriority })
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 6. launchCampaign --------------------------------------------------------

export async function launchCampaign(campaignId: string): Promise<Result<{ queued: number }>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("id, name, type, workflow_json, status")
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId)
      .single();

    if (campErr || !campaign) return { success: false, error: "Campaña no encontrada" };

    // Activar todos los segmentos en workflow_json
    const wf = (campaign.workflow_json ?? {}) as Record<string, unknown>;
    const now = new Date().toISOString();
    const updatedSegments = Array.isArray(wf.segments)
      ? (wf.segments as Array<Record<string, unknown>>).map((seg) => ({
          ...seg,
          status: "active",
          activated_at: now,
        }))
      : wf.segments;
    const updatedWorkflow = { ...wf, segments: updatedSegments };

    // Verificar si ya hay un task de scraping pendiente para evitar duplicados
    const { data: existingScrapingTask } = await supabase
      .from("engine_queue")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("task_type", "start_campaign_scraping")
      .eq("status", "pending")
      .eq("campaign_id", campaignId)
      .maybeSingle();

    // Actualizar campaña a activa con workflow actualizado
    await supabase
      .from("campaigns")
      .update({
        status:        "active",
        workflow_json: updatedWorkflow,
      })
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId);

    // Solo crear la tarea de scraping si no hay una pendiente ya
    if (!existingScrapingTask) {
      const { error: queueErr } = await supabase.from("engine_queue").insert({
        workspace_id: workspaceId,
        campaign_id:  campaignId,
        task_type:    "start_campaign_scraping",
        action_type:  "start_campaign_scraping",
        payload:      { campaign_id: campaignId },
        status:       "pending",
        priority:     10,
        scheduled_at: now,
      });
      if (queueErr) return { success: false, error: queueErr.message };
    }

    return { success: true, data: { queued: 1 } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 7. duplicateCampaign ------------------------------------------------------

export async function duplicateCampaign(id: string): Promise<Result<CampaignRow>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { data: original, error: fetchErr } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (fetchErr || !original) return { success: false, error: fetchErr?.message ?? "Campaña no encontrada" };

    const { data: copy, error: insertErr } = await supabase
      .from("campaigns")
      .insert({
        workspace_id:        workspaceId,
        name:                `Copia de ${original.name}`,
        type:                original.type,
        status:              "draft",
        workflow_json:       original.workflow_json ?? {},
        total_leads:         0,
        segment_count:       original.segment_count ?? 0,
        linkedin_account_id: original.linkedin_account_id ?? null,
      })
      .select()
      .single();

    if (insertErr) return { success: false, error: insertErr.message };
    return { success: true, data: copy as CampaignRow };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 8. getLeadCountsByCrmColumn -----------------------------------------------

export type LeadCountsByCrm = {
  extraido:           number;
  conexion_enviada:   number;
  conexion_aceptada:  number;
  en_conversacion:    number;
  reunion_agendada:   number;
  cliente:            number;
};

export async function getLeadCountsByCrmColumn(
  campaignId: string
): Promise<Result<LeadCountsByCrm>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { data, error } = await supabase
      .from("leads")
      .select("crm_column")
      .eq("campaign_id", campaignId)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };

    const counts: LeadCountsByCrm = {
      extraido:           0,
      conexion_enviada:   0,
      conexion_aceptada:  0,
      en_conversacion:    0,
      reunion_agendada:   0,
      cliente:            0,
    };
    for (const row of data ?? []) {
      const col = row.crm_column as keyof LeadCountsByCrm;
      if (col && col in counts) counts[col]++;
    }

    return { success: true, data: counts };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 9. getActiveCampaignStats -------------------------------------------------

export type CampaignStats = {
  id: string;
  status: string;
  leads_total: number;
  leads_queued: number;
  leadsTotal: number;
  connEnviadas: number;
  leadsQueued: number;
  extraidos: number;
  conectados: number;
};

export async function getActiveCampaignStats(
  campaignId: string
): Promise<Result<CampaignStats>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const [campaignRes, totalRes, connSentRes, conectadosRes, extraidosRes, queueRes] =
      await Promise.all([
        supabase
          .from("campaigns")
          .select("id, status, leads_total, leads_queued")
          .eq("id", campaignId)
          .eq("workspace_id", workspaceId)
          .single(),
        // Total de leads reales en la tabla (fuente de verdad)
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("campaign_id", campaignId),
        // Conexiones enviadas
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("campaign_id", campaignId)
          .eq("crm_column", "conexion_enviada"),
        // Conectados: aceptaron + siguientes etapas
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("campaign_id", campaignId)
          .in("crm_column", ["conexion_aceptada", "en_conversacion", "reunion_agendada", "cliente"]),
        // Extraídos (pendientes de acción)
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("campaign_id", campaignId)
          .eq("crm_column", "extraido"),
        // Tareas pendientes en cola
        supabase
          .from("engine_queue")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("campaign_id", campaignId)
          .eq("status", "pending"),
      ]);

    if (campaignRes.error) return { success: false, error: campaignRes.error.message };

    const liveTotal = totalRes.count ?? 0;

    // Mantener campaigns.total_leads sincronizado con el count real
    if (liveTotal !== (campaignRes.data.leads_total ?? 0)) {
      await supabase
        .from("campaigns")
        .update({ total_leads: liveTotal, leads_total: liveTotal })
        .eq("id", campaignId)
        .eq("workspace_id", workspaceId);
    }

    const base = campaignRes.data;
    return {
      success: true,
      data: {
        id:           base.id,
        status:       base.status,
        leads_total:  liveTotal,
        leads_queued: queueRes.count      ?? 0,
        leadsTotal:   liveTotal,
        connEnviadas: connSentRes.count   ?? 0,
        leadsQueued:  queueRes.count      ?? 0,
        extraidos:    extraidosRes.count  ?? 0,
        conectados:   conectadosRes.count ?? 0,
      } as CampaignStats,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function getDashboardUrl(): Promise<string> {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

// -- getSequenceAnalytics ------------------------------------------------------

const SEQUENCE_STAGES = [
  { step: 0, key: 'extraido',          label: 'Extraído'          },
  { step: 1, key: 'conexion_enviada',  label: 'Solicitud enviada' },
  { step: 2, key: 'conexion_aceptada', label: 'Conexión aceptada' },
  { step: 3, key: 'en_conversacion',   label: 'En conversación'   },
  { step: 4, key: 'reunion_agendada',  label: 'Reunión agendada'  },
  { step: 5, key: 'cliente',           label: 'Cliente'           },
] as const;

export async function getSequenceAnalytics(campaignId: string): Promise<{
  success: boolean;
  data?: {
    steps: Array<{
      step: number; label: string;
      totalLeads: number; passed: number; dropped: number; convRate: number;
    }>;
    abTest?: {
      variantA: { sent: number; accepted: number; rate: number };
      variantB: { sent: number; accepted: number; rate: number };
      winner: 'a' | 'b' | null;
      sampleOk: boolean;
    };
  };
  error?: string;
}> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { data: rows } = await supabase
      .from('leads')
      .select('crm_column')
      .eq('campaign_id', campaignId)
      .eq('workspace_id', workspaceId);

    const countsByStage: Record<string, number> = {};
    for (const row of rows ?? []) {
      const col = row.crm_column ?? 'extraido';
      countsByStage[col] = (countsByStage[col] ?? 0) + 1;
    }

    const total = (rows ?? []).length;

    // Build cumulative funnel: each step counts leads AT or BEYOND that stage
    const steps = SEQUENCE_STAGES.map((s, idx) => {
      const atOrBeyond = SEQUENCE_STAGES.slice(idx).reduce(
        (sum, stage) => sum + (countsByStage[stage.key] ?? 0), 0
      );
      const prevAtOrBeyond = idx === 0
        ? total
        : SEQUENCE_STAGES.slice(idx - 1).reduce(
            (sum, stage) => sum + (countsByStage[stage.key] ?? 0), 0
          );
      const convRate = prevAtOrBeyond > 0
        ? Math.round((atOrBeyond / prevAtOrBeyond) * 100)
        : 0;
      return {
        step:       s.step,
        label:      s.label,
        totalLeads: atOrBeyond,
        passed:     countsByStage[s.key] ?? 0,
        dropped:    Math.max(0, prevAtOrBeyond - atOrBeyond),
        convRate:   idx === 0 ? 100 : convRate,
      };
    });

    // A/B test data
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('ab_test_enabled, ab_winner, ab_min_sample_size')
      .eq('id', campaignId)
      .single();

    let abTest: typeof undefined | {
      variantA: { sent: number; accepted: number; rate: number };
      variantB: { sent: number; accepted: number; rate: number };
      winner: 'a' | 'b' | null;
      sampleOk: boolean;
    } = undefined;

    if (campaign?.ab_test_enabled) {
      const { data: abLeads } = await supabase
        .from('leads')
        .select('ab_variant, crm_column')
        .eq('campaign_id', campaignId)
        .in('ab_variant', ['a', 'b']);

      const varA = (abLeads ?? []).filter((l) => l.ab_variant === 'a');
      const varB = (abLeads ?? []).filter((l) => l.ab_variant === 'b');
      const accepted = (leads: typeof varA) =>
        leads.filter((l) => l.crm_column !== 'conexion_enviada' && l.crm_column !== 'extraido').length;

      const rateA = varA.length > 0 ? Math.round((accepted(varA) / varA.length) * 100) : 0;
      const rateB = varB.length > 0 ? Math.round((accepted(varB) / varB.length) * 100) : 0;
      const minSample = campaign.ab_min_sample_size ?? 30;

      abTest = {
        variantA: { sent: varA.length, accepted: accepted(varA), rate: rateA },
        variantB: { sent: varB.length, accepted: accepted(varB), rate: rateB },
        winner:   (campaign.ab_winner as 'a' | 'b' | null) ?? null,
        sampleOk: varA.length >= minSample && varB.length >= minSample,
      };
    }

    return { success: true, data: { steps, ...(abTest ? { abTest } : {}) } };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// -- saveCampaignAbTest --------------------------------------------------------

export async function saveCampaignAbTest(
  campaignId: string,
  variantA: { connection_note?: string; follow_up_message?: string },
  variantB: { connection_note?: string; follow_up_message?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from('campaigns')
      .update({ ab_test_enabled: true, ab_variant_a: variantA, ab_variant_b: variantB })
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// -- importLeadsFromCsv --------------------------------------------------------

export async function importLeadsFromCsv(
  rows: Array<Record<string, string>>,
  segmentId: string,
  campaignId: string
): Promise<{ success: boolean; imported: number; duplicates: number; errors: number; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { data: seg } = await supabase
      .from("segments")
      .select("id")
      .eq("id", segmentId)
      .eq("workspace_id", workspaceId)
      .single();
    if (!seg) throw new Error("Segmento no encontrado");

    let imported   = 0;
    let duplicates = 0;
    let errors     = 0;

    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);

      const leads = batch.map((row) => {
        const get = (keys: string[]) => {
          for (const k of keys) {
            const match = Object.keys(row).find(
              (col) => col.toLowerCase().trim() === k.toLowerCase()
            );
            if (match && row[match]?.trim()) return row[match].trim();
          }
          return null;
        };

        const firstName = get(["first_name", "nombre", "first name", "nombre1"]);
        const lastName  = get(["last_name", "apellido", "last name", "apellidos"]);
        const fullName  =
          get(["full_name", "name", "nombre completo"]) ??
          ([firstName, lastName].filter(Boolean).join(" ") || "Sin nombre");

        return {
          workspace_id: workspaceId,
          segment_id:   segmentId,
          campaign_id:  campaignId,
          full_name:    fullName,
          email:        get(["email", "correo", "e-mail"]),
          phone:        get(["phone", "telefono", "teléfono", "tel", "mobile"]),
          company:      get(["company", "empresa", "compañia", "compañía", "organization"]),
          headline:     get(["title", "cargo", "job_title", "puesto", "headline"]),
          linkedin_url: get(["linkedin", "linkedin_url", "profile_url", "perfil_linkedin"]),
          crm_column:   "extraido",
          status:       "new",
          score:        5,
          custom_tags:  [] as string[],
          created_at:   new Date().toISOString(),
        };
      });

      const validLeads = leads.filter((l) => l.full_name !== "Sin nombre" || l.email);

      const { data: inserted, error: insertErr } = await supabase
        .from("leads")
        .upsert(validLeads, { onConflict: "workspace_id,linkedin_url", ignoreDuplicates: true })
        .select("id");

      if (insertErr) {
        errors += batch.length;
      } else {
        imported   += inserted?.length ?? 0;
        duplicates += validLeads.length - (inserted?.length ?? 0);
      }
    }

    return { success: true, imported, duplicates, errors };
  } catch (e) {
    return { success: false, imported: 0, duplicates: 0, errors: 0, error: String(e) };
  }
}
