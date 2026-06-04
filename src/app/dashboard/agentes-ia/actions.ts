"use server";

import { createClient } from "@/lib/supabase/server";
import { supabase as adminSupabase } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

type Result<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T };

export type AgentType = "connection" | "followup" | "autopilot" | "qualifier";

export type AgentRow = {
  id: string;
  name: string;
  emoji: string;
  type: AgentType;
  system_prompt: string;
  tone: string;
  objective: string;
  icp: Record<string, unknown>;
  value_proposition: string;
  objections: unknown[];
  status: "active" | "paused" | "draft";
  workspace_id: string;
  created_at: string;
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

// ── Map DB row → AgentRow ─────────────────────────────────────────────────────

function toAgentRow(a: Record<string, unknown>): AgentRow {
  return {
    id:                String(a.id),
    name:              String(a.name ?? "Agente"),
    emoji:             String(a.avatar_emoji ?? a.emoji ?? "🤖"),
    type:              (a.type as AgentType) ?? "connection",
    system_prompt:     String(a.system_prompt ?? ""),
    tone:              String(a.tone ?? "consultivo"),
    objective:         String(a.objective ?? "agendar_reunion"),
    icp: {
      industries: (a.icp_industries as string[]) ?? [],
      roles:      (a.icp_roles      as string[]) ?? [],
      sizes:      (a.icp_company_sizes as string[]) ?? [],
    },
    value_proposition: String(a.value_proposition ?? ""),
    objections:        (a.objections as unknown[]) ?? [],
    status:            (a.status as AgentRow["status"]) ?? "active",
    workspace_id:      String(a.workspace_id),
    created_at:        String(a.created_at),
  };
}

// ── getAgents ─────────────────────────────────────────────────────────────────

export async function getAgents(): Promise<Result<AgentRow[]>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []).map((a) => toAgentRow(a as Record<string, unknown>)) };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── upsertAgent ───────────────────────────────────────────────────────────────

export async function upsertAgent(data: {
  id?: string;
  name: string;
  emoji: string;
  tone: string;
  objective: string;
  icp: Record<string, unknown>;
  value_proposition: string;
  objections: unknown[];
  status: "active" | "paused" | "draft";
}): Promise<Result<AgentRow>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const payload = {
      workspace_id:      workspaceId,
      name:              data.name,
      avatar_emoji:      data.emoji,
      tone:              data.tone,
      objective:         data.objective,
      icp_industries:    (data.icp.industries as string[]) ?? [],
      icp_roles:         (data.icp.roles      as string[]) ?? [],
      icp_company_sizes: (data.icp.sizes      as string[]) ?? [],
      value_proposition: data.value_proposition,
      objections:        data.objections,
      status:            data.status,
    };

    let row: Record<string, unknown> | null = null;

    if (data.id) {
      const { data: updated, error } = await supabase
        .from("agents")
        .update(payload)
        .eq("id", data.id)
        .eq("workspace_id", workspaceId)
        .select()
        .single();
      if (error) return { success: false, error: error.message };
      row = updated as Record<string, unknown>;
    } else {
      const { data: inserted, error } = await supabase
        .from("agents")
        .insert(payload)
        .select()
        .single();
      if (error) return { success: false, error: error.message };
      row = inserted as Record<string, unknown>;
    }

    return { success: true, data: toAgentRow(row!) };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── toggleAgentStatus ─────────────────────────────────────────────────────────

export async function toggleAgentStatus(id: string, currentStatus: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const newStatus = currentStatus === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("agents")
      .update({ status: newStatus })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── deleteAgent ───────────────────────────────────────────────────────────────

export async function deleteAgent(id: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("agents")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── assignAgentToConversation ─────────────────────────────────────────────────

export async function assignAgentToConversation(
  agent_id: string,
  conversation_id: string
): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("conversations")
      .update({
        assigned_agent_id: agent_id,
        autopilot_active:  true,
        status:            "ai_handling",
      })
      .eq("id", conversation_id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── Core autopilot logic (sin sesión, usa service role) ───────────────────────

async function runAutopilotCore(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<{ processed: number }> {
  const { data: convRows, error: convErr } = await supabase
    .from("conversations")
    .select(`
      id, lead_id,
      leads!inner ( full_name, linkedin_url ),
      agents!assigned_agent_id (
        name, tone, objective, value_proposition, objections
      )
    `)
    .eq("workspace_id", workspaceId)
    .eq("autopilot_active", true)
    .eq("status", "ai_handling")
    .not("assigned_agent_id", "is", null);

  if (convErr) throw new Error(convErr.message);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let processed = 0;

  for (const conv of convRows ?? []) {
    const lead  = conv.leads  as unknown as Record<string, unknown>;
    const agent = conv.agents as unknown as Record<string, unknown> | null;
    if (!agent) continue;

    const { data: msgRows } = await supabase
      .from("messages")
      .select("sender, message_text, timestamp")
      .eq("conversation_id", conv.id)
      .order("timestamp", { ascending: false })
      .limit(6);

    const msgs = (msgRows ?? []).reverse();
    if (msgs.length === 0) continue;
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg.sender !== "prospect") continue;

    const history: Anthropic.MessageParam[] = [];
    for (const m of msgs) {
      const role: "user" | "assistant" =
        m.sender === "prospect" ? "user" : "assistant";
      const last = history[history.length - 1];
      if (last && last.role === role) {
        last.content = `${last.content}\n${m.message_text}`;
      } else {
        history.push({ role, content: String(m.message_text ?? "") });
      }
    }
    if (history.length === 0 || history[0].role !== "user") continue;

    const objList = (agent.objections as { question: string; answer: string }[] ?? [])
      .map((o) => `- "${o.question}" → "${o.answer}"`)
      .join("\n");

    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: [
        `Eres ${agent.name}, un agente de ventas con tono ${agent.tone}.`,
        `Objetivo: ${agent.objective}.`,
        `Propuesta de valor: ${agent.value_proposition}.`,
        objList ? `Objeciones entrenadas:\n${objList}` : "",
        "Responde en máx 2 oraciones. Solo devuelve el texto de la respuesta, sin explicaciones.",
      ].filter(Boolean).join("\n"),
      messages: history,
    });

    const replyText = (response.content[0] as Anthropic.TextBlock).text.trim();

    await supabase.from("messages").insert({
      workspace_id:    workspaceId,
      lead_id:         conv.lead_id,
      conversation_id: conv.id,
      sender:          "ai",
      message_text:    replyText,
      status:          "sending",
      timestamp:       new Date().toISOString(),
    });

    await supabase.from("engine_queue").insert({
      workspace_id: workspaceId,
      lead_id:      conv.lead_id,
      task_type:    "message",
      status:       "pending",
      priority:     1,
      payload: {
        message_text: replyText,
        profile_url:  lead.linkedin_url ?? "",
        lead_id:      conv.lead_id,
      },
    });

    processed++;
  }

  return { processed };
}

// ── runAutopilotForWorkspace: llamable sin sesión (webhook/cron) ──────────────

export async function runAutopilotForWorkspace(
  workspaceId: string
): Promise<Result<{ processed: number }>> {
  try {
    const { processed } = await runAutopilotCore(adminSupabase, workspaceId);
    return { success: true, data: { processed } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── processAutopilotConversations ─────────────────────────────────────────────

export async function processAutopilotConversations(): Promise<Result<{ processed: number }>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { processed } = await runAutopilotCore(supabase, workspaceId);
    return { success: true, data: { processed } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
