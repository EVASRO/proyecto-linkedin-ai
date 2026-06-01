"use server";

import { createClient } from "@/lib/supabase/server";
import type { Conversation } from "@/components/smart-inbox/types";

type Result<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T };

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();
  return { supabase, userId: user.id, workspaceId: profile?.workspace_id as string };
}

function mapLeadToConversation(l: Record<string, unknown>): Conversation {
  return {
    id:              String(l.id),
    status:          "active",
    autopilotActive: false,
    unreadCount:     0,
    messages:        [],
    aiSuggestions:   [],
    lead: {
      id:          String(l.id),
      name:        String(l.full_name ?? "Sin nombre"),
      company:     String(l.company ?? "—"),
      title:       String(l.headline ?? ""),
      email:       l.email       ? String(l.email)        : undefined,
      phone:       l.phone       ? String(l.phone)        : undefined,
      linkedinUrl: l.linkedin_url ? String(l.linkedin_url) : undefined,
      source:      "linkedin" as const,
      pipeline:    "en_contacto" as const,
      tags:        [],
      value:       Number(l.value ?? 0),
      notes:       String(l.ai_summary ?? ""),
      createdAt:   String((l.created_at as string)?.slice(0, 10) ?? ""),
    },
  };
}

export async function getInboxData(): Promise<Result<{ conversations: Conversation[] }>> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("status", ["contactado", "respondio"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return { success: false, error: error.message };

    const conversations = (data ?? []).map((l) =>
      mapLeadToConversation(l as Record<string, unknown>)
    );

    return { success: true, data: { conversations } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
