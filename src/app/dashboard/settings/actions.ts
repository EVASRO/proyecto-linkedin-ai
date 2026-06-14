"use server";

import { createClient } from "@/lib/supabase/server";

type Result<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T };

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("No autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  return { supabase, userId: user.id, workspaceId: profile?.workspace_id as string ?? "" };
}

// -- Types ---------------------------------------------------------------------

export type WorkspaceSettingsData = {
  workspace_name:       string | null;
  logo_url:             string | null;
  daily_connect_limit:  number;
  daily_message_limit:  number;
  daily_view_limit:     number;
  working_hours_start:  number;
  working_hours_end:    number;
  timezone:             string;
};

export type UserProfileData = {
  id:        string;
  full_name: string | null;
  email:     string | null;
  avatar_url: string | null;
};

export type LinkedInStatusData = {
  connected:         boolean;
  lastSeen:          string | null;
  dailyConnectsSent: number;
  dailyMessagesSent: number;
  dailyViewsSent:    number;
};

export type BlacklistEntry = {
  id:           string;
  linkedin_url: string | null;
  email:        string | null;
  reason:       string | null;
  created_at:   string;
};

// -- getWorkspaceSettings ------------------------------------------------------

export async function getWorkspaceSettings(): Promise<Result<WorkspaceSettingsData>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { data, error } = await supabase
      .from("workspaces")
      .select("workspace_name, logo_url, daily_connect_limit, daily_message_limit, daily_view_limit, working_hours_start, working_hours_end, timezone")
      .eq("id", workspaceId)
      .single();

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: {
        workspace_name:      (data as Record<string, unknown>).workspace_name as string | null ?? null,
        logo_url:            (data as Record<string, unknown>).logo_url as string | null ?? null,
        daily_connect_limit: ((data as Record<string, unknown>).daily_connect_limit as number) ?? 20,
        daily_message_limit: ((data as Record<string, unknown>).daily_message_limit as number) ?? 50,
        daily_view_limit:    ((data as Record<string, unknown>).daily_view_limit as number) ?? 100,
        working_hours_start: ((data as Record<string, unknown>).working_hours_start as number) ?? 9,
        working_hours_end:   ((data as Record<string, unknown>).working_hours_end as number) ?? 18,
        timezone:            ((data as Record<string, unknown>).timezone as string) ?? "America/Lima",
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- saveWorkspaceSettings -----------------------------------------------------

export async function saveWorkspaceSettings(data: {
  workspace_name?:      string;
  logo_url?:            string;
  daily_connect_limit?: number;
  daily_message_limit?: number;
  daily_view_limit?:    number;
  working_hours_start?: number;
  working_hours_end?:   number;
  timezone?:            string;
}): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { error } = await supabase
      .from("workspaces")
      .update(data)
      .eq("id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- getUserProfile ------------------------------------------------------------

export async function getUserProfile(): Promise<Result<UserProfileData>> {
  try {
    const { supabase, userId } = await getAuthContext();

    const [profileRes, userRes] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_url").eq("id", userId).single(),
      supabase.auth.getUser(),
    ]);

    return {
      success: true,
      data: {
        id:         userId,
        full_name:  (profileRes.data as Record<string, unknown> | null)?.full_name as string | null ?? null,
        email:      userRes.data.user?.email ?? null,
        avatar_url: (profileRes.data as Record<string, unknown> | null)?.avatar_url as string | null ?? null,
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- saveUserProfile -----------------------------------------------------------

export async function saveUserProfile(data: {
  full_name?: string;
  avatar_url?: string;
}): Promise<Result> {
  try {
    const { supabase, userId } = await getAuthContext();

    const { error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", userId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- getLinkedInStatus ---------------------------------------------------------

export async function getLinkedInStatus(): Promise<Result<LinkedInStatusData>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const today = new Date().toISOString().split("T")[0];

    const [liRes, connectRes, messageRes, viewRes] = await Promise.all([
      supabase
        .from("linkedin_accounts")
        .select("status, last_synced_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "connected")
        .limit(1),
      supabase
        .from("engine_queue")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("task_type", "connect")
        .eq("status", "done")
        .gte("executed_at", `${today}T00:00:00Z`),
      supabase
        .from("engine_queue")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("task_type", "message")
        .eq("status", "done")
        .gte("executed_at", `${today}T00:00:00Z`),
      supabase
        .from("engine_queue")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("task_type", "view_profile")
        .eq("status", "done")
        .gte("executed_at", `${today}T00:00:00Z`),
    ]);

    const account = liRes.data?.[0] as Record<string, unknown> | undefined;

    return {
      success: true,
      data: {
        connected:         !!account,
        lastSeen:          account?.last_synced_at as string | null ?? null,
        dailyConnectsSent: connectRes.count ?? 0,
        dailyMessagesSent: messageRes.count ?? 0,
        dailyViewsSent:    viewRes.count ?? 0,
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- getBlacklist --------------------------------------------------------------

export async function getBlacklist(): Promise<Result<BlacklistEntry[]>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { data, error } = await supabase
      .from("blacklist")
      .select("id, linkedin_url, email, reason, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as BlacklistEntry[] };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- addToBlacklist ------------------------------------------------------------

export async function addToBlacklist(entry: {
  linkedin_url?: string;
  email?: string;
  reason?: string;
}): Promise<Result<BlacklistEntry>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    if (!entry.linkedin_url && !entry.email) {
      return { success: false, error: "Debe proveer una URL de LinkedIn o un email" };
    }

    const { data, error } = await supabase
      .from("blacklist")
      .insert({
        workspace_id: workspaceId,
        linkedin_url: entry.linkedin_url ?? null,
        email:        entry.email ?? null,
        reason:       entry.reason ?? null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as BlacklistEntry };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- removeFromBlacklist -------------------------------------------------------

export async function removeFromBlacklist(id: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { error } = await supabase
      .from("blacklist")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- testAutopilotWebhook ------------------------------------------------------

export async function testAutopilotWebhook(): Promise<Result<{ draftText?: string; mode?: string }>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { data: conv } = await supabase
      .from("conversations")
      .select("id, lead_id")
      .eq("workspace_id", workspaceId)
      .eq("autopilot_active", true)
      .limit(1)
      .single();

    if (!conv) {
      return { success: false, error: "No hay conversaciones con autopilot activo. Activa el autopilot en una conversación primero." };
    }

    const { data: msg } = await supabase
      .from("messages")
      .insert({
        conversation_id: conv.id,
        lead_id:         (conv as Record<string, unknown>).lead_id,
        workspace_id:    workspaceId,
        sender:          "prospect",
        message_text:    "Hola, ¿en qué consiste tu propuesta?",
        status:          "received",
        is_read:         false,
        timestamp:       new Date().toISOString(),
      })
      .select()
      .single();

    if (!msg) return { success: false, error: "No se pudo crear mensaje de prueba" };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const secret = process.env.AUTOPILOT_WEBHOOK_SECRET ?? "cazary-autopilot-2025";

    const res = await fetch(`${appUrl}/api/autopilot/trigger`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${secret}`,
      },
      body: JSON.stringify({ record: msg }),
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      return { success: false, error: (data.error as string) ?? `HTTP ${res.status}` };
    }

    return {
      success: true,
      data: {
        draftText: data.draftText as string | undefined,
        mode:      data.mode      as string | undefined,
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
