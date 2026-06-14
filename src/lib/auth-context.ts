"use server";

import { createClient } from "@/lib/supabase/server";

export type AuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  workspaceId: string;
};

/**
 * Obtiene el contexto de autenticación y workspace del usuario actual.
 * Si el usuario no tiene workspace, crea uno automáticamente.
 * Lanza error si el usuario no está autenticado.
 */
export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

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
      await supabase
        .from("profiles")
        .update({ workspace_id: ws.id })
        .eq("id", user.id);
      await supabase
        .from("workspace_settings")
        .insert({ workspace_id: ws.id });
    }

    return { supabase, userId: user.id, workspaceId: ws?.id ?? "" };
  }

  return {
    supabase,
    userId: user.id,
    workspaceId: profile.workspace_id as string,
  };
}
