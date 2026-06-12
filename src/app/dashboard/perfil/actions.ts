"use server";

import { createClient } from "@/lib/supabase/server";

// -- Shared result type --------------------------------------------------------

type Result<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T };

// -- Helper: get authenticated user + workspace_id -----------------------------

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

// -- Types ---------------------------------------------------------------------

export type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  job_title: string | null;
  company: string | null;
  phone: string | null;
  avatar_gradient: number | null;
  workspace_id: string | null;
};

export type WorkspaceRow = {
  id: string;
  name: string;
  plan_type: string | null;
  logo_url: string | null;
};

export type WorkspaceSettingsRow = {
  workspace_id: string;
  timezone: string | null;
  daily_connections_limit: number | null;
  daily_messages_limit: number | null;
  ultra_safe_mode: boolean | null;
  pause_on_weekends: boolean | null;
  active_hours_start: number | null;
  active_hours_end: number | null;
};

export type LinkedInAccountRow = {
  id: string;
  workspace_id: string | null;
  name: string | null;
  profile_url: string | null;
  headline: string | null;
  avatar_url: string | null;
  li_at_cookie: string | null;
  connection_mode: string | null;
  status: string | null;
  daily_connection_limit: number | null;
  daily_message_limit: number | null;
};

export type EmailConnectionRow = {
  id: string;
  workspace_id: string | null;
  provider: string | null;
  display_name: string | null;
  email_from: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  status: string | null;
  is_default: boolean | null;
};

export type WebhookRow = {
  id: string;
  workspace_id: string | null;
  name: string | null;
  url: string | null;
  events: string[] | null;
  is_active: boolean | null;
  secret_token: string | null;
};

export type ProfileData = {
  profile: ProfileRow;
  workspace: WorkspaceRow | null;
  settings: WorkspaceSettingsRow | null;
  linkedinAccounts: LinkedInAccountRow[];
  emailConnections: EmailConnectionRow[];
  webhooks: WebhookRow[];
  blacklist: BlacklistEntryRow[];
};

export type BlacklistEntryRow = {
  id: string;
  workspace_id: string | null;
  linkedin_url: string | null;
  email: string | null;
  reason: string | null;
  created_at: string;
};

// -- 1. getProfileData ---------------------------------------------------------

