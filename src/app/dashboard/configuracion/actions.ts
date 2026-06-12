"use server";

import { createClient } from "@/lib/supabase/server";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();
  return { supabase, workspaceId: profile?.workspace_id ?? "", userId: user.id };
}

// -- Types ---------------------------------------------------------------------

export type WorkspaceSettingsRow = {
  workspace_id: string;
  daily_connections_limit: number | null;
  daily_messages_limit: number | null;
  ultra_safe_mode: boolean | null;
  pause_on_weekends: boolean | null;
  active_hours_start: number | null;
  active_hours_end: number | null;
  timezone: string | null;
};

export type WebhookRow = {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret_token: string | null;
};

// -- getConfigData -------------------------------------------------------------

export async function getConfigData(): Promise<{
  success: boolean;
  data?: { settings: WorkspaceSettingsRow | null; webhooks: WebhookRow[] };
  error?: string;
}> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const [settingsRes, webhooksRes] = await Promise.all([
      supabase
        .from("workspace_settings")
        .select("*")
        .eq("workspace_id", workspaceId)
        .single(),
      supabase
        .from("webhooks")
        .select("*")
        .eq("workspace_id", workspaceId),
    ]);

    return {
      success: true,
      data: {
        settings: settingsRes.data as WorkspaceSettingsRow | null,
        webhooks: (webhooksRes.data ?? []) as WebhookRow[],
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- saveSettings --------------------------------------------------------------

export async function saveSettings(settings: {
  daily_connections_limit?: number;
  daily_messages_limit?: number;
  ultra_safe_mode?: boolean;
  pause_on_weekends?: boolean;
  active_hours_start?: number;
  active_hours_end?: number;
  timezone?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("workspace_settings")
      .update(settings)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- upsertWebhook -------------------------------------------------------------

export async function upsertWebhook(webhook: {
  id?: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret?: string;
}): Promise<{ success: boolean; error?: string; data?: WebhookRow }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const payload = {
      workspace_id: workspaceId,
      name:         webhook.name,
      url:          webhook.url,
      events:       webhook.events,
      is_active:    webhook.is_active,
      secret_token: webhook.secret ?? crypto.randomUUID(),
    };

    let result;
    if (webhook.id) {
      result = await supabase
        .from("webhooks")
        .update(payload)
        .eq("id", webhook.id)
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

// -- deleteWebhook -------------------------------------------------------------

export async function deleteWebhook(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
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

// -- toggleWebhookActive -------------------------------------------------------

export async function toggleWebhookActive(
  id: string,
  is_active: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("webhooks")
      .update({ is_active })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
