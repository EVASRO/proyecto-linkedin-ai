"use server";

import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Conversation, Message } from "@/components/smart-inbox/types";

type Result<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T };

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

// ── Cargar conversaciones con mensajes ────────────────────────────────────────

export async function getConversationsWithMessages(): Promise<Result<{ conversations: Conversation[] }>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { data: convRows, error: convErr } = await supabase
      .from("conversations")
      .select(`
        *,
        leads!inner (
          id, full_name, company, headline, linkedin_url,
          email, phone, status, value, ai_summary, created_at
        )
      `)
      .eq("workspace_id", workspaceId)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(50);

    if (convErr) return { success: false, error: convErr.message };

    const conversations: Conversation[] = await Promise.all(
      (convRows ?? []).map(async (row) => {
        const lead = row.leads as Record<string, unknown>;

        const { data: msgRows } = await supabase
          .from("messages")
          .select("*")
          .eq("lead_id", lead.id)
          .order("timestamp", { ascending: true })
          .limit(50);

        const messages: Message[] = (msgRows ?? []).map((m) => ({
          id:        String(m.id),
          text:      String(m.message_text ?? ""),
          sender:    m.sender === "prospect" ? "lead" : (m.sender as Message["sender"]),
          timestamp: String(m.timestamp ?? m.created_at),
          read:      Boolean(m.is_read),
          status:    m.status as Message["status"] ?? undefined,
        }));

        return {
          id:              String(row.id),
          status:          (row.status ?? "active") as Conversation["status"],
          autopilotActive: Boolean(row.autopilot_active),
          unreadCount:     Number(row.unread_count ?? 0),
          messages,
          aiSuggestions:   [],
          lead: {
            id:          String(lead.id),
            name:        String(lead.full_name ?? "Sin nombre"),
            company:     String(lead.company ?? "—"),
            title:       String(lead.headline ?? ""),
            email:       lead.email       ? String(lead.email)        : undefined,
            phone:       lead.phone       ? String(lead.phone)        : undefined,
            linkedinUrl: lead.linkedin_url ? String(lead.linkedin_url) : undefined,
            source:      "linkedin" as const,
            pipeline:    "en_contacto" as const,
            tags:        [],
            value:       Number(lead.value ?? 0),
            notes:       String(lead.ai_summary ?? ""),
            createdAt:   String((lead.created_at as string)?.slice(0, 10) ?? ""),
          },
        };
      })
    );

    return { success: true, data: { conversations } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── Enviar mensaje desde la plataforma ───────────────────────────────────────

export async function sendInboxMessage(data: {
  conversation_id: string;
  lead_id: string;
  text: string;
  linkedin_url: string;
}): Promise<Result<{ message_id: string }>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { data: msg, error: msgErr } = await supabase
      .from("messages")
      .insert({
        workspace_id:    workspaceId,
        lead_id:         data.lead_id,
        conversation_id: data.conversation_id,
        sender:          "user",
        message_text:    data.text,
        status:          "sending",
        timestamp:       new Date().toISOString(),
      })
      .select("id")
      .single();

    if (msgErr) return { success: false, error: msgErr.message };

    await supabase.from("engine_queue").insert({
      workspace_id: workspaceId,
      lead_id:      data.lead_id,
      task_type:    "message",
      status:       "pending",
      priority:     1,
      payload: {
        message_text: data.text,
        profile_url:  data.linkedin_url,
        lead_id:      data.lead_id,
      },
    });

    return { success: true, data: { message_id: String(msg.id) } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── Toggle autopilot ──────────────────────────────────────────────────────────

export async function toggleAutopilot(
  conversation_id: string,
  active: boolean
): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { error } = await supabase
      .from("conversations")
      .update({
        autopilot_active: active,
        status:           active ? "ai_handling" : "human",
      })
      .eq("id", conversation_id)
      .eq("workspace_id", workspaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── Generar sugerencia de respuesta con IA ────────────────────────────────────

export async function generateAISuggestion(data: {
  lead_name: string;
  conversation_history: { sender: string; text: string }[];
  agent_config?: Record<string, unknown>;
}): Promise<Result<{ suggestion: string }>> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const messages: Anthropic.MessageParam[] = data.conversation_history.map((m) => ({
      role:    m.sender === "user" || m.sender === "ai" ? "assistant" : "user",
      content: m.text,
    }));

    // Anthropic requires alternating roles — merge consecutive same-role messages
    const merged: Anthropic.MessageParam[] = [];
    for (const m of messages) {
      const last = merged[merged.length - 1];
      if (last && last.role === m.role) {
        last.content = `${last.content}\n${m.content}`;
      } else {
        merged.push({ ...m });
      }
    }

    // Must start with user role
    if (merged.length === 0 || merged[0].role !== "user") {
      merged.unshift({ role: "user", content: `Hola, soy ${data.lead_name}.` });
    }

    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: `Eres un asistente de ventas B2B. Sugiere una respuesta breve (máx 2 oraciones) para continuar la conversación con ${data.lead_name}. Tono profesional y empático. Solo devuelve el texto de la respuesta, sin explicaciones.`,
      messages: merged,
    });

    const suggestion = (response.content[0] as Anthropic.TextBlock).text.trim();
    return { success: true, data: { suggestion } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── Marcar conversación como leída ────────────────────────────────────────────

export async function markConversationRead(conversation_id: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    await Promise.all([
      supabase
        .from("conversations")
        .update({ unread_count: 0 })
        .eq("id", conversation_id)
        .eq("workspace_id", workspaceId),
      supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversation_id),
    ]);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
