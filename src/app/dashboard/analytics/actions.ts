"use server";
import { createClient } from "@/lib/supabase/server";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("No autenticado");
  const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", user.id).single();
  return { supabase, workspaceId: profile?.workspace_id ?? "" };
}

export async function getAnalyticsData(range: "7d" | "30d" | "3m" | "6m" = "30d") {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const rangeDays = { "7d": 7, "30d": 30, "3m": 90, "6m": 180 }[range];
    const cutoff = new Date(Date.now() - rangeDays * 86400000).toISOString();

    const [leadsRes, campaignsRes, queueRes, multiCampLeadsRes, messagesRes] = await Promise.all([
      supabase.from("leads")
        .select("id, status, crm_column, created_at, campaign_id, value")
        .eq("workspace_id", workspaceId),
      supabase.from("campaigns")
        .select("id, name, status, total_leads")
        .eq("workspace_id", workspaceId),
      supabase.from("engine_queue")
        .select("status, task_type, executed_at, created_at")
        .eq("workspace_id", workspaceId)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("leads")
        .select("full_name, campaign_id")
        .eq("workspace_id", workspaceId)
        .in("crm_column", ["conexion_enviada", "conexion_aceptada"])
        .limit(100),
      supabase.from("messages")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("sender", "user")
        .gte("created_at", cutoff),
    ]);

    const leads     = leadsRes.data ?? [];
    const campaigns = campaignsRes.data ?? [];
    const queue     = queueRes.data ?? [];
    const messagesSentCount = messagesRes.count ?? 0;

    const total       = leads.length;
    const extraidos   = leads.filter(l => l.crm_column === 'extraido').length;
    const enviadas    = leads.filter(l => l.crm_column === 'conexion_enviada').length;
    const aceptadas   = leads.filter(l => l.crm_column === 'conexion_aceptada').length;
    const enConv      = leads.filter(l => l.crm_column === 'en_conversacion').length;
    const reuniones   = leads.filter(l => l.crm_column === 'reunion_agendada').length;
    const clientes    = leads.filter(l => l.crm_column === 'cliente').length;
    const pct = (n: number) => total > 0 ? Math.round(n / total * 100) : 0;

    const now = Date.now();
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
    const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * 86400000);
      const dayStr = d.toISOString().split("T")[0];
      const dayTasks = queue.filter(t =>
        (t.executed_at ?? t.created_at)?.startsWith(dayStr) &&
        t.status === 'done'
      );
      return {
        day:      dayNames[d.getDay() as 0|1|2|3|4|5|6],
        conns:    dayTasks.filter(t => t.task_type === "connect").length,
        msgs:     dayTasks.filter(t => t.task_type === "message").length,
        meetings: leads.filter(l => l.crm_column === "reunion_agendada" && l.created_at?.startsWith(dayStr)).length,
      };
    });

    // Conversion rates between funnel stages
    const conversionRates = {
      extraido_to_enviada:        enviadas    > 0 && total > 0  ? Math.round(enviadas    / total      * 100) : 0,
      enviada_to_aceptada:        aceptadas   > 0 && enviadas > 0 ? Math.round(aceptadas  / enviadas   * 100) : 0,
      aceptada_to_conversacion:   enConv      > 0 && aceptadas > 0 ? Math.round(enConv    / aceptadas  * 100) : 0,
      conversacion_to_reunion:    reuniones   > 0 && enConv > 0    ? Math.round(reuniones / enConv     * 100) : 0,
      reunion_to_cliente:         clientes    > 0 && reuniones > 0 ? Math.round(clientes  / reuniones  * 100) : 0,
    };

    // Real health warnings: leads in multiple campaigns
    const urlCount = new Map<string, string[]>();
    for (const l of multiCampLeadsRes.data ?? []) {
      if (!l.campaign_id) continue;
      const key = l.full_name ?? '';
      if (!key) continue;
      if (!urlCount.has(key)) urlCount.set(key, []);
      urlCount.get(key)!.push(l.campaign_id);
    }
    const healthWarnings = [...urlCount.entries()]
      .filter(([, camps]) => camps.length > 1)
      .slice(0, 5)
      .map(([name, camps]) => ({
        lead:     name,
        campaigns: camps,
        severity: (camps.length > 2 ? 'high' : 'medium') as 'high' | 'medium',
      }));

    return {
      success: true,
      data: {
        kpis: {
          totalLeads:      total,
          connectionsSent: enviadas + aceptadas + enConv + reuniones + clientes,
          messagesSent:    messagesSentCount,
          meetings:        reuniones,
          conversionRate:  pct(clientes),
        },
        funnel: [
          { label: "Leads Extraídos",      value: extraidos, pct: 100           },
          { label: "Conexiones Enviadas",  value: enviadas,  pct: pct(enviadas)  },
          { label: "Conexiones Aceptadas", value: aceptadas, pct: pct(aceptadas) },
          { label: "En Conversación",      value: enConv,    pct: pct(enConv)    },
          { label: "Reunión Agendada",     value: reuniones, pct: pct(reuniones) },
          { label: "Clientes",             value: clientes,  pct: pct(clientes)  },
        ],
        campaigns: campaigns.map(c => ({
          name:   c.name,
          status: c.status,
          leads:  c.total_leads ?? 0,
        })),
        weeklyActivity,
        tasksCompleted: queue.filter(t => t.status === "done").length,
        tasksPending:   queue.filter(t => t.status === "pending").length,
        conversionRates,
        healthWarnings,
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
