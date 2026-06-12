"use server";

import { createClient } from "@/lib/supabase/server";

type Result<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T };

export type TeamMemberRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  job_title: string | null;
  avatar_gradient: number | null;
  metrics?: {
    leadsAssigned: number;
    conversations: number;
    meetings: number;
    responseRate: number;
  };
};

export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string | null;
  created_at: string;
};

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

export async function getTeamData(): Promise<Result<{
  members: TeamMemberRow[];
  invitations: InvitationRow[];
}>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const [membersRes, invitationsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role, job_title, avatar_gradient")
        .eq("workspace_id", workspaceId),
      supabase
        .from("team_invitations")
        .select("id, email, role, status, expires_at, created_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "pending"),
    ]);

    const memberIds = (membersRes.data ?? []).map((m) => m.id);

    type MetricEntry = { leadsAssigned: number; conversations: number; meetings: number };
    const metricsByUser: Record<string, MetricEntry> = {};

    if (memberIds.length > 0) {
      const [leadsRes, convsRes, meetingsRes] = await Promise.all([
        supabase
          .from("leads")
          .select("assigned_to")
          .eq("workspace_id", workspaceId)
          .in("assigned_to", memberIds),
        supabase
          .from("conversations")
          .select("id")
          .eq("workspace_id", workspaceId)
          .neq("status", "archived"),
        supabase
          .from("leads")
          .select("assigned_to")
          .eq("workspace_id", workspaceId)
          .eq("crm_column", "reunion_agendada")
          .in("assigned_to", memberIds),
      ]);

      for (const lead of leadsRes.data ?? []) {
        if (!lead.assigned_to) continue;
        if (!metricsByUser[lead.assigned_to])
          metricsByUser[lead.assigned_to] = { leadsAssigned: 0, conversations: 0, meetings: 0 };
        metricsByUser[lead.assigned_to].leadsAssigned++;
      }

      for (const lead of meetingsRes.data ?? []) {
        if (!lead.assigned_to) continue;
        if (!metricsByUser[lead.assigned_to])
          metricsByUser[lead.assigned_to] = { leadsAssigned: 0, conversations: 0, meetings: 0 };
        metricsByUser[lead.assigned_to].meetings++;
      }

      const totalConvs = convsRes.data?.length ?? 0;
      const perMember  = memberIds.length > 0 ? Math.floor(totalConvs / memberIds.length) : 0;
      for (const id of memberIds) {
        if (!metricsByUser[id])
          metricsByUser[id] = { leadsAssigned: 0, conversations: 0, meetings: 0 };
        metricsByUser[id].conversations = perMember;
      }
    }

    const membersWithMetrics = (membersRes.data ?? []).map((m) => {
      const mx = metricsByUser[m.id];
      return {
        ...m,
        metrics: {
          leadsAssigned: mx?.leadsAssigned ?? 0,
          conversations: mx?.conversations ?? 0,
          meetings:      mx?.meetings      ?? 0,
          responseRate:  mx?.leadsAssigned
            ? Math.round(((mx?.conversations ?? 0) / mx.leadsAssigned) * 100)
            : 0,
        },
      };
    });

    return {
      success: true,
      data: {
        members:     membersWithMetrics as TeamMemberRow[],
        invitations: (invitationsRes.data ?? []) as InvitationRow[],
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function inviteMember(data: { email: string; role: string }): Promise<Result> {
  try {
    const { supabase, workspaceId, userId } = await getAuthContext();

    // Check: email already an active member of the workspace
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("email", data.email)
      .maybeSingle();

    if (existing) return { success: false, error: "Este email ya es miembro del workspace" };

    // Check: pending invitation already exists
    const { data: existingInv } = await supabase
      .from("team_invitations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("email", data.email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInv) return { success: false, error: "Ya existe una invitación pendiente para este email" };

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("team_invitations")
      .insert({
        workspace_id: workspaceId,
        invited_by:   userId,
        email:        data.email,
        role:         data.role,
        status:       "pending",
        expires_at:   expiresAt,
      });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function revokeInvitation(id: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("team_invitations")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function removeMember(memberId: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    // Remove from workspace by clearing workspace_id on their profile
    const { error } = await supabase
      .from("profiles")
      .update({ workspace_id: null })
      .eq("id", memberId)
      .eq("workspace_id", workspaceId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function updateMemberRole(memberId: string, role: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", memberId)
      .eq("workspace_id", workspaceId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
