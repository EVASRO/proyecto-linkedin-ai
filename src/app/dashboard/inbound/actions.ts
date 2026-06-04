"use server";

import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();
  return { supabase, workspaceId: profile?.workspace_id ?? "" };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type InboundPost = {
  id: string;
  workspace_id: string;
  post_url: string;
  status: "monitoring" | "paused" | "error";
  note: string | null;
  leads_captured: number;
  created_at: string;
};

export type InboundLead = {
  id: string;
  full_name: string;
  linkedin_url: string | null;
  company: string | null;
  status: string;
  tags: string[];
  created_at: string;
};

// ── getInboundData ────────────────────────────────────────────────────────────

export async function getInboundData(): Promise<{
  success: boolean;
  data?: { posts: InboundPost[]; inboundLeads: InboundLead[] };
  error?: string;
}> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const [postsRes, leadsRes] = await Promise.all([
      supabase
        .from("inbound_posts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("leads")
        .select("id, full_name, linkedin_url, company, status, tags, created_at")
        .eq("workspace_id", workspaceId)
        .contains("tags", ["inbound"])
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      success: true,
      data: {
        posts:        (postsRes.data ?? []) as InboundPost[],
        inboundLeads: (leadsRes.data ?? []) as InboundLead[],
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── addPostToMonitor ──────────────────────────────────────────────────────────

export async function addPostToMonitor(
  postUrl: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase.from("inbound_posts").insert({
      workspace_id:   workspaceId,
      post_url:       postUrl,
      status:         "monitoring",
      note:           note ?? "",
      leads_captured: 0,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── togglePostStatus ──────────────────────────────────────────────────────────

export async function togglePostStatus(
  postId: string,
  status: "monitoring" | "paused"
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { error } = await supabase
      .from("inbound_posts")
      .update({ status })
      .eq("id", postId)
      .eq("workspace_id", workspaceId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── removePost ────────────────────────────────────────────────────────────────

export async function removePost(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    await supabase
      .from("inbound_posts")
      .delete()
      .eq("id", postId)
      .eq("workspace_id", workspaceId);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── generateContent ───────────────────────────────────────────────────────────

export async function generateContent(params: {
  topic: string;
  tone: "profesional" | "cercano" | "provocador" | "educativo";
  format: "post" | "carrusel" | "historia" | "encuesta";
  industry: string;
  cta: string;
}): Promise<{ success: boolean; data?: { content: string }; error?: string }> {
  const formatGuide: Record<string, string> = {
    post:     "Post LinkedIn estándar (1300 chars max). Usa saltos de línea estratégicos, 3-5 emojis máximo.",
    carrusel: "Guion para carrusel de 5-7 slides. Formato: [SLIDE 1]: título\n[SLIDE 2]: contenido...",
    historia: "Historia personal con arco narrativo: situación → conflicto → aprendizaje → CTA.",
    encuesta: "Post con pregunta de encuesta + 4 opciones + contexto del por qué importa.",
  };

  const toneGuide: Record<string, string> = {
    profesional: "Tono ejecutivo, datos y cifras, lenguaje formal pero accesible.",
    cercano:     "Primera persona, anécdotas reales, lenguaje conversacional.",
    provocador:  "Opinión controvertida, desafía el status quo, genera debate.",
    educativo:   "Estructura de enseñanza, paso a paso, agrega valor concreto.",
  };

  const prompt = `Eres un experto en LinkedIn marketing B2B para el sector ${params.industry}.

Crea contenido con estas especificaciones:
- Formato: ${formatGuide[params.format]}
- Tono: ${toneGuide[params.tone]}
- Tema: ${params.topic}
- CTA final: ${params.cta}

Optimiza para máximo engagement en LinkedIn.
Solo devuelve el contenido listo para publicar, sin explicaciones.`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 1500,
      messages:   [{ role: "user", content: prompt }],
    });

    const content = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    return { success: true, data: { content } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
