"use server";

import { createClient } from "@/lib/supabase/server";

// ── Shared result type ────────────────────────────────────────────────────────

type Result<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T };

// ── Exported types (match Supabase schema) ────────────────────────────────────

export type CrmLead = {
  id: string;
  full_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  status: string;
  crm_column: string | null;
  value: number;
  score: number;
  custom_tags: string[];
  next_task: string | null;
  ai_summary: string | null;
  assigned_to: string | null;
  campaign_id: string | null;
  created_at: string;
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

// ── Default columns (campaign flow) ──────────────────────────────────────────

const DEFAULT_COLUMNS = [
  { title: "Extraídos",          color: "blue",   position: 0, key: "extraido"           },
  { title: "Conexión Enviada",   color: "indigo", position: 1, key: "conexion_enviada"   },
  { title: "Conexión Aceptada",  color: "violet", position: 2, key: "conexion_aceptada"  },
  { title: "En Conversación",    color: "amber",  position: 3, key: "en_conversacion"    },
  { title: "Reunión Agendada",   color: "orange", position: 4, key: "reunion_agendada"   },
  { title: "Cliente",            color: "green",  position: 5, key: "cliente"            },
];

// ── Auth context helper ───────────────────────────────────────────────────────

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

// ── 1. getCrmData ─────────────────────────────────────────────────────────────

export async function getCrmData(): Promise<Result<{
  leads: CrmLead[];
  columns: CrmColumn[];
  automations: CrmAutomationFull[];
}>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const [leadsRes, columnsRes, automationsRes] = await Promise.all([
      supabase
        .from("leads")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("crm_columns")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true }),
      supabase
        .from("crm_automations")
        .select("*")
        .eq("workspace_id", workspaceId),
    ]);

    if (leadsRes.error) return { success: false, error: leadsRes.error.message };
    if (columnsRes.error) return { success: false, error: columnsRes.error.message };

    let columns = (columnsRes.data ?? []) as CrmColumn[];

    // Seed default columns if none exist
    if (columns.length === 0) {
      const toInsert = DEFAULT_COLUMNS.map((c) => ({ ...c, workspace_id: workspaceId }));
      const { data: inserted, error: insertErr } = await supabase
        .from("crm_columns")
        .insert(toInsert)
        .select();
      if (insertErr) return { success: false, error: insertErr.message };
      columns = (inserted ?? []) as CrmColumn[];
    }

    return {
      success: true,
      data: {
        leads:       (leadsRes.data ?? []) as CrmLead[],
        columns,
        automations: (automationsRes.data ?? []) as unknown as CrmAutomationFull[],
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── 2. createLead ─────────────────────────────────────────────────────────────

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

// ── 3. updateLeadStatus ───────────────────────────────────────────────────────

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

// ── 4. updateLead ─────────────────────────────────────────────────────────────

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

// ── 5. archiveLead ───────────────────────────────────────────────────────────

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

// ── 6. deleteLead ─────────────────────────────────────────────────────────────

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

// ── 6. upsertColumn ──────────────────────────────────────────────────────────

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

// ── 7. reorderColumns ─────────────────────────────────────────────────────────

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

// ── 8. upsertAutomation ───────────────────────────────────────────────────────

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

// ── 9. enqueueProfileExtraction ──────────────────────────────────────────────

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

// ── 10. toggleAutomation ──────────────────────────────────────────────────────

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

// ── 11. triggerCrmAutomation ──────────────────────────────────────────────────

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

// ── 12. moveLead ──────────────────────────────────────────────────────────────

export async function moveLead(leadId: string, newColumn: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { error } = await supabase
      .from("leads")
      .update({ crm_column: newColumn })
      .eq("id", leadId)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };

    // Fire automations for this column move (non-blocking)
    triggerCrmAutomation(leadId, "moved_to_column", { column: newColumn }).catch(() => null);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── 13. upsertCrmAutomation (new schema) ──────────────────────────────────────

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

// ── 14. getCrmAutomations ─────────────────────────────────────────────────────

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

// ── 15. deleteCrmAutomation ───────────────────────────────────────────────────

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
