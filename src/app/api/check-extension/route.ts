import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ connected: false });

    const { data: profile } = await supabase
      .from('profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!profile?.workspace_id) return Response.json({ connected: false });

    const wsId = profile.workspace_id;
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();

    // Verificar heartbeat reciente usando last_heartbeat_at (columna real del schema)
    const { data: session } = await supabase
      .from('ghost_engine_sessions')
      .select('id, last_heartbeat_at')
      .eq('workspace_id', wsId)
      .gte('last_heartbeat_at', fiveMinAgo)
      .limit(1);

    const engineActive = (session?.length ?? 0) > 0;

    // También devolver nombre de la cuenta LinkedIn vinculada
    const { data: liAccount } = await supabase
      .from('linkedin_accounts')
      .select('name, avatar_url, status')
      .eq('workspace_id', wsId)
      .eq('status', 'connected')
      .limit(1);

    const account = liAccount?.[0] ?? null;

    return Response.json({
      connected: engineActive,
      name: account?.name ?? null,
      avatar_url: account?.avatar_url ?? null,
      linkedin_connected: !!account,
    });
  } catch {
    return Response.json({ connected: false });
  }
}
