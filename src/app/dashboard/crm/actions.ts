"use server";

import { createClient } from "@/lib/supabase/server";

// -- Shared result type --------------------------------------------------------

type Result<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T };

// -- Exported types (match Supabase schema) ------------------------------------

export type CrmLead = {
  id: string;
  full_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  avatar_url: string | null;
  headline: string | null;
  location: string | null;
  connection_note: string | null;
  status: string;
  crm_column: string | null;
  value: number;
  score: number;
  custom_tags: string[];
  next_task: string | null;
  ai_summary: string | null;
  assigned_to: string | null;
  campaign_id: string | null;
  connection_sent_at: string | null;
  connection_accepted_at: string | null;
  created_at: string;
  // computed
  days_in_stage: number;
  next_pending_task: string | null;
  campaign_name: string | null;
  segment_name: string | null;
  automation_step: string | null;
};

export type CrmColumn = {
  id: string;
  title: string;
  color: string;
  position: number;
  key?: string;
};

export type CrmAutomationFull = {
  id: string;
  workspace_id: string;
  name: string;
  trigger_event: string;
  trigger_condition: Record<string, unknown>;
  action_type: string;
  action_payload: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
};

// -- Default columns (campaign flow) ------------------------------------------

const DEFAULT_COLUMNS = [
  { title: "Extraídos",          color: "blue",   position: 0, key: "extraido"           },
  { title: "Conexión Enviada",   color: "indigo", position: 1, key: "conexion_enviada"   },
  { title: "Conexión Aceptada",  color: "violet", position: 2, key: "conexion_aceptada"  },
  { title: "En Conversación",    color: "amber",  position: 3, key: "en_conversacion"    },
  { title: "Reunión Agendada",   color: "orange", position: 4, key: "reunion_agendada"   },
  { title: "Cliente",            color: "green",  position: 5, key: "cliente"            },
];

// -- Auth context helper -------------------------------------------------------

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

// -- 1. getCrmData -------------------------------------------------------------

