import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { lead_profile, tone = "consultivo", objective = "agendar_reunion" } = await req.json();

  const toneGuide: Record<string, string> = {
    formal:     "Usa un lenguaje formal y profesional.",
    consultivo: "Usa un tono consultivo y empático, como un asesor experto.",
    amigable:   "Usa un tono cercano, amigable y directo.",
    directo:    "Sé muy directo al grano, sin rodeos.",
  };
  const objectiveGuide: Record<string, string> = {
    agendar_reunion: "El objetivo es lograr una reunión o demo de 20-30 minutos.",
    calificar:       "El objetivo es calificar si el lead tiene necesidad y presupuesto.",
    propuesta:       "El objetivo es despertar interés para enviar una propuesta formal.",
    nutrir_lead:     "El objetivo es generar valor y mantener el interés del prospecto.",
  };

  const system = `Eres un experto en ventas B2B de SaaS. Redacta un mensaje de conexión de LinkedIn.
Reglas:
- Máximo 3 oraciones. Sin saludos genéricos. Sin emojis excesivos.
- Personaliza mencionando algo específico del perfil del lead.
- ${toneGuide[tone] ?? toneGuide.consultivo}
- ${objectiveGuide[objective] ?? objectiveGuide.agendar_reunion}
- Solo devuelve el texto del mensaje, sin explicaciones adicionales.`;

  try {
    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system,
      messages:   [{ role: "user", content: `Perfil del lead:\n\n${lead_profile}` }],
    });

    const message = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    return NextResponse.json({ message, tone, objective });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
