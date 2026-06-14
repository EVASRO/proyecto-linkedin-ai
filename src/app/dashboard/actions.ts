"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth-context";

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

// -- getDashboardMetrics -------------------------------------------------------

export type KpiMetrics = {
  connectsToday: number;
  acceptanceRate: number;       // 0–100, 1 decimal
  messagesToday: number;
  inConversation: number;
};

export type ActivityPoint = {
  date: string;    // "DD/MM"
  connects: number;
  messages: number;
};

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  convRate: number;  // % from previous stage, 1 decimal
};

export type ActivityFeedRow = {
  id: string;
  action_type: string;
  description: string | null;
  lead_name: string | null;
  created_at: string;
};

export type EngineStatus = {
  status: 'running' | 'stopped' | 'paused';
  connections_sent: number;
  messages_sent: number;
  actions_count: number;
  last_heartbeat_at: string | null;
  metadata: Record<string, unknown>;
};

export type DashboardMetrics = {
  kpis: KpiMetrics;
  activityChart: ActivityPoint[];   // last 14 days
  funnel: FunnelStage[];
  feed: ActivityFeedRow[];          // last 10 actions
  engine: EngineStatus;
  // kept for existing sections
  leadsCount: number;
  campaignsCount: number;
  recentCampaigns: { name: string; status: string; total_leads: number; type: string }[];
};

