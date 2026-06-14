import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const WEBHOOK_SECRET =
  process.env.AUTOPILOT_WEBHOOK_SECRET ?? "nexusai-autopilot-2024";

export async function GET() {
  return NextResponse.json({ ok: true, service: "autopilot-trigger" });
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    const isValid = token === WEBHOOK_SECRET || authHeader.includes(WEBHOOK_SECRET);

    if (!isValid) {
      console.error("[Autopilot] Unauthorized - header prefix:", authHeader.slice(0, 20));
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const record = body.record as Record<string, unknown> | undefined;

    if (!record?.conversation_id) {
      return NextResponse.json({ error: "Missing conversation_id" }, { status: 400 });
    }

    // Only react to messages from the prospect
    const sender = record.sender as string | undefined;
    if (!sender || sender === "user" || sender === "ai") {
      return NextResponse.json({ skipped: true, reason: "not_prospect_message" });
    }

    const supabase = await createClient();

    // ── 1. Load full context ──────────────────────────────────────────────────

    const { data: conv } = await supabase
      .from("conversations")
      .select(`
        *,
        lead:leads(*),
        campaign:campaigns(name, description, workflow_json)
      `)
      .eq("id", record.conversation_id)
      .single();

    if (!conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (!conv.autopilot_active) {
      return NextResponse.json({ skipped: true, reason: "autopilot_inactive" });
    }

    // Last 20 messages ordered chronologically — exclude drafts/rejected
    const { data: messages } = await supabase
      .from("messages")
      .select("sender, message_text, timestamp")
      .eq("conversation_id", String(record.conversation_id))
      .not("status", "in", '("draft","rejected")')
      .order("timestamp", { ascending: true })
      .limit(20);

    const lead     = conv.lead     as Record<string, unknown>;
    const campaign = conv.campaign as Record<string, unknown> | null;
    const wfJson   = (campaign?.workflow_json ?? {}) as Record<string, unknown>;
    const firstName = (String(lead.full_name ?? "")).split(" ")[0] || "amigo/a";

    // ── 2. Build system prompt ────────────────────────────────────────────────

    const systemPrompt = `Eres un asistente de ventas experto que responde mensajes de LinkedIn
en nombre del usuario de la plataforma NexusAI.

CONTEXTO DEL LEAD:
- Nombre: ${lead.full_name ?? "Desconocido"}
- Cargo: ${lead.headline ?? "No disponible"}
- Empresa: ${lead.company ?? "No disponible"}
- Ubicación: ${lead.location ?? "No disponible"}
- Etapa CRM: ${lead.crm_column ?? "extraido"}

CONTEXTO DE LA CAMPAÑA:
- Nombre: ${campaign?.name ?? "Sin nombre"}
- Objetivo: ${wfJson.goal ?? "Agendar una reunión de 30 minutos"}

INSTRUCCIONES CRÍTICAS:
1. Responde SIEMPRE en el idioma en que te escribe el prospect
2. Sé conciso, natural y conversacional — máximo 3-4 oraciones
3. Si mencionan interés → busca concretar una reunión
4. Si tienen dudas → responde brevemente y redirige a reunión
5. Si no hay interés → responde con amabilidad, deja la puerta abierta
6. NO uses emojis excesivos, NO seas vendedor agresivo
7. NUNCA menciones que eres una IA
8. Personaliza usando el nombre del lead: ${firstName}

Responde ÚNICAMENTE con el texto del mensaje, sin comillas ni explicaciones adicionales.`;

    // ── 3. Build Anthropic message history ───────────────────────────────────

    const rawMessages: Anthropic.MessageParam[] = (messages ?? []).map((m) => ({
      role: (m.sender === "user" || m.sender === "ai") ? "assistant" : "user",
      content: String(m.message_text ?? ""),
    }));

    // Merge consecutive same-role messages (Anthropic requires alternating)
    const anthropicMessages: Anthropic.MessageParam[] = [];
    for (const m of rawMessages) {
      const last = anthropicMessages[anthropicMessages.length - 1];
      if (last && last.role === m.role) {
        last.content = `${last.content}\n${m.content}`;
      } else {
        anthropicMessages.push({ ...m });
      }
    }

    // Must start with user role
    if (anthropicMessages.length === 0 || anthropicMessages[0].role !== "user") {
      anthropicMessages.unshift({ role: "user", content: `Hola, soy ${firstName}.` });
    }

    // Skip if the last message is already ours
    if (anthropicMessages.at(-1)?.role === "assistant") {
      return NextResponse.json({ skipped: true, reason: "last_message_is_ours" });
    }

    // ── 4. Call Claude Sonnet ─────────────────────────────────────────────────

    const aiResponse = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 300,
      system:     systemPrompt,
      messages:   anthropicMessages,
    });

    const draftText =
      aiResponse.content[0].type === "text"
        ? aiResponse.content[0].text.trim()
        : null;

    if (!draftText) {
      return NextResponse.json({ error: "Empty response from Claude" }, { status: 500 });
    }

    // ── 5. Determine send mode ────────────────────────────────────────────────

    const autopilotMode = (conv.autopilot_mode as string) ?? "review";
    const autoSend = autopilotMode === "auto";

    // ── 6. Save draft message ─────────────────────────────────────────────────

    const { data: draftMsg } = await supabase
      .from("messages")
      .insert({
        conversation_id: record.conversation_id,
        lead_id:         conv.lead_id,
        workspace_id:    conv.workspace_id,
        sender:          "ai",
        message_text:    draftText,
        status:          autoSend ? "pending_send" : "draft",
        is_read:         true,
        timestamp:       new Date().toISOString(),
        metadata: {
          model:         "claude-sonnet-4-6",
          input_tokens:  aiResponse.usage.input_tokens,
          output_tokens: aiResponse.usage.output_tokens,
          auto_send:     autoSend,
        },
      })
      .select()
      .single();

    // ── 7. If auto mode, queue for the extension to send ─────────────────────

    if (autoSend && draftMsg) {
      await supabase.from("engine_queue").insert({
        workspace_id: conv.workspace_id,
        campaign_id:  conv.campaign_id ?? null,
        lead_id:      conv.lead_id,
        task_type:    "message",
        action_type:  "message",
        priority:     2,
        scheduled_at: new Date().toISOString(),
        payload: {
          profile_url:  lead.linkedin_url,
          message_text: draftText,
          lead_id:      conv.lead_id,
          campaign_id:  conv.campaign_id ?? null,
          draft_msg_id: draftMsg.id,
        },
      });
    }

    return NextResponse.json({
      success:    true,
      draftText,
      mode:       autoSend ? "auto" : "review",
      draftMsgId: draftMsg?.id ?? null,
    });
  } catch (e) {
    console.error("[Autopilot] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
