"use server";

import { createClient } from "@/lib/supabase/server";

// ── Shared result type ────────────────────────────────────────────────────────

type Result<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T };

// ── Exported types ────────────────────────────────────────────────────────────

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
  created_at: string;
};

// ── Auth context helper ───────────────────────────────────────────────────────

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

// ── 1. getCampaignsData ───────────────────────────────────────────────────────

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

    return {
      success: true,
      data: {
        campaigns:       (campaignsRes.data ?? []) as CampaignRow[],
        linkedinAccounts: (liRes.data ?? []) as { id: string; name: string; status: string }[],
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── 2. createCampaign ─────────────────────────────────────────────────────────

export async function createCampaign(data: {
  name: string;
  type: string;
  linkedin_account_id?: string;
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
        workflow_json:       {},
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

// ── 3. updateCampaignWorkflow ─────────────────────────────────────────────────

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
      ? (merged.segments as Array<{ metrics?: { totalLeads?: number } }>)
      : [];

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
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── 4. updateCampaignStatus ───────────────────────────────────────────────────

export async function updateCampaignStatus(
  id: string,
  status: "draft" | "active" | "paused" | "completed"
): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("campaigns")
      .update({ status })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── 5. archiveCampaign ───────────────────────────────────────────────────────

export async function archiveCampaign(id: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("campaigns")
      .update({ status: "archived" })
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── 6. deleteCampaign ─────────────────────────────────────────────────────────

export async function deleteCampaign(id: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── 6. launchCampaign ────────────────────────────────────────────────────────

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

    // Activate all segments in workflow_json regardless of current campaign status
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

    // Bug 1: already active → activate segments and return success (not error)
    if (campaign.status === "active") {
      await supabase
        .from("campaigns")
        .update({ workflow_json: updatedWorkflow })
        .eq("id", campaignId)
        .eq("workspace_id", workspaceId);
      return { success: true, data: { queued: 0 } };
    }

    const { data: leads } = await supabase
      .from("leads")
      .select("id, linkedin_url, full_name")
      .eq("workspace_id", workspaceId)
      .in("status", ["nuevo", "pendiente"])
      .not("linkedin_url", "is", null)
      .limit(100);

    if (!leads || leads.length === 0) {
      await supabase
        .from("campaigns")
        .update({ status: "active", workflow_json: updatedWorkflow })
        .eq("id", campaignId)
        .eq("workspace_id", workspaceId);
      await supabase.from("engine_queue").insert({
        workspace_id: workspaceId,
        task_type:    "start_campaign_scraping",
        action_type:  "start_campaign_scraping",
        payload:      { campaign_id: campaignId },
        status:       "pending",
        scheduled_at: now,
      });
      return { success: true, data: { queued: 0 } };
    }

    const connectionMessage = (campaign.workflow_json as Record<string, unknown>)?.connection_message as string ?? "";

    const tasks = leads.map((lead, i) => ({
      workspace_id: workspaceId,
      campaign_id:  campaignId,
      lead_id:      lead.id,
      task_type:    "connect",
      action_type:  "connect",
      payload: {
        profile_url:   lead.linkedin_url,
        linkedin_url:  lead.linkedin_url,
        lead_id:       lead.id,
        lead_name:     lead.full_name,
        campaign_name: campaign.name,
        campaign_id:   campaignId,
        note:          connectionMessage,
        message_text:  connectionMessage,
      },
      status:       "pending",
      scheduled_at: new Date(Date.now() + i * 4 * 60 * 1000).toISOString(),
    }));

    const { error: queueErr } = await supabase.from("engine_queue").insert(tasks);
    if (queueErr) return { success: false, error: queueErr.message };

    await supabase
      .from("campaigns")
      .update({ status: "active", total_leads: leads.length, workflow_json: updatedWorkflow })
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId);

    // Trigger scraping via Ghost Engine
    await supabase.from("engine_queue").insert({
      workspace_id: workspaceId,
      action_type:  "start_campaign_scraping",
      payload:      { campaign_id: campaignId },
      status:       "pending",
      scheduled_at: now,
    });

    return { success: true, data: { queued: leads.length } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── 7. duplicateCampaign ──────────────────────────────────────────────────────

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

// ── 8. getActiveCampaignStats ─────────────────────────────────────────────────

export type CampaignStats = {
  id: string;
  status: string;
  leads_total: number;
  leads_queued: number;
};

export async function getActiveCampaignStats(
  campaignId: string
): Promise<Result<CampaignStats>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, status, leads_total, leads_queued")
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as CampaignStats };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