export async function getDashboardMetrics(): Promise<Result<DashboardMetrics>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();

    const [
      connectsTodayRes,
      messagesTodayRes,
      funnelRes,
      chartRes,
      feedRes,
      engineRes,
      leadsCountRes,
      campaignsRes,
    ] = await Promise.allSettled([
      // 1. Connections sent today by Ghost Engine
      supabase
        .from("engine_queue")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .in("action_type", ["connect", "connection_request"])
        .eq("status", "done")
        .gte("executed_at", todayIso),

      // 2. Messages sent today
      supabase
        .from("engine_queue")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("action_type", "message")
        .eq("status", "done")
        .gte("executed_at", todayIso),

      // 3. Full funnel counts from leads.crm_column
      supabase
        .from("leads")
        .select("crm_column")
        .eq("workspace_id", workspaceId),

      // 4. Activity chart — last 14 days of engine_queue done tasks
      supabase
        .from("engine_queue")
        .select("action_type, executed_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "done")
        .gte("executed_at", fourteenDaysAgo)
        .order("executed_at", { ascending: true }),

      // 5. Activity feed — last 10 from activity_log with lead name
      supabase
        .from("activity_log")
        .select("id, action_type, description, created_at, lead_id")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(10),

      // 6. Ghost Engine session
      supabase
        .from("ghost_engine_sessions")
        .select("status, connections_sent, messages_sent, actions_count, last_heartbeat_at, metadata")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),

      // 7. Total leads count
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),

      // 8. Recent campaigns
      supabase
        .from("campaigns")
        .select("id, name, status, total_leads, type")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    // -- 1 & 2: KPI – connects/messages today ---------------------------------
    const connectsToday = connectsTodayRes.status === "fulfilled"
      ? (connectsTodayRes.value.count ?? 0)
      : 0;
    const messagesToday = messagesTodayRes.status === "fulfilled"
      ? (messagesTodayRes.value.count ?? 0)
      : 0;

    // -- 3: Funnel from leads table --------------------------------------------
    const allLeads = funnelRes.status === "fulfilled"
      ? (funnelRes.value.data ?? [])
      : [];

    const countBy = (col: string) =>
      allLeads.filter((l) => l.crm_column === col).length;

    const extraidos  = countBy("extraido");
    const enviadas   = countBy("conexion_enviada");
    const aceptadas  = countBy("conexion_aceptada");
    const enConv     = countBy("en_conversacion");
    const reuniones  = countBy("reunion_agendada");
    const clientes   = countBy("cliente");

    // Acceptance rate: aceptadas / (enviadas + aceptadas + beyond) * 100
    const totalSent = enviadas + aceptadas + enConv + reuniones + clientes;
    const totalAccepted = aceptadas + enConv + reuniones + clientes;
    const acceptanceRate = totalSent > 0
      ? Math.round((totalAccepted / totalSent) * 1000) / 10
      : 0;

    const conv = (n: number, from: number) =>
      from > 0 ? Math.round((n / from) * 1000) / 10 : 0;

    const funnel: FunnelStage[] = [
      { key: "extraido",          label: "Extraídos",          count: extraidos, convRate: 100         },
      { key: "conexion_enviada",  label: "Conexión enviada",   count: enviadas,  convRate: conv(enviadas,  extraidos)  },
      { key: "conexion_aceptada", label: "Conexión aceptada",  count: aceptadas, convRate: conv(aceptadas, enviadas)   },
      { key: "en_conversacion",   label: "En conversación",    count: enConv,    convRate: conv(enConv,    aceptadas)  },
      { key: "reunion_agendada",  label: "Reunión agendada",   count: reuniones, convRate: conv(reuniones, enConv)     },
      { key: "cliente",           label: "Cliente",            count: clientes,  convRate: conv(clientes,  reuniones)  },
    ];

    // -- 4: Activity chart (14 days) -------------------------------------------
    const chartRows = chartRes.status === "fulfilled"
      ? (chartRes.value.data ?? [])
      : [];

    const dayMap = new Map<string, { connects: number; messages: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { connects: 0, messages: 0 });
    }
    for (const row of chartRows) {
      const key = (row.executed_at as string | null)?.slice(0, 10);
      if (!key || !dayMap.has(key)) continue;
      const entry = dayMap.get(key)!;
      const at = row.action_type as string;
      if (at === "connect" || at === "connection_request") entry.connects++;
      else if (at === "message") entry.messages++;
    }
    const activityChart: ActivityPoint[] = [...dayMap.entries()].map(([iso, v]) => {
      const [, mm, dd] = iso.split("-");
      return { date: `${dd}/${mm}`, connects: v.connects, messages: v.messages };
    });

    // -- 5: Activity feed — enrich with lead names -----------------------------
    const feedRows = feedRes.status === "fulfilled"
      ? (feedRes.value.data ?? [])
      : [];

    // Batch-fetch lead names for any lead_id present
    const leadIds = [...new Set(
      feedRows
        .map((r) => (r as Record<string, unknown>).lead_id as string | null)
        .filter((id): id is string => !!id)
    )];

    const leadNameMap = new Map<string, string>();
    if (leadIds.length > 0) {
      const { data: leadRows } = await supabase
        .from("leads")
        .select("id, full_name")
        .in("id", leadIds)
        .eq("workspace_id", workspaceId);
      for (const l of leadRows ?? []) {
        leadNameMap.set(l.id, l.full_name ?? "");
      }
    }

    // Fallback: if activity_log is empty use engine_queue
    let feed: ActivityFeedRow[];
    if (feedRows.length > 0) {
      feed = feedRows.map((r) => {
        const rr = r as Record<string, unknown>;
        return {
          id:          String(rr.id),
          action_type: String(rr.action_type ?? ""),
          description: (rr.description as string | null) ?? null,
          lead_name:   leadNameMap.get(rr.lead_id as string) ?? null,
          created_at:  String(rr.created_at ?? ""),
        };
      });
    } else {
      const { data: queueDone } = await supabase
        .from("engine_queue")
        .select("id, action_type, task_type, executed_at, payload")
        .eq("workspace_id", workspaceId)
        .eq("status", "done")
        .order("executed_at", { ascending: false })
        .limit(10);

      const queueLeadIds = [...new Set(
        (queueDone ?? [])
          .map((t) => ((t.payload as Record<string, unknown>)?.lead_id as string | null))
          .filter((id): id is string => !!id)
      )];
      if (queueLeadIds.length > 0) {
        const { data: ql } = await supabase
          .from("leads")
          .select("id, full_name")
          .in("id", queueLeadIds)
          .eq("workspace_id", workspaceId);
        for (const l of ql ?? []) leadNameMap.set(l.id, l.full_name ?? "");
      }

      feed = (queueDone ?? []).map((t) => {
        const at = (t.action_type ?? t.task_type ?? "connect") as string;
        const leadId = ((t.payload as Record<string, unknown>)?.lead_id as string) ?? null;
        return {
          id:          String(t.id),
          action_type: at,
          description: at === "connect" ? "Solicitud de conexión enviada"
                     : at === "message" ? "Mensaje enviado"
                     : "Acción ejecutada",
          lead_name:   leadId ? (leadNameMap.get(leadId) ?? null) : null,
          created_at:  (t.executed_at as string | null) ?? new Date().toISOString(),
        };
      });
    }

    // -- 6: Engine -------------------------------------------------------------
    const engineRow = engineRes.status === "fulfilled"
      ? (engineRes.value.data as Record<string, unknown> | null)
      : null;

    let engine: EngineStatus;
    if (engineRow) {
      const lastBeat = engineRow.last_heartbeat_at
        ? new Date(engineRow.last_heartbeat_at as string).getTime()
        : 0;
      const stale = Date.now() - lastBeat > 5 * 60_000;
      engine = {
        status:            stale ? "stopped" : (engineRow.status as EngineStatus["status"] ?? "stopped"),
        connections_sent:  (engineRow.connections_sent  as number) ?? 0,
        messages_sent:     (engineRow.messages_sent     as number) ?? 0,
        actions_count:     (engineRow.actions_count     as number) ?? 0,
        last_heartbeat_at: (engineRow.last_heartbeat_at as string) ?? null,
        metadata:          (engineRow.metadata as Record<string, unknown>) ?? {},
      };
    } else {
      engine = { status: "stopped", connections_sent: 0, messages_sent: 0, actions_count: 0, last_heartbeat_at: null, metadata: {} };
    }

    // -- 7 & 8: Counts ---------------------------------------------------------
    const leadsCount    = leadsCountRes.status === "fulfilled" ? (leadsCountRes.value.count ?? 0) : 0;
    const campaigns     = campaignsRes.status === "fulfilled"  ? (campaignsRes.value.data ?? [])  : [];

    return {
      success: true,
      data: {
        kpis: { connectsToday, acceptanceRate, messagesToday, inConversation: enConv },
        activityChart,
        funnel,
        feed,
        engine,
        leadsCount,
        campaignsCount: campaigns.length,
        recentCampaigns: campaigns.slice(0, 3).map((c) => ({
          name:        c.name,
          status:      c.status,
          total_leads: c.total_leads ?? 0,
          type:        c.type ?? "linkedin",
        })),
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- Onboarding ----------------------------------------------------------------

export type OnboardingSteps = {
  extension_installed: boolean;
  linkedin_connected: boolean;
  first_campaign_created: boolean;
};

export type OnboardingStatus = {
  completed: boolean;
  steps: OnboardingSteps;
};

export async function getOnboardingStatus(): Promise<Result<OnboardingStatus>> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No autenticado");

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed, onboarding_steps")
      .eq("id", user.id)
      .single();

    const completed = profile?.onboarding_completed ?? false;
    const steps: OnboardingSteps = {
      extension_installed:    (profile?.onboarding_steps as OnboardingSteps | null)?.extension_installed    ?? false,
      linkedin_connected:     (profile?.onboarding_steps as OnboardingSteps | null)?.linkedin_connected     ?? false,
      first_campaign_created: (profile?.onboarding_steps as OnboardingSteps | null)?.first_campaign_created ?? false,
    };

    return { success: true, data: { completed, steps } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function completeOnboardingStep(stepId: keyof OnboardingSteps): Promise<Result> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No autenticado");

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_steps")
      .eq("id", user.id)
      .single();

    const current: OnboardingSteps = {
      extension_installed:    (profile?.onboarding_steps as OnboardingSteps | null)?.extension_installed    ?? false,
      linkedin_connected:     (profile?.onboarding_steps as OnboardingSteps | null)?.linkedin_connected     ?? false,
      first_campaign_created: (profile?.onboarding_steps as OnboardingSteps | null)?.first_campaign_created ?? false,
    };
    current[stepId] = true;

    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_steps: current })
      .eq("id", user.id);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function markOnboardingComplete(): Promise<Result> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No autenticado");

    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- getGhostEngineStatus ------------------------------------------------------

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
