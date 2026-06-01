"use server";

import { createClient } from "@/lib/supabase/server";

// ── Shared result type ────────────────────────────────────────────────────────

type Result<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T };

// ── Helper: get authenticated user + workspace_id ─────────────────────────────

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("No autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  if (!profile?.workspace_id) {
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

// ── Types ─────────────────────────────────────────────────────────────────────

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
};

// ── 1. getProfileData ─────────────────────────────────────────────────────────

export async function getProfileData(): Promise<Result<ProfileData>> {
  try {
    const { supabase, userId, workspaceId } = await getAuthContext();

    const [profileRes, workspaceRes, settingsRes, liRes, emailRes, webhookRes] =
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
      ]);

    if (profileRes.error) return { success: false, error: profileRes.error.message };

    return {
      success: true,
      data: {
        profile:         profileRes.data as ProfileRow,
        workspace:       workspaceRes.data as WorkspaceRow | null,
        settings:        settingsRes.data as WorkspaceSettingsRow | null,
        linkedinAccounts: (liRes.data ?? []) as LinkedInAccountRow[],
        emailConnections: (emailRes.data ?? []) as EmailConnectionRow[],
        webhooks:         (webhookRes.data ?? []) as WebhookRow[],
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── 2. updateProfile ──────────────────────────────────────────────────────────

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

// ── 3. updateWorkspace ────────────────────────────────────────────────────────

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

// ── 4. upsertLinkedInAccount ──────────────────────────────────────────────────

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

// ── 5. disconnectLinkedInAccount ──────────────────────────────────────────────

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

// ── 6. upsertEmailConnection ──────────────────────────────────────────────────

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

// ── 7. deleteEmailConnection ──────────────────────────────────────────────────

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

// ── 8. upsertWebhook ──────────────────────────────────────────────────────────

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

// ── 9. deleteWebhook ──────────────────────────────────────────────────────────

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
