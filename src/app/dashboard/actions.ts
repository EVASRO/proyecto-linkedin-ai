"use server";

import { createClient } from "@/lib/supabase/server";

type Result<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T };

export type ActivityRow = {
  id: string;
  action_type: string;
  description: string | null;
  created_at: string;
  metadata: Record<string, string>;
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

export async function getDashboardData(): Promise<Result<{
  leadsCount: number;
  campaignsCount: number;
  activeLeads: number;
  connEstasSemana: number;
  tasaAceptacion: number;
  enConversacion: number;
  recentActivity: ActivityRow[];
  recentCampaigns: { name: string; status: string; total_leads: number; type: string }[];
  engineSession: Record<string, unknown> | null;
}>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const [leadsRes, campaignsRes, activeLeadsRes, activityRes, engineRes, weeklyRes] = await Promise.all([
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
      supabase
        .from("campaigns")
        .select("id, name, status, total_leads, type")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("leads")
        .select("id, crm_column")
        .eq("workspace_id", workspaceId)
        .in("crm_column", ["conexion_enviada", "conexion_aceptada", "en_conversacion"]),
      supabase
        .from("activity_log")
        .select("id, action_type, description, created_at, metadata")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("ghost_engine_sessions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .single(),
      supabase
        .from("leads")
        .select("id, crm_column, connection_sent_at")
        .eq("workspace_id", workspaceId)
        .gte("connection_sent_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    ]);

    const campaigns   = (campaignsRes.data ?? []) as { name: string; status: string; total_leads: number; type: string }[];
    const activeLeads = activeLeadsRes.data ?? [];
    const weeklyLeads = weeklyRes.data ?? [];

    const connEnviadas  = weeklyLeads.filter(l => l.crm_column !== 'extraido').length;
    const connAceptadas = activeLeads.filter(l =>
      ['conexion_aceptada', 'en_conversacion', 'reunion_agendada', 'cliente'].includes(l.crm_column)
    ).length;
    const tasaAceptacion = connEnviadas > 0 ? Math.round(connAceptadas / connEnviadas * 100) : 0;
    const enConversacion = activeLeads.filter(l => l.crm_column === 'en_conversacion').length;

    let recentActivity = (activityRes.data ?? []) as ActivityRow[];

    if (recentActivity.length === 0) {
      const { data: queueDone } = await supabase
        .from("engine_queue")
        .select("id, action_type, task_type, executed_at, payload")
        .eq("workspace_id", workspaceId)
        .eq("status", "done")
        .order("executed_at", { ascending: false })
        .limit(10);

      recentActivity = (queueDone ?? []).map((t) => {
        const actionType = (t.action_type ?? t.task_type ?? "connect") as string;
        const description =
          actionType === "connect" ? "Solicitud de conexión enviada en LinkedIn"
          : actionType === "message" ? "Mensaje enviado en LinkedIn"
          : "Acción ejecutada por Ghost Engine";
        return {
          id:          String(t.id),
          action_type: actionType,
          description,
          created_at:  (t.executed_at as string | null) ?? new Date().toISOString(),
          metadata:    { lead_id: ((t.payload as Record<string, unknown>)?.lead_id as string) ?? "" },
        };
      });
    }

    return {
      success: true,
      data: {
        leadsCount:      leadsRes.count ?? 0,
        campaignsCount:  campaigns.length,
        activeLeads:     activeLeads.length,
        connEstasSemana: connEnviadas,
        tasaAceptacion,
        enConversacion,
        recentActivity,
        recentCampaigns: campaigns.slice(0, 3),
        engineSession:   (engineRes.data as Record<string, unknown>) ?? null,
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── getGhostEngineStatus ──────────────────────────────────────────────────────

export type GhostEngineSession = {
  status: 'running' | 'stopped' | 'paused';
  connections_sent: number;
  messages_sent: number;
  actions_count: number;
  last_heartbeat_at: string | null;
  metadata: Record<string, unknown>;
};

export async function getGhostEngineStatus(): Promise<Result<GhostEngineSession>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { data, error } = await supabase
      .from("ghost_engine_sessions")
      .select("status, connections_sent, messages_sent, actions_count, last_heartbeat_at, metadata")
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !data) {
      return {
        success: true,
        data: {
          status: 'stopped',
          connections_sent: 0,
          messages_sent: 0,
          actions_count: 0,
          last_heartbeat_at: null,
          metadata: {},
        },
      };
    }

    const lastBeat = data.last_heartbeat_at ? new Date(data.last_heartbeat_at).getTime() : 0;
    const stale = Date.now() - lastBeat > 5 * 60 * 1000;
    const effectiveStatus = stale ? 'stopped' : (data.status as GhostEngineSession['status']);

    return {
      success: true,
      data: {
        status: effectiveStatus,
        connections_sent: data.connections_sent ?? 0,
        messages_sent:    data.messages_sent    ?? 0,
        actions_count:    data.actions_count    ?? 0,
        last_heartbeat_at: data.last_heartbeat_at,
        metadata: (data.metadata as Record<string, unknown>) ?? {},
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