export async function getProfileData(): Promise<Result<ProfileData>> {
  try {
    const { supabase, userId, workspaceId } = await getAuthContext();

    const [profileRes, workspaceRes, settingsRes, liRes, emailRes, webhookRes, blacklistRes] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        workspaceId
          ? supabase.from("workspaces").select("*").eq("id", workspaceId).single()
          : Promise.resolve({ data: null, error: null }),
        workspaceId
          ? supabase.from("workspace_settings").select("*").eq("workspace_id", workspaceId).single()
          : Promise.resolve({ data: null, error: null }),
        workspaceId
          ? supabase.from("linkedin_accounts").select("*").eq("workspace_id", workspaceId).order("created_at")
          : Promise.resolve({ data: [], error: null }),
        workspaceId
          ? supabase.from("email_connections").select("*").eq("workspace_id", workspaceId).order("created_at")
          : Promise.resolve({ data: [], error: null }),
        workspaceId
          ? supabase.from("webhooks").select("*").eq("workspace_id", workspaceId).order("created_at")
          : Promise.resolve({ data: [], error: null }),
        workspaceId
          ? supabase.from("blacklist").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (profileRes.error) return { success: false, error: profileRes.error.message };

    return {
      success: true,
      data: {
        profile:          profileRes.data as ProfileRow,
        workspace:        workspaceRes.data as WorkspaceRow | null,
        settings:         settingsRes.data as WorkspaceSettingsRow | null,
        linkedinAccounts: (liRes.data ?? []) as LinkedInAccountRow[],
        emailConnections: (emailRes.data ?? []) as EmailConnectionRow[],
        webhooks:         (webhookRes.data ?? []) as WebhookRow[],
        blacklist:        (blacklistRes.data ?? []) as BlacklistEntryRow[],
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 2. updateProfile ----------------------------------------------------------

export async function updateProfile(data: {
  full_name: string;
  job_title: string;
  company: string;
  phone: string;
  avatar_gradient: number;
}): Promise<Result> {
  try {
    const { supabase, userId } = await getAuthContext();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name:       data.full_name,
        job_title:       data.job_title,
        company:         data.company,
        phone:           data.phone,
        avatar_gradient: data.avatar_gradient,
      })
      .eq("id", userId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 3. updateWorkspace --------------------------------------------------------

export async function updateWorkspace(data: {
  name: string;
  timezone: string;
}): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const [wsResult, settingsResult] = await Promise.all([
      supabase.from("workspaces").update({ name: data.name }).eq("id", workspaceId),
      supabase.from("workspace_settings").upsert(
        { workspace_id: workspaceId, timezone: data.timezone },
        { onConflict: "workspace_id" }
      ),
    ]);

    const error = wsResult.error ?? settingsResult.error;
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 4. upsertLinkedInAccount --------------------------------------------------

export async function upsertLinkedInAccount(data: {
  id?: string;
  name: string;
  li_at_cookie: string;
  connection_mode: "extension" | "cookie";
}): Promise<Result<LinkedInAccountRow>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    let result;
    if (data.id) {
      result = await supabase
        .from("linkedin_accounts")
        .update({
          name:            data.name,
          li_at_cookie:    data.li_at_cookie,
          connection_mode: data.connection_mode,
          status:          "connected",
        })
        .eq("id", data.id)
        .eq("workspace_id", workspaceId)
        .select()
        .single();
    } else {
      result = await supabase
        .from("linkedin_accounts")
        .insert({
          workspace_id:    workspaceId,
          name:            data.name,
          li_at_cookie:    data.li_at_cookie,
          connection_mode: data.connection_mode,
          status:          "connected",
        })
        .select()
        .single();
    }

    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data as LinkedInAccountRow };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 4b. updateLinkedInLimits --------------------------------------------------

export async function updateLinkedInLimits(data: {
  id: string;
  daily_connection_limit: number;
  daily_message_limit: number;
}): Promise<Result<LinkedInAccountRow>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { data: updated, error } = await supabase
      .from("linkedin_accounts")
      .update({
        daily_connection_limit: data.daily_connection_limit,
        daily_message_limit:    data.daily_message_limit,
      })
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: updated as LinkedInAccountRow };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 5. disconnectLinkedInAccount ----------------------------------------------

export async function disconnectLinkedInAccount(id: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { error } = await supabase
      .from("linkedin_accounts")
      .update({ status: "disconnected", li_at_cookie: null })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 6. upsertEmailConnection --------------------------------------------------

export async function upsertEmailConnection(data: {
  id?: string;
  provider: string;
  email_from: string;
  display_name: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  is_default?: boolean;
}): Promise<Result<EmailConnectionRow>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    // Si es default, primero quitar el default de los demás
    if (data.is_default) {
      await supabase
        .from("email_connections")
        .update({ is_default: false })
        .eq("workspace_id", workspaceId);
    }

    const payload = {
      workspace_id:  workspaceId,
      provider:      data.provider,
      email_from:    data.email_from,
      display_name:  data.display_name,
      smtp_host:     data.smtp_host ?? null,
      smtp_port:     data.smtp_port ?? null,
      smtp_user:     data.smtp_user ?? null,
      smtp_password: data.smtp_password ?? null,
      is_default:    data.is_default ?? false,
      status:        "connected",
    };

    let result;
    if (data.id) {
      result = await supabase
        .from("email_connections")
        .update(payload)
        .eq("id", data.id)
        .eq("workspace_id", workspaceId)
        .select()
        .single();
    } else {
      result = await supabase
        .from("email_connections")
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data as EmailConnectionRow };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 7. deleteEmailConnection --------------------------------------------------

export async function deleteEmailConnection(id: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { error } = await supabase
      .from("email_connections")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 8. upsertWebhook ----------------------------------------------------------

export async function upsertWebhook(data: {
  id?: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
}): Promise<Result<WebhookRow>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const payload = {
      workspace_id: workspaceId,
      name:         data.name,
      url:          data.url,
      events:       data.events,
      is_active:    data.is_active,
    };

    let result;
    if (data.id) {
      result = await supabase
        .from("webhooks")
        .update(payload)
        .eq("id", data.id)
        .eq("workspace_id", workspaceId)
        .select()
        .single();
    } else {
      result = await supabase
        .from("webhooks")
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data as WebhookRow };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 9. deleteWebhook ----------------------------------------------------------

export async function deleteWebhook(id: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { error } = await supabase
      .from("webhooks")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 10. verifyLinkedInConnection ----------------------------------------------

export type HeartbeatStatus = "active" | "inactive" | "not_found";

export async function verifyLinkedInConnection(accountId: string): Promise<
  Result<{ status: HeartbeatStatus; last_heartbeat_at: string | null }>
> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { data, error } = await supabase
      .from("ghost_engine_sessions")
      .select("last_heartbeat_at")
      .eq("workspace_id", workspaceId)
      .eq("linkedin_account_id", accountId)
      .order("last_heartbeat_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: true, data: { status: "not_found", last_heartbeat_at: null } };

    const lastHb = data.last_heartbeat_at as string | null;
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const status: HeartbeatStatus = lastHb && lastHb > fiveMinsAgo ? "active" : "inactive";
    return { success: true, data: { status, last_heartbeat_at: lastHb } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 11. updateWorkspaceSettings -----------------------------------------------

export async function updateWorkspaceSettings(data: {
  daily_connections_limit?: number;
  daily_messages_limit?: number;
  daily_visits_limit?: number;
  ultra_safe_mode?: boolean;
  pause_on_weekends?: boolean;
  active_hours_start?: number;
  active_hours_end?: number;
  timezone?: string;
  warmup_enabled?: boolean;
}): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { error } = await supabase
      .from("workspace_settings")
      .upsert({ workspace_id: workspaceId, ...data }, { onConflict: "workspace_id" });

    if (error) return { success: false, error: error.message };

    // Notify extension via settings_events table (best-effort)
    try {
      await supabase
        .from("settings_events")
        .insert({
          workspace_id: workspaceId,
          event_type:   "SAVE_SETTINGS",
          payload:      data,
        });
    } catch {
      // intentionally ignored
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 12. getBlacklistEntries ---------------------------------------------------

export async function getBlacklistEntries(): Promise<Result<BlacklistEntryRow[]>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { data, error } = await supabase
      .from("blacklist")
      .select("id, workspace_id, linkedin_url, email, reason, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as BlacklistEntryRow[] };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 13. addBlacklistEntry -----------------------------------------------------

export async function addBlacklistEntry(entry: {
  linkedin_url?: string;
  email?: string;
  reason?: string;
}): Promise<Result<BlacklistEntryRow>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    if (!entry.linkedin_url && !entry.email) {
      return { success: false, error: "Debe proveer URL de LinkedIn o email" };
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
    return { success: true, data: data as BlacklistEntryRow };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 14. bulkAddBlacklistEntries -----------------------------------------------

export async function bulkAddBlacklistEntries(
  lines: string[]
): Promise<Result<{ inserted: number; skipped: number }>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const rows: { workspace_id: string; linkedin_url: string | null; email: string | null }[] = [];

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const isLinkedIn = line.includes("linkedin.com") || line.includes("/in/");
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line);
      if (isLinkedIn) rows.push({ workspace_id: workspaceId, linkedin_url: line, email: null });
      else if (isEmail) rows.push({ workspace_id: workspaceId, linkedin_url: null, email: line });
    }

    if (rows.length === 0) return { success: true, data: { inserted: 0, skipped: lines.length } };

    const { error, data } = await supabase
      .from("blacklist")
      .upsert(rows, { onConflict: "workspace_id,linkedin_url", ignoreDuplicates: true })
      .select("id");

    if (error) return { success: false, error: error.message };
    return { success: true, data: { inserted: (data ?? []).length, skipped: lines.length - (data ?? []).length } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 15. removeBlacklistEntry --------------------------------------------------

export async function removeBlacklistEntry(id: string): Promise<Result> {
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

// -- 16. testWebhookDelivery ---------------------------------------------------

export async function testWebhookDelivery(
  webhookId: string
): Promise<Result<{ httpStatus: number; body: string }>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { data: wh, error } = await supabase
      .from("webhooks")
      .select("url, secret_token")
      .eq("id", webhookId)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !wh) return { success: false, error: "Webhook no encontrado" };

    const url = (wh as Record<string, unknown>).url as string;
    const secret = (wh as Record<string, unknown>).secret_token as string | null;

    const payload = {
      event:        "test",
      workspace_id: workspaceId,
      timestamp:    new Date().toISOString(),
      data:         { message: "NexusAI webhook test" },
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) headers["X-NexusAI-Signature"] = secret;

    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    const body = await res.text().catch(() => "");

    return { success: true, data: { httpStatus: res.status, body: body.slice(0, 500) } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