export async function getCrmData(): Promise<Result<{
  leads: CrmLead[];
  columns: CrmColumn[];
  automations: CrmAutomationFull[];
  workspaceId: string;
}>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const [leadsRes, columnsRes, automationsRes, pendingTasksRes] = await Promise.all([
      supabase
        .from("leads")
        .select(`*, campaign:campaigns(id, name, workflow_json)`)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("crm_columns")
        .select("id, title, color, position, key")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true }),
      supabase
        .from("crm_automations")
        .select("*")
        .eq("workspace_id", workspaceId),
      supabase
        .from("engine_queue")
        .select("lead_id, task_type, scheduled_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "pending")
        .order("scheduled_at", { ascending: true }),
    ]);

    if (leadsRes.error) return { success: false, error: leadsRes.error.message };
    if (columnsRes.error) return { success: false, error: columnsRes.error.message };

    let columns = (columnsRes.data ?? []) as CrmColumn[];

    // Seed default columns only if none have a key set
    const hasKeys = columns.some((c) => c.key);
    if (!hasKeys) {
      const toInsert = DEFAULT_COLUMNS.map((c) => ({ ...c, workspace_id: workspaceId }));
      const { data: inserted, error: insertErr } = await supabase
        .from("crm_columns")
        .insert(toInsert)
        .select();
      if (insertErr) return { success: false, error: insertErr.message };
      columns = (inserted ?? []) as CrmColumn[];
    }

    // Índice de primera tarea pendiente por lead_id
    const now = Date.now();
    const taskByLead = new Map<string, { task_type: string; scheduled_at: string }>();
    for (const t of pendingTasksRes.data ?? []) {
      if (t.lead_id && !taskByLead.has(t.lead_id)) {
        taskByLead.set(t.lead_id, { task_type: t.task_type, scheduled_at: t.scheduled_at });
      }
    }

    const TASK_LABELS: Record<string, string> = {
      connect:          "Enviar conexión",
      check_connection: "Verificar conexión",
      message:          "Enviar mensaje",
      view_profile:     "Visitar perfil",
    };

    const AUTO_STEP: Record<string, string> = {
      extraido:          "Paso 1: Extracción",
      conexion_enviada:  "Paso 2: Conexión enviada",
      conexion_aceptada: "Paso 3: Esperando follow-up",
      en_conversacion:   "Paso 4: En conversación",
      reunion_agendada:  "Paso 5: Reunión agendada",
      cliente:           "Paso 6: Convertido ✓",
    };

    const enrichedLeads: CrmLead[] = (leadsRes.data ?? []).map((l) => {
      // Calcular días en etapa actual
      const stageDate = l.connection_accepted_at ?? l.connection_sent_at ?? l.created_at;
      const daysInStage = stageDate
        ? Math.floor((now - new Date(stageDate).getTime()) / 86_400_000)
        : 0;

      const pending = taskByLead.get(l.id);
      const nextPendingTask = pending
        ? (TASK_LABELS[pending.task_type] ?? pending.task_type)
        : null;

      // Enriquecer con datos de campaña (join)
      const campData = (l as Record<string, unknown>).campaign as {
        id: string; name: string; workflow_json: Record<string, unknown>
      } | null;
      const wfSegments = (campData?.workflow_json?.segments as Array<{ name?: string }>) ?? [];
      const segName = wfSegments[0]?.name ?? null;

      return {
        ...(l as Record<string, unknown>),
        days_in_stage:     daysInStage,
        next_pending_task: nextPendingTask,
        campaign_name:     campData?.name ?? null,
        segment_name:      segName,
        automation_step:   AUTO_STEP[l.crm_column ?? ""] ?? null,
      } as CrmLead;
    });

    return {
      success: true,
      data: {
        leads:       enrichedLeads,
        columns,
        automations: (automationsRes.data ?? []) as unknown as CrmAutomationFull[],
        workspaceId,
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 2. createLead -------------------------------------------------------------

export async function createLead(data: {
  full_name: string;
  company?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  value?: number;
  status?: string;
  next_task?: string;
}): Promise<Result<CrmLead>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        workspace_id: workspaceId,
        full_name:    data.full_name,
        company:      data.company      ?? null,
        email:        data.email        ?? null,
        phone:        data.phone        ?? null,
        linkedin_url: data.linkedin_url ?? null,
        value:        data.value        ?? 0,
        score:        0,
        custom_tags:  [],
        status:       data.status       ?? "nuevo",
        next_task:    data.next_task    ?? null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: lead as CrmLead };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 3. updateLeadStatus -------------------------------------------------------

export async function updateLeadStatus(id: string, status: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 4. updateLead -------------------------------------------------------------

export async function updateLead(
  id: string,
  data: Partial<CrmLead>
): Promise<Result<CrmLead>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    // Strip non-updatable fields
    const { id: _id, created_at: _ca, campaign_id: _ci, assigned_to: _at, ...rest } = data;
    void _id; void _ca; void _ci; void _at;

    const { data: updated, error } = await supabase
      .from("leads")
      .update(rest)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: updated as CrmLead };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 5. archiveLead -----------------------------------------------------------

export async function archiveLead(id: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("leads")
      .update({ status: "archivado" })
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 6. deleteLead -------------------------------------------------------------

export async function deleteLead(id: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 6. upsertColumn ----------------------------------------------------------

export async function upsertColumn(data: {
  id?: string;
  title: string;
  color: string;
  position: number;
}): Promise<Result<CrmColumn>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    let result;
    if (data.id) {
      result = await supabase
        .from("crm_columns")
        .update({ title: data.title, color: data.color, position: data.position })
        .eq("id", data.id)
        .eq("workspace_id", workspaceId)
        .select()
        .single();
    } else {
      result = await supabase
        .from("crm_columns")
        .insert({ workspace_id: workspaceId, title: data.title, color: data.color, position: data.position })
        .select()
        .single();
    }
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data as CrmColumn };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 7. reorderColumns ---------------------------------------------------------

export async function reorderColumns(
  columns: { id: string; position: number }[]
): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    await Promise.all(
      columns.map(({ id, position }) =>
        supabase
          .from("crm_columns")
          .update({ position })
          .eq("id", id)
          .eq("workspace_id", workspaceId)
      )
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 8. upsertAutomation -------------------------------------------------------

export async function upsertAutomation(data: {
  id?: string;
  column_id: string;
  trigger_label: string;
  action_label: string;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
}): Promise<Result<CrmAutomationFull>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const payload = {
      workspace_id:  workspaceId,
      column_id:     data.column_id,
      trigger_label: data.trigger_label,
      action_label:  data.action_label,
      action_type:   data.action_type,
      action_config: data.action_config,
      is_active:     data.is_active,
    };
    let result;
    if (data.id) {
      result = await supabase
        .from("crm_automations")
        .update(payload)
        .eq("id", data.id)
        .eq("workspace_id", workspaceId)
        .select()
        .single();
    } else {
      result = await supabase
        .from("crm_automations")
        .insert(payload)
        .select()
        .single();
    }
    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data as CrmAutomationFull };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 9. enqueueProfileExtraction ----------------------------------------------

export async function enqueueProfileExtraction(data: {
  lead_id: string;
  linkedin_url: string;
}): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { error } = await supabase
      .from("engine_queue")
      .insert({
        workspace_id: workspaceId,
        lead_id:      data.lead_id,
        task_type:    "extract_profile",
        payload: {
          profile_url: data.linkedin_url,
          lead_id:     data.lead_id,
        },
        priority: 3,
        status:   "pending",
      });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 10. toggleAutomation ------------------------------------------------------

export async function toggleAutomation(id: string, is_active: boolean): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("crm_automations")
      .update({ is_active })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 11. triggerCrmAutomation --------------------------------------------------

export async function triggerCrmAutomation(
  leadId: string,
  event: "moved_to_column" | "tag_added" | "inactivity",
  context: { column?: string; tag?: string; daysSinceActivity?: number }
): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { data: automations } = await supabase
      .from("crm_automations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("trigger_event", event)
      .eq("is_active", true);

    if (!automations?.length) return { success: true };

    for (const automation of automations) {
      const condition = automation.trigger_condition as Record<string, unknown>;

      if (event === "moved_to_column" && condition.column !== context.column) continue;
      if (event === "tag_added" && condition.tag !== context.tag) continue;

      const action = automation.action_type as string;

      if (action === "add_to_queue") {
        await supabase.from("engine_queue").insert({
          workspace_id: workspaceId,
          lead_id:      leadId,
          action_type:  automation.action_payload?.action ?? "message",
          status:       "pending",
          priority:     5,
          payload: {
            lead_id:      leadId,
            message_text: automation.action_payload?.message ?? "",
          },
          scheduled_at: new Date(
            Date.now() + (automation.action_payload?.delay_hours ?? 0) * 3600000
          ).toISOString(),
        });
      }

      if (action === "update_lead") {
        await supabase
          .from("leads")
          .update(automation.action_payload?.fields ?? {})
          .eq("id", leadId)
          .eq("workspace_id", workspaceId);
      }

      await supabase.from("activity_log").insert({
        workspace_id: workspaceId,
        action_type:  "automation_triggered",
        description:  `Automatización "${automation.name}" ejecutada para lead`,
        metadata:     { lead_id: leadId, automation_id: automation.id, event },
      });
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 12. moveLead --------------------------------------------------------------

export async function moveLead(leadId: string, newColumn: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { error } = await supabase
      .from("leads")
      .update({ crm_column: newColumn })
      .eq("id", leadId)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };

    // Compute and persist lead score based on new stage
    const { data: leadData } = await supabase
      .from("leads")
      .select("headline, email, phone, connection_accepted_at, connection_sent_at")
      .eq("id", leadId)
      .single();

    if (leadData) {
      const newScore = calculateLeadScore({ crm_column: newColumn, ...leadData });
      await supabase.from("leads").update({ score: newScore }).eq("id", leadId);
    }

    // Fire automations for this column move (non-blocking)
    triggerCrmAutomation(leadId, "moved_to_column", { column: newColumn }).catch(() => null);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 16. calculateLeadScore ----------------------------------------------------

export async function calculateLeadScore(lead: {
  crm_column?: string | null;
  headline?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  connection_accepted_at?: string | null;
  connection_sent_at?: string | null;
}): Promise<number> {
  let score = 0;

  const stageScore: Record<string, number> = {
    extraido:          5,
    conexion_enviada:  15,
    conexion_aceptada: 25,
    en_conversacion:   35,
    reunion_agendada:  45,
    cliente:           50,
  };
  score += stageScore[lead.crm_column ?? ''] ?? 0;

  const headline = (lead.headline ?? '').toLowerCase();
  if (/\b(ceo|cto|coo|cfo|founder|cofunder|owner|president)\b/.test(headline)) score += 30;
  else if (/\b(director|vp|vice president|head of|gerente general)\b/.test(headline)) score += 20;
  else if (/\b(manager|jefe|lead|principal|senior)\b/.test(headline)) score += 10;

  if (lead.email) score += 8;
  if (lead.phone) score += 7;

  if (lead.connection_accepted_at && lead.connection_sent_at) {
    const hoursToAccept =
      (new Date(lead.connection_accepted_at).getTime() -
       new Date(lead.connection_sent_at).getTime()) / 3_600_000;
    if (hoursToAccept < 2)  score += 15;
    else if (hoursToAccept < 24) score += 10;
    else if (hoursToAccept < 72) score += 5;
  }

  return Math.min(score, 100);
}

// -- 13. upsertCrmAutomation (new schema) --------------------------------------

export async function upsertCrmAutomation(data: {
  id?: string;
  name: string;
  trigger_event: string;
  trigger_condition: Record<string, unknown>;
  action_type: string;
  action_payload: Record<string, unknown>;
  is_active: boolean;
}): Promise<Result<CrmAutomationFull>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const payload = {
      workspace_id:      workspaceId,
      name:              data.name,
      trigger_event:     data.trigger_event,
      trigger_condition: data.trigger_condition,
      action_type:       data.action_type,
      action_payload:    data.action_payload,
      is_active:         data.is_active,
    };

    let result;
    if (data.id) {
      result = await supabase
        .from("crm_automations")
        .update(payload)
        .eq("id", data.id)
        .eq("workspace_id", workspaceId)
        .select()
        .single();
    } else {
      result = await supabase
        .from("crm_automations")
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) return { success: false, error: result.error.message };
    return { success: true, data: result.data as CrmAutomationFull };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- 14. getCrmAutomations -----------------------------------------------------

export async function getCrmAutomations(): Promise<Result<CrmAutomationFull[]>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { data, error } = await supabase
      .from("crm_automations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as CrmAutomationFull[] };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- getLeadDetail -------------------------------------------------------------

export async function getLeadDetail(leadId: string): Promise<{
  success: boolean;
  data?: {
    lead: Record<string, unknown>;
    activity: Array<{
      id: string; action_type: string; description: string;
      created_at: string; metadata: Record<string, unknown> | null;
    }>;
    messages: Array<{
      id: string; message_text: string; sender: string;
      timestamp: string; is_read: boolean;
    }>;
    tasks: Array<{
      id: string; task_type: string; status: string;
      created_at: string; executed_at: string | null;
      last_error: string | null;
    }>;
  };
  error?: string;
}> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("workspace_id", workspaceId)
      .single();
    if (leadErr || !lead) throw new Error("Lead no encontrado");

    const { data: activity } = await supabase
      .from("activity_log")
      .select("id, action_type, description, created_at, metadata")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: convRows } = await supabase
      .from("conversations")
      .select("id")
      .eq("lead_id", leadId)
      .limit(1);
    const convId = convRows?.[0]?.id;

    let messages: Array<{ id: string; message_text: string; sender: string; timestamp: string; is_read: boolean }> = [];
    if (convId) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, message_text, sender, timestamp, is_read")
        .eq("conversation_id", convId)
        .order("timestamp", { ascending: true })
        .limit(30);
      messages = (msgs ?? []) as typeof messages;
    }

    const { data: tasks } = await supabase
      .from("engine_queue")
      .select("id, task_type, status, created_at, executed_at, last_error")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(15);

    return {
      success: true,
      data: {
        lead: lead as Record<string, unknown>,
        activity: (activity ?? []) as Array<{ id: string; action_type: string; description: string; created_at: string; metadata: Record<string, unknown> | null }>,
        messages,
        tasks: (tasks ?? []) as Array<{ id: string; task_type: string; status: string; created_at: string; executed_at: string | null; last_error: string | null }>,
      },
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// -- updateLeadField -----------------------------------------------------------

export async function updateLeadField(
  leadId: string,
  updates: Partial<{
    crm_column: string; value: number; email: string;
    phone: string; notes: string; tags: string[];
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("leads")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", leadId)
      .eq("workspace_id", workspaceId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// -- 15. deleteCrmAutomation ---------------------------------------------------

export async function deleteCrmAutomation(id: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("crm_automations")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- enqueueEnrichment ---------------------------------------------------------

export async function enqueueEnrichment(
  leadId: string,
  type: "find_email" | "find_phone",
  linkedinUrl: string
): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    if (!workspaceId) return { success: false, error: "Sin workspace" };

    const { data: existing } = await supabase
      .from("engine_queue")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("lead_id", leadId)
      .eq("task_type", type)
      .eq("status", "pending")
      .limit(1);

    if (existing?.length) return { success: true };

    const { error } = await supabase.from("engine_queue").insert({
      workspace_id: workspaceId,
      lead_id:      leadId,
      task_type:    type,
      action_type:  type,
      payload: {
        lead_id:     leadId,
        profile_url: linkedinUrl,
        leadId,
      },
      priority: 5,
      status:   "pending",
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
