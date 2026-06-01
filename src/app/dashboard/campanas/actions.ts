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
  linkedin_account_id: string | null;
  created_at: string;
};

// ── Auth context helper ───────────────────────────────────────────────────────

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();
  return { supabase, userId: user.id, workspaceId: profile?.workspace_id as string };
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
  workflow_json: Record<string, unknown>
): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    // Derive segment_count and total_leads from embedded segments
    const segments = Array.isArray(workflow_json.segments)
      ? (workflow_json.segments as Array<{ metrics?: { totalLeads?: number } }>)
      : [];
    const segment_count = segments.length;
    const total_leads   = segments.reduce(
      (sum, s) => sum + (s.metrics?.totalLeads ?? 0),
      0
    );

    const { error } = await supabase
      .from("campaigns")
      .update({ workflow_json, segment_count, total_leads })
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

// ── 5. deleteCampaign ─────────────────────────────────────────────────────────

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

// ── 6. duplicateCampaign ──────────────────────────────────────────────────────

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
