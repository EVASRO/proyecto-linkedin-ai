"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getAuthContext } from "@/lib/auth-context";
import type { Conversation, Message } from "@/components/smart-inbox/types";
import { processAutopilotConversations } from "@/app/dashboard/agentes-ia/actions";

type Result<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T };

// -- Cargar conversaciones con mensajes ----------------------------------------

export async function getConversationsWithMessages(): Promise<Result<{ conversations: Conversation[]; workspaceId: string }>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { data: convRows, error: convErr } = await supabase
      .from("conversations")
      .select(`
        *,
        leads!inner (
          id, full_name, company, linkedin_url,
          email, phone, status, crm_column, value, ai_summary, created_at
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
          .order("created_at", { ascending: true })
          .limit(50);

        const messages: Message[] = (msgRows ?? []).map((m) => ({
          id:        String(m.id),
          text:      String(m.message_text ?? ""),
          sender:    m.sender === "prospect" ? "lead" : (m.sender as Message["sender"]),
          timestamp: String(m.timestamp ?? m.created_at),
          read:      Boolean(m.is_read),
          status:    (m.status ?? undefined) as Message["status"] | undefined,
        }));

        const leadUrl = String(lead.linkedin_url ?? "");
        const source: "linkedin" | "salesnav" =
          leadUrl.includes("sales/lead") || leadUrl.includes("salesnavigator")
            ? "salesnav"
            : "linkedin";

        return {
          id:              String(row.id),
          status:          (row.status ?? "active") as Conversation["status"],
          autopilotActive: Boolean(row.autopilot_active),
          autopilotMode:   ((row.autopilot_mode as string) ?? "review") as "auto" | "review",
          unreadCount:     Number(row.unread_count ?? 0),
          messages,
          aiSuggestions:   [],
          source,
          lead: {
            id:          String(lead.id),
            name:        String(lead.full_name ?? "Sin nombre"),
            company:     String(lead.company ?? "—"),
            title:       "",
            email:       lead.email       ? String(lead.email)        : undefined,
            phone:       lead.phone       ? String(lead.phone)        : undefined,
            linkedinUrl: lead.linkedin_url ? String(lead.linkedin_url) : undefined,
            source,
            pipeline:    "en_contacto" as const,
            tags:        [],
            value:       Number(lead.value ?? 0),
            notes:       String(lead.ai_summary ?? ""),
            createdAt:   String((lead.created_at as string)?.slice(0, 10) ?? ""),
          },
        };
      })
    );

    return { success: true, data: { conversations, workspaceId } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- Enviar mensaje desde la plataforma ---------------------------------------

export async function sendInboxMessage(data: {
  conversation_id: string;
  lead_id: string;
  text: string;
  linkedin_url: string;
  sender?: "user" | "prospect" | "ai";
}): Promise<Result<{ message_id: string }>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const sender = data.sender ?? "user";

    const { data: msg, error: msgErr } = await supabase
      .from("messages")
      .insert({
        workspace_id:    workspaceId,
        lead_id:         data.lead_id,
        conversation_id: data.conversation_id,
        sender,
        message_text:    data.text,
        status:          "sending",
        timestamp:       new Date().toISOString(),
      })
      .select("id")
      .single();

    if (msgErr) return { success: false, error: msgErr.message };

    // Obtener linkedin_url actualizada del lead (puede haber cambiado o faltar en el caller)
    const { data: leadRow } = await supabase
      .from("leads")
      .select("linkedin_url, salesnav_url")
      .eq("id", data.lead_id)
      .single();

    const profileUrl = leadRow?.linkedin_url || leadRow?.salesnav_url || data.linkedin_url;

    if (!profileUrl) {
      await supabase
        .from("messages")
        .update({ status: "failed" })
        .eq("id", msg.id);
      return { success: false, error: "Lead sin URL de LinkedIn — envío manual requerido" };
    }

    await supabase.from("engine_queue").insert({
      workspace_id: workspaceId,
      lead_id:      data.lead_id,
      task_type:    "message",
      action_type:  "message",
      status:       "pending",
      priority:     1,
      scheduled_at: new Date().toISOString(),
      payload: {
        message_text: data.text,
        profile_url:  profileUrl,
        lead_id:      data.lead_id,
        campaign_id:  null,
        source:       profileUrl.includes("sales/lead") ? "salesnav" : "linkedin",
      },
    });

    // Si es un mensaje del prospect y la conversación tiene autopilot activo, responder con IA
    if (sender === "prospect") {
      const { data: conv } = await supabase
        .from("conversations")
        .select("autopilot_active, assigned_agent_id")
        .eq("id", data.conversation_id)
        .single();

      if (conv?.autopilot_active && conv?.assigned_agent_id) {
        processAutopilotConversations().catch(console.error);
      }
    }

    return { success: true, data: { message_id: String(msg.id) } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- Toggle autopilot ----------------------------------------------------------

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

// -- Generar sugerencia de respuesta con IA ------------------------------------

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

// -- Archivar conversación -----------------------------------------------------

export async function archiveConversation(conversationId: string): Promise<Result> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("conversations")
      .update({ status: "archived" })
      .eq("id", conversationId)
      .eq("workspace_id", workspaceId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// -- Total de no leídos --------------------------------------------------------

export async function getUnreadCount(): Promise<number> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { data } = await supabase
      .from("conversations")
      .select("unread_count")
      .eq("workspace_id", workspaceId)
      .gt("unread_count", 0);
    return (data ?? []).reduce((s, r) => s + (r.unread_count ?? 0), 0);
  } catch { return 0; }
}

// -- Marcar todas las conversaciones como leídas -------------------------------

export async function markAllRead(): Promise<{ success: boolean }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    await Promise.all([
      supabase
        .from("conversations")
        .update({ unread_count: 0 })
        .eq("workspace_id", workspaceId)
        .gt("unread_count", 0),
      supabase
        .from("messages")
        .update({ is_read: true })
        .eq("workspace_id", workspaceId)
        .eq("is_read", false),
    ]);
    return { success: true };
  } catch { return { success: false }; }
}

// -- Autopilot draft: aprobar y encolar envío ----------------------------------

export async function approveDraft(
  msgId: string,
  finalText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    await supabase
      .from("messages")
      .update({ status: "approved", message_text: finalText })
      .eq("id", msgId);

    const { data: msg } = await supabase
      .from("messages")
      .select("lead_id, conversation_id")
      .eq("id", msgId)
      .single();

    if (!msg) return { success: false, error: "Message not found" };

    const { data: lead } = await supabase
      .from("leads")
      .select("linkedin_url, campaign_id")
      .eq("id", msg.lead_id)
      .single();

    await supabase.from("engine_queue").insert({
      workspace_id: workspaceId,
      campaign_id:  lead?.campaign_id ?? null,
      lead_id:      msg.lead_id,
      task_type:    "message",
      action_type:  "message",
      priority:     1,
      scheduled_at: new Date().toISOString(),
      payload: {
        profile_url:  lead?.linkedin_url ?? null,
        message_text: finalText,
        lead_id:      msg.lead_id,
        campaign_id:  lead?.campaign_id ?? null,
        draft_msg_id: msgId,
      },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function rejectDraft(msgId: string): Promise<{ success: boolean }> {
  try {
    const { supabase } = await getAuthContext();
    await supabase.from("messages").update({ status: "rejected" }).eq("id", msgId);
    return { success: true };
  } catch { return { success: false }; }
}

export async function getPendingDrafts(workspaceId: string): Promise<number> {
  try {
    const { supabase } = await getAuthContext();
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("sender", "ai")
      .eq("status", "draft");
    return count ?? 0;
  } catch { return 0; }
}

export async function setAutopilotMode(
  conversationId: string,
  mode: "auto" | "review"
): Promise<{ success: boolean }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    await supabase
      .from("conversations")
      .update({ autopilot_mode: mode })
      .eq("id", conversationId)
      .eq("workspace_id", workspaceId);
    return { success: true };
  } catch { return { success: false }; }
}

// -- Marcar conversación como leída --------------------------------------------

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
