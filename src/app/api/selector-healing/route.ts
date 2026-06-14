// Selector Healing API — recibe un failure_id, llama a Claude Haiku
// para proponer un selector CSS corregido, y auto-aprueba si confianza >= 0.85.
//
// selector_key descriptions:
//   connect_btn      → Botón principal para enviar solicitud de conexión
//   note_field       → Textarea para escribir nota de conexión personalizada
//   send_btn         → Botón para confirmar y enviar la solicitud de conexión
//   message_btn      → Botón para abrir el chat/mensaje con el lead
//   message_field    → Textarea principal donde se escribe el mensaje
//   message_send_btn → Botón enviar dentro del chat
//   withdraw_btn     → Botón para retirar una invitación pendiente
//   more_options_btn → Botón de menú contextual con más acciones del perfil

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LOG = "[cazary.ai][SelectorHealing]";
const AUTO_APPROVE_THRESHOLD = 0.85;

function calcConfidence(proposedSelector: string, selectorTried: string): number {
  const s = proposedSelector.trim();
  if (!s || s === selectorTried) return 0;

  // aria-* o data-* → muy robusto
  if (/\[aria-|^button\[aria-|\[data-/.test(s)) return 1.0;

  // clases → moderado
  if (/^\.[a-zA-Z]/.test(s) || s.includes(" .")) return 0.7;

  // genérico (div, span, button sin clase/attr)
  return 0.4;
}

export async function POST(req: NextRequest) {
  const LOG_PREFIX = `${LOG} POST`;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const failureId = body.failure_id as string | undefined;

    if (!failureId) {
      return NextResponse.json({ error: "Missing failure_id" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Leer el failure
    const { data: failure, error: fetchErr } = await supabase
      .from("selector_failures")
      .select("*")
      .eq("id", failureId)
      .single();

    if (fetchErr || !failure) {
      console.error(`${LOG_PREFIX} failure not found:`, failureId, fetchErr);
      return NextResponse.json({ error: "Failure not found" }, { status: 404 });
    }

    if (failure.status !== "pending") {
      // Ya fue procesado
      return NextResponse.json({ skipped: true, status: failure.status });
    }

    // 2. Marcar como 'analyzing'
    await supabase
      .from("selector_failures")
      .update({ status: "analyzing" })
      .eq("id", failureId);

    console.log(`${LOG_PREFIX} analyzing failure ${failureId} (${failure.selector_key})`);

    // 3. Llamar a Claude Haiku
    const htmlContext = (failure.html_context ?? "").substring(0, 8000);

    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: "Eres un experto en selectores CSS y DOM de LinkedIn. Analiza el HTML proporcionado e identifica el selector CSS más robusto para encontrar el elemento indicado. Responde SOLO con el selector CSS, nada más.",
      messages: [
        {
          role: "user",
          content: `Plataforma: ${failure.platform}
Acción: ${failure.action}
Selector que falló: ${failure.selector_tried}
Clave del selector: ${failure.selector_key}

HTML del contexto donde debería estar el elemento:
${htmlContext || "(sin contexto disponible)"}

Proporciona el selector CSS más robusto para encontrar este elemento.`,
        },
      ],
    });

    const proposed = aiResponse.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim()
      .replace(/^```[a-z]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    if (!proposed) {
      await supabase
        .from("selector_failures")
        .update({ status: "pending" })
        .eq("id", failureId);
      console.warn(`${LOG_PREFIX} Claude returned empty selector for ${failureId}`);
      return NextResponse.json({ error: "Empty selector from AI" }, { status: 500 });
    }

    // 4. Calcular confianza
    const confidence = calcConfidence(proposed, failure.selector_tried);

    console.log(`${LOG_PREFIX} proposed="${proposed}" confidence=${confidence}`);

    // 5. Auto-aprobar o dejar como proposed
    if (confidence >= AUTO_APPROVE_THRESHOLD) {
      // Upsert en selector_overrides
      await supabase
        .from("selector_overrides")
        .upsert(
          {
            workspace_id:   failure.workspace_id,
            platform:       failure.platform,
            action:         failure.action,
            selector_key:   failure.selector_key,
            selector_value: proposed,
            active:         true,
          },
          { onConflict: "workspace_id,platform,action,selector_key" }
        );

      // Marcar failure como aprobado
      await supabase
        .from("selector_failures")
        .update({
          status:            "approved",
          proposed_selector: proposed,
          confidence,
          approved_at:       new Date().toISOString(),
          approved_by:       "auto",
        })
        .eq("id", failureId);

      console.log(`${LOG_PREFIX} AUTO-APPROVED ${failureId} → "${proposed}"`);
      return NextResponse.json({ approved: true, proposed, confidence });
    }

    // Confianza insuficiente → queda para revisión manual
    await supabase
      .from("selector_failures")
      .update({
        status:            "proposed",
        proposed_selector: proposed,
        confidence,
      })
      .eq("id", failureId);

    console.log(`${LOG_PREFIX} proposed (needs review) ${failureId} confidence=${confidence}`);
    return NextResponse.json({ approved: false, proposed, confidence });
  } catch (err) {
    console.error(`${LOG} unhandled error:`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
