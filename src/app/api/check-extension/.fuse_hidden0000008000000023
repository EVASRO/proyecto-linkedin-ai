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

    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data } = await supabase
      .from('ghost_engine_sessions')
      .select('id')
      .eq('workspace_id', profile.workspace_id)
      .gte('last_ping', fiveMinAgo)
      .limit(1);

    return Response.json({ connected: (data?.length ?? 0) > 0 });
  } catch {
    return Response.json({ connected: false });
  }
}
