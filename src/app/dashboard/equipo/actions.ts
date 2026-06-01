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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();
  return { supabase, userId: user.id, workspaceId: profile?.workspace_id as string };
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

    return {
      success: true,
      data: {
        members:     (membersRes.data     ?? []) as TeamMemberRow[],
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
    const { error } = await supabase
      .from("team_invitations")
      .insert({
        workspace_id: workspaceId,
        invited_by:   userId,
        email:        data.email,
        role:         data.role,
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
