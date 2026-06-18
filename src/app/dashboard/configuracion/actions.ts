"use server";

import { getAuthContext } from "@/lib/auth-context";

// -- Types ---------------------------------------------------------------------

export type LinkedInAccount = {
  id: string;
  name: string | null;
  headline: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  status: "connected" | "disconnected" | "error" | string;
  last_synced_at: string | null;
  error_message: string | null;
};

export type EngineData = {
  status: "running" | "stopped" | "paused" | "error";
  connections_sent: number;
  messages_sent: number;
  actions_count: number;
  last_heartbeat_at: string | null;
  queue_pending: number;
  queue_done_today: number;
  queue_errors_today: number;
};

export type IntegrationsData = {
  linkedInAccount: LinkedInAccount | null;
  engine: EngineData;
};

// -- getIntegrationsData -------------------------------------------------------

export async function getIntegrationsData(): Promise<{
  success: boolean;
  data?: IntegrationsData;
  error?: string;
}> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const todayIso = new Date().toISOString().split("T")[0] + "T00:00:00Z";

    const [liRes, engineRes, pendingRes, doneRes, errorRes] = await Promise.allSettled([
      supabase
        .from("linkedin_accounts")
        .select("id, name, headline, profile_url, avatar_url, status, last_synced_at, error_message")
        .eq("workspace_id", workspaceId)
        .eq("status", "connected")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("ghost_engine_sessions")
        .select("status, connections_sent, messages_sent, actions_count, last_heartbeat_at")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      supabase
        .from("engine_queue")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "pending"),
      supabase
        .from("engine_queue")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "done")
        .gte("executed_at", todayIso),
      supabase
        .from("engine_queue")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "error")
        .gte("executed_at", todayIso),
    ]);

    const liRow = liRes.status === "fulfilled" ? (liRes.value.data?.[0] ?? null) : null;
    const engineRow = engineRes.status === "fulfilled" ? engineRes.value.data : null;
    const pending = pendingRes.status === "fulfilled" ? (pendingRes.value.count ?? 0) : 0;
    const done = doneRes.status === "fulfilled" ? (doneRes.value.count ?? 0) : 0;
    const errors = errorRes.status === "fulfilled" ? (errorRes.value.count ?? 0) : 0;

    // Mostrar el estado real guardado en DB (lo que el usuario eligió).
    // La "conectividad" de la extensión se muestra por separado vía last_heartbeat_at.
    let engineStatus: EngineData["status"] = "stopped";
    if (engineRow) {
      engineStatus = (engineRow.status as EngineData["status"]) ?? "stopped";
    }

    return {
      success: true,
      data: {
        linkedInAccount: liRow
          ? {
              id:             String(liRow.id),
              name:           (liRow.name as string | null) ?? null,
              headline:       (liRow.headline as string | null) ?? null,
              profile_url:    (liRow.profile_url as string | null) ?? null,
              avatar_url:     (liRow.avatar_url as string | null) ?? null,
              status:         (liRow.status as string) ?? "disconnected",
              last_synced_at: (liRow.last_synced_at as string | null) ?? null,
              error_message:  (liRow.error_message as string | null) ?? null,
            }
          : null,
        engine: {
          status:            engineStatus,
          connections_sent:  (engineRow?.connections_sent  as number) ?? 0,
          messages_sent:     (engineRow?.messages_sent     as number) ?? 0,
          actions_count:     (engineRow?.actions_count     as number) ?? 0,
          last_heartbeat_at: (engineRow?.last_heartbeat_at as string) ?? null,
          queue_pending:     pending,
          queue_done_today:  done,
          queue_errors_today: errors,
        },
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- disconnectLinkedIn -------------------------------------------------------

export async function disconnectLinkedIn(): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("linkedin_accounts")
      .update({ status: "disconnected" })
      .eq("workspace_id", workspaceId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- updateEngineStatus -------------------------------------------------------

export async function updateEngineStatus(
  status: "running" | "paused" | "stopped"
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    // UPSERT: crea la fila si no existe, la actualiza si ya existe
    const { error } = await supabase
      .from("ghost_engine_sessions")
      .upsert(
        {
          workspace_id: workspaceId,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id" }
      );
    if (error) return { success: false, error: error.message };

    // Escribir settings_event para que la extensión lo detecte inmediatamente
    await supabase.from("settings_events").insert({
      workspace_id: workspaceId,
      event_type:   status === "running" ? "RESUME_ENGINE" : "PAUSE_ENGINE",
      payload:      { status },
      consumed:     false,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
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

    // upsert: crea la fila si no existe (evita silent-noop de .update())
    const { error } = await supabase
      .from("workspace_settings")
      .upsert(
        { workspace_id: workspaceId, ...settings },
        { onConflict: "workspace_id" }
      );

    if (error) return { success: false, error: error.message };

    // Notificar a la extensión para que recargue settings inmediatamente
    await supabase.from("settings_events").insert({
      workspace_id: workspaceId,
      event_type:   "UPDATE_SETTINGS",
      payload:      settings,
      consumed:     false,
    });

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

