import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@/lib/supabase/server';

function interpolate(text: string, name: string): string {
  const first = name.split(' ')[0] ?? '';
  return text
    .replace(/\{\{nombre\}\}/gi, first)
    .replace(/\{\{nombre_completo\}\}/gi, name);
}

export async function POST(req: NextRequest) {
  try {
    const { email_queue_id } = await req.json();
    if (!email_queue_id) {
      return NextResponse.json({ error: 'email_queue_id required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: emailJob, error: jobErr } = await supabase
      .from('email_queue')
      .select('*')
      .eq('id', email_queue_id)
      .eq('status', 'pending')
      .single();

    if (jobErr || !emailJob) {
      return NextResponse.json({ error: 'Email job not found or already processed' }, { status: 404 });
    }

    const { data: provider } = await supabase
      .from('email_providers')
      .select('*')
      .eq('workspace_id', emailJob.workspace_id)
      .eq('is_active', true)
      .single();

    if (!provider) {
      await supabase
        .from('email_queue')
        .update({ status: 'failed', last_error: 'No email provider configured' })
        .eq('id', email_queue_id);
      return NextResponse.json({ error: 'No provider configured' }, { status: 422 });
    }

    const toName = emailJob.to_name ?? '';
    const subject = interpolate(emailJob.subject, toName);
    const bodyHtml = interpolate(emailJob.body_html, toName);
    const bodyText = emailJob.body_text
      ? interpolate(emailJob.body_text, toName)
      : bodyHtml.replace(/<[^>]+>/g, '');

    let messageId: string | undefined;

    const cfg = provider.config as Record<string, string>;

    if (provider.provider_type === 'smtp') {
      const transporter = nodemailer.createTransport({
        host:   cfg.host,
        port:   parseInt(cfg.port ?? '587'),
        secure: cfg.port === '465',
        auth:   { user: cfg.user, pass: cfg.pass },
      });
      const info = await transporter.sendMail({
        from:    `"${cfg.from_name}" <${cfg.from_email}>`,
        to:      toName ? `"${toName}" <${emailJob.to_email}>` : emailJob.to_email,
        subject,
        html:    bodyHtml,
        text:    bodyText,
      });
      messageId = info.messageId;

    } else if (provider.provider_type === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${cfg.api_key}`,
        },
        body: JSON.stringify({
          from:    `${cfg.from_name} <${cfg.from_email}>`,
          to:      [emailJob.to_email],
          subject,
          html:    bodyHtml,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message ?? 'Resend error');
      messageId = resData.id;

    } else if (provider.provider_type === 'mailgun') {
      const domain = cfg.domain;
      const form   = new FormData();
      form.append('from',    `${cfg.from_name} <${cfg.from_email}>`);
      form.append('to',      emailJob.to_email);
      form.append('subject', subject);
      form.append('html',    bodyHtml);
      const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method:  'POST',
        headers: { 'Authorization': `Basic ${btoa('api:' + cfg.api_key)}` },
        body:    form,
      });
      const mgData = await res.json();
      if (!res.ok) throw new Error(mgData.message ?? 'Mailgun error');
      messageId = mgData.id;

    } else if (provider.provider_type === 'sendgrid') {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${cfg.api_key}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: emailJob.to_email, name: toName }] }],
          from:             { email: cfg.from_email, name: cfg.from_name },
          subject,
          content:          [{ type: 'text/html', value: bodyHtml }],
        }),
      });
      if (!res.ok) {
        const sgData = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(sgData));
      }
      messageId = res.headers.get('x-message-id') ?? undefined;
    }

    await supabase
      .from('email_queue')
      .update({ status: 'sent', sent_at: new Date().toISOString(), message_id: messageId ?? null })
      .eq('id', email_queue_id);

    return NextResponse.json({ success: true, messageId });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
