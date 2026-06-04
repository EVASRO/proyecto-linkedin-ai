"use server";
import { createClient } from "@/lib/supabase/server";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("No autenticado");
  const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", user.id).single();
  return { supabase, workspaceId: profile?.workspace_id ?? "" };
}

export async function getAnalyticsData() {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const [leadsRes, campaignsRes, engineRes, queueRes] = await Promise.all([
      supabase.from("leads").select("id, status, created_at").eq("workspace_id", workspaceId),
      supabase.from("campaigns").select("id, name, status, total_leads").eq("workspace_id", workspaceId),
      supabase.from("ghost_engine_sessions")
        .select("connections_sent, messages_sent, actions_count")
        .eq("workspace_id", workspaceId).single(),
      supabase.from("engine_queue")
        .select("status, action_type, completed_at, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const leads = leadsRes.data ?? [];
    const campaigns = campaignsRes.data ?? [];
    const engine = engineRes.data;
    const queue = queueRes.data ?? [];

    const totalLeads = leads.length;
    const contactados = leads.filter(l => ["contactado", "respondio", "reunión", "cerrado"].includes(l.status)).length;
    const respondieron = leads.filter(l => ["respondio", "reunión", "cerrado"].includes(l.status)).length;
    const reuniones = leads.filter(l => ["reunión", "cerrado"].includes(l.status)).length;

    const now = Date.now();
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * 86400000);
      const dayStr = d.toISOString().split("T")[0];
      const dayTasks = queue.filter(t => t.completed_at?.startsWith(dayStr));
      return {
        day: days[d.getDay()],
        conns: dayTasks.filter(t => t.action_type === "connect").length,
        msgs: dayTasks.filter(t => t.action_type === "message").length,
        meetings: leads.filter(l => l.status === "reunión" && l.created_at?.startsWith(dayStr)).length,
      };
    });

    return {
      success: true,
      data: {
        kpis: {
          totalLeads,
          connectionsSent: engine?.connections_sent ?? 0,
          messagesSent: engine?.messages_sent ?? 0,
          meetings: reuniones,
        },
        funnel: [
          { label: "Leads en CRM",           value: totalLeads,                     pct: 100 },
          { label: "Solicitudes enviadas",    value: engine?.connections_sent ?? 0,  pct: totalLeads ? Math.round((engine?.connections_sent ?? 0) / totalLeads * 100) : 0 },
          { label: "Conexiones aceptadas",    value: contactados,                    pct: totalLeads ? Math.round(contactados / totalLeads * 100) : 0 },
          { label: "Respondieron",            value: respondieron,                   pct: totalLeads ? Math.round(respondieron / totalLeads * 100) : 0 },
          { label: "Demo / Reunión",          value: reuniones,                      pct: totalLeads ? Math.round(reuniones / totalLeads * 100) : 0 },
        ],
        campaigns: campaigns.map(c => ({
          name: c.name,
          status: c.status,
          leads: c.total_leads ?? 0,
        })),
        weeklyActivity,
        tasksCompleted: queue.filter(t => t.status === "done").length,
        tasksPending: queue.filter(t => t.status === "pending").length,
      }
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
