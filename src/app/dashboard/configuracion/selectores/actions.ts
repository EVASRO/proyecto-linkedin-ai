"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();
  return { supabase, workspaceId: profile?.workspace_id ?? "", userId: user.id };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type SelectorFailureRow = {
  id:                string;
  workspace_id:      string;
  created_at:        string;
  platform:          "linkedin" | "salesnav";
  action:            string;
  selector_key:      string;
  selector_tried:    string;
  html_context:      string | null;
  page_url:          string | null;
  status:            "pending" | "analyzing" | "proposed" | "approved" | "rejected";
  proposed_selector: string | null;
  confidence:        number | null;
  approved_at:       string | null;
  approved_by:       string | null;
};

export type SelectorOverrideRow = {
  id:             string;
  workspace_id:   string;
  platform:       string;
  action:         string;
  selector_key:   string;
  selector_value: string;
  active:         boolean;
  created_at:     string;
};

// ── getSelectorFailures ───────────────────────────────────────────────────────

export async function getSelectorFailures(): Promise<{
  success:   boolean;
  failures?: SelectorFailureRow[];
  overrides?: SelectorOverrideRow[];
  error?:    string;
}> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const [failuresRes, overridesRes] = await Promise.all([
      supabase
        .from("selector_failures")
        .select("*")
        .eq("workspace_id", workspaceId)
        .not("status", "eq", "rejected")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("selector_overrides")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("active", true)
        .order("created_at", { ascending: false }),
    ]);

    return {
      success:   true,
      failures:  (failuresRes.data ?? []) as SelectorFailureRow[],
      overrides: (overridesRes.data ?? []) as SelectorOverrideRow[],
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── approveSelector ───────────────────────────────────────────────────────────

export async function approveSelector(
  failureId: string,
  selectorValue: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId, userId } = await getAuthContext();

    const { data: failure } = await supabase
      .from("selector_failures")
      .select("platform,action,selector_key,confidence")
      .eq("id", failureId)
      .eq("workspace_id", workspaceId)
      .single();

    if (!failure) return { success: false, error: "Failure no encontrado" };

    await supabase
      .from("selector_overrides")
      .upsert(
        {
          workspace_id:   workspaceId,
          platform:       failure.platform,
          action:         failure.action,
          selector_key:   failure.selector_key,
          selector_value: selectorValue,
          active:         true,
        },
        { onConflict: "workspace_id,platform,action,selector_key" }
      );

    await supabase
      .from("selector_failures")
      .update({
        status:            "approved",
        proposed_selector: selectorValue,
        approved_at:       new Date().toISOString(),
        approved_by:       userId,
      })
      .eq("id", failureId);

    revalidatePath("/dashboard/configuracion/selectores");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── rejectSelector ────────────────────────────────────────────────────────────

export async function rejectSelector(
  failureId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    await supabase
      .from("selector_failures")
      .update({ status: "rejected" })
      .eq("id", failureId)
      .eq("workspace_id", workspaceId);

    revalidatePath("/dashboard/configuracion/selectores");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── deactivateOverride ────────────────────────────────────────────────────────

export async function deactivateOverride(
  overrideId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    await supabase
      .from("selector_overrides")
      .update({ active: false })
      .eq("id", overrideId)
      .eq("workspace_id", workspaceId);

    revalidatePath("/dashboard/configuracion/selectores");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
