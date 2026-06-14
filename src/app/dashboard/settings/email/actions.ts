'use server';

import { getAuthContext } from '@/lib/auth-context';

export type EmailProviderConfig = {
  provider_type: 'smtp' | 'resend' | 'mailgun' | 'sendgrid';
  host?: string;
  port?: string;
  user?: string;
  pass?: string;
  api_key?: string;
  domain?: string;
  from_name: string;
  from_email: string;
};

export type EmailProvider = {
  id: string;
  workspace_id: string;
  provider_type: string;
  config: Record<string, string>;
  is_active: boolean;
  verified: boolean;
  created_at: string;
};

export async function getEmailProvider(): Promise<{ data: EmailProvider | null }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();
    const { data } = await supabase
      .from('email_providers')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();
    return { data: data ?? null };
  } catch {
    return { data: null };
  }
}

export async function saveEmailProvider(
  config: EmailProviderConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId } = await getAuthContext();

    const record = {
      workspace_id:  workspaceId,
      provider_type: config.provider_type,
      is_active:     true,
      verified:      false,
      config: {
        from_name:  config.from_name,
        from_email: config.from_email,
        ...(config.provider_type === 'smtp'
          ? { host: config.host, port: config.port, user: config.user, pass: config.pass }
          : {}),
        ...(config.provider_type !== 'smtp'
          ? { api_key: config.api_key, domain: config.domain ?? '' }
          : {}),
      },
    };

    const { error } = await supabase
      .from('email_providers')
      .upsert(record, { onConflict: 'workspace_id' });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendTestEmail(): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, workspaceId, userId } = await getAuthContext();

    const { data: user } = await supabase.auth.getUser();
    const email = user.user?.email;
    if (!email) return { success: false, error: 'No se encontró email del usuario' };

    const { data: inserted, error: insErr } = await supabase
      .from('email_queue')
      .insert({
        workspace_id: workspaceId,
        to_email:     email,
        to_name:      user.user?.user_metadata?.full_name ?? 'Usuario',
        subject:      '✅ Email de prueba desde cazary.ai',
        body_html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#4f46e5">¡Tu proveedor de email funciona! 🎉</h2>
            <p>Si recibes este mensaje, la configuración de email en cazary.ai está correcta.</p>
            <p style="color:#6b7280;font-size:12px">Enviado desde cazary.ai · ${new Date().toLocaleString('es-PE')}</p>
          </div>`,
        status:      'pending',
        scheduled_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insErr || !inserted) return { success: false, error: insErr?.message ?? 'Error al crear el job' };

    // Trigger send immediately
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/send-email`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email_queue_id: inserted.id }),
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error ?? 'Error al enviar' };

    // Mark as verified after successful test
    await supabase
      .from('email_providers')
      .update({ verified: true })
      .eq('workspace_id', workspaceId);

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
