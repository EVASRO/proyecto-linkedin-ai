import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const {
    agent_config = {},
    conversation_history = [],
    prospect_message,
  } = await req.json();

  const {
    tone = "consultivo",
    objective = "agendar_reunion",
    value_proposition = "",
    objections = [],
  } = agent_config as {
    tone?: string;
    objective?: string;
    value_proposition?: string;
    objections?: { question: string; answer: string }[];
  };

  const toneMap: Record<string, string> = {
    formal:     "formal y profesional",
    consultivo: "consultivo y empático",
    amigable:   "amigable y cercano",
    directo:    "directo y conciso",
  };
  const objMap: Record<string, string> = {
    agendar_reunion:  "agendar una reunión o demo de 20 minutos",
    enviar_propuesta: "enviar una propuesta comercial",
    calificar_lead:   "calificar si tiene necesidad y presupuesto",
    nutrir_lead:      "mantener el interés hasta que esté listo",
  };

  const objText = objections
    .slice(0, 5)
    .map((o) => `- Si dicen '${o.question}' → responde: '${o.answer}'`)
    .join("\n");

  const system = `Eres un agente de ventas B2B con tono ${toneMap[tone] ?? "consultivo"}.
Tu objetivo es ${objMap[objective] ?? "agendar una reunión"}.
Propuesta de valor: ${value_proposition || "cazary.ai automatiza la prospección en LinkedIn con IA."}

Manejo de objeciones:
${objText || "- Sé empático y ofrece más información."}

Reglas:
- Máximo 2 oraciones de respuesta.
- No rompas el personaje. Responde directamente como el agente.
- Si el prospecto muestra interés, avanza hacia el objetivo.`;

  const history = (conversation_history as { role: string; text: string }[])
    .slice(-6)
    .filter((m) => m.text)
    .map((m) => ({
      role:    m.role === "prospect" ? "user" : "assistant",
      content: m.text,
    }));
  history.push({ role: "user", content: prospect_message });

  try {
    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system,
      messages:   history as Anthropic.MessageParam[],
    });

    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    return NextResponse.json({ reply }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502, headers: corsHeaders });
  }
}
