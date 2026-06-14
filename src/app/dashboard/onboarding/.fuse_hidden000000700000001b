'use server';

import { createClient } from '@/lib/supabase/server';

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('No autenticado');

  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .single();

  if (!profile?.workspace_id) throw new Error('No workspace');

  return { supabase, userId: user.id, workspaceId: profile.workspace_id as string };
}

export async function getOnboardingState(): Promise<{
  completed: boolean;
  step: number;
  workspaceName: string | null;
  linkedinConnected: boolean;
}> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { data } = await supabase
      .from('workspaces')
      .select('onboarding_completed, onboarding_step, workspace_name, linkedin_connected')
      .eq('id', workspaceId)
      .single();
    return {
      completed: data?.onboarding_completed ?? false,
      step: data?.onboarding_step ?? 0,
      workspaceName: data?.workspace_name ?? null,
      linkedinConnected: data?.linkedin_connected ?? false,
    };
  } catch {
    return { completed: false, step: 0, workspaceName: null, linkedinConnected: false };
  }
}

export async function saveOnboardingStep(
  step: number,
  data: Partial<{
    workspace_name: string;
    linkedin_connected: boolean;
    onboarding_completed: boolean;
  }>
): Promise<{ success: boolean }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    await supabase
      .from('workspaces')
      .update({ onboarding_step: step, ...data })
      .eq('id', workspaceId);
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function completeOnboarding(): Promise<{ success: boolean }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    await supabase
      .from('workspaces')
      .update({ onboarding_step: 5, onboarding_completed: true })
      .eq('id', workspaceId);
    // Store in auth metadata so middleware can read without extra DB query
    await supabase.auth.updateUser({ data: { onboarding_completed: true } });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function createFirstCampaign(
  name: string,
  type: string,
  goal: string
): Promise<{ success: boolean; campaignId?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { data } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: workspaceId,
        name,
        type: type || 'linkedin',
        status: 'draft',
        workflow_json: { goal, connection_note: '', follow_up_message: '' },
      })
      .select('id')
      .single();
    return { success: true, campaignId: data?.id };
  } catch {
    return { success: false };
  }
}
