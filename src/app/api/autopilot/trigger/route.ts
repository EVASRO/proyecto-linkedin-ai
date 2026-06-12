import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const WEBHOOK_SECRET =
  process.env.AUTOPILOT_WEBHOOK_SECRET ?? "nexusai-autopilot-2024";

interface AgentData {
  name:              string | null;
  system_prompt:     string | null;
  tone:              string | null;
  objective:         string | null;
  value_proposition: string | null;
  objections:        Array<{ objection?: string; response?: string }> | null;
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "autopilot-trigger" });
}

export async function POST(req: NextRequest) {
  try {
    // -- Auth ------------------------------------------------------------------
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

    // -- 1. Load full context --------------------------------------------------

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

    // -- 2. Load assigned agent ------------------------------------------------

    let agentRow: AgentData | null = null;

    if (conv.assigned_agent_id) {
      const { data } = await supabase
        .from("agents")
        .select("name, system_prompt, tone, objective, value_proposition, objections")
        .eq("id", conv.assigned_agent_id)
        .single();
      agentRow = data as AgentData | null;

      if (!agentRow) {
        console.warn("[Autopilot] Agente no encontrado, usando prompt genérico");
      }
    }

    // -- 3. Load last N messages -----------------------------------------------

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

    // -- 4. Build system prompt from agent data --------------------------------

    const objectionsText = Array.isArray(agentRow?.objections)
      ? (agentRow!.objections as Array<{ objection?: string; response?: string }>)
          .filter((o) => o.objection)
          .map((o, i) => `${i + 1}. Objeción: "${o.objection ?? ""}" → Respuesta: "${o.response ?? ""}"`)
          .join("\n")
      : "";

    const systemPrompt = [
      `Eres ${agentRow?.name ?? "un asistente de ventas B2B"}.`,
      agentRow?.system_prompt
        ? `Tu personalidad y estilo: ${agentRow.system_prompt}`
        : "",
      agentRow?.value_proposition
        ? `Información sobre el producto/empresa que representas: ${agentRow.value_proposition}`
        : "",
      agentRow?.tone
        ? `Estilo de respuesta: ${agentRow.tone}.`
        : "Estilo de respuesta: profesional, directo y cercano.",
      objectionsText
        ? `Cómo manejar objeciones frecuentes:\n${objectionsText}`
        : "",
      agentRow?.objective
        ? `Tu objetivo principal: ${agentRow.objective}`
        : `Tu objetivo: ${String(wfJson.goal ?? "agendar una reunión o llamada de demo.")}.`,
      "",
      "REGLAS ESTRICTAS:",
      "- Responde siempre en el mismo idioma que usa el prospecto.",
      "- Máximo 3 oraciones por respuesta. Sé conciso.",
      "- Nunca menciones que eres una IA o un bot.",
      "- No uses emojis a menos que el prospecto los use primero.",
      "- Si el prospecto pide hablar con una persona real, di que lo conectarás pronto.",
      "- Si el prospecto dice que no le interesa, agradece su tiempo y cierra la conversación con clase.",
      "- Responde ÚNICAMENTE con el texto del mensaje, sin comillas ni explicaciones adicionales.",
    ].filter(Boolean).join("\n");

    // -- 5. Build user prompt with conversation history -----------------------

    const lastMessage = String(record.message_text ?? messages?.at(-1)?.message_text ?? "");

    const conversationHistory = (messages ?? [])
      .slice(-8)
      .map((m) => `${m.sender === "prospect" ? "PROSPECTO" : "TÚ"}: ${m.message_text}`)
      .join("\n");

    const userPrompt = [
      `Datos del prospecto:`,
      `- Nombre: ${lead.full_name ?? "Desconocido"}`,
      `- Empresa: ${lead.company ?? "—"}`,
      `- Cargo: ${String(lead.headline ?? lead.job_title ?? "—")}`,
      ``,
      `Historial reciente de la conversación:`,
      conversationHistory,
      ``,
      `El prospecto acaba de escribir:`,
      `"${lastMessage}"`,
      ``,
      `Responde como ${agentRow?.name ?? "el asistente"} siguiendo tus instrucciones.`,
    ].join("\n");

    // -- 6. Build Anthropic message list (alternating roles) -------------------

    // We use the full conversation history in the userPrompt already;
    // pass a single user turn to avoid duplication and role-alternation issues.
    const anthropicMessages: Anthropic.MessageParam[] = [
      { role: "user", content: userPrompt },
    ];

    // -- 7. Call Claude Sonnet -------------------------------------------------

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

    // -- 8. Determine send mode ------------------------------------------------

    const autopilotMode = (conv.autopilot_mode as string) ?? "review";
    const autoSend = autopilotMode === "auto";

    // -- 9. Save draft message -------------------------------------------------

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
          agent_id:      conv.assigned_agent_id ?? null,
          input_tokens:  aiResponse.usage.input_tokens,
          output_tokens: aiResponse.usage.output_tokens,
          auto_send:     autoSend,
        },
      })
      .select()
      .single();

    // -- 10. If auto mode, queue for the extension to send --------------------

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
