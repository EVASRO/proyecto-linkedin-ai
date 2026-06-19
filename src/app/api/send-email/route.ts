import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@/lib/supabase/server';

function interpolate(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(k, v),
    text
  );
}

export async function POST(req: NextRequest) {
  let email_queue_id: string | null = null;
  try {
    const body = await req.json();
    email_queue_id = body.email_queue_id ?? null;
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
    const meta = (emailJob.metadata ?? {}) as Record<string, string>;
    const vars: Record<string, string> = {
      '{{nombre}}':          toName.split(' ')[0] ?? '',
      '{{nombre_completo}}': toName,
      '{{empresa}}':         meta.company ?? '',
      '{{cargo}}':           meta.job_title ?? '',
    };
    const subject  = interpolate(emailJob.subject,   vars);
    const bodyHtml = interpolate(emailJob.body_html, vars);
    const bodyText = emailJob.body_text
      ? interpolate(emailJob.body_text, vars)
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
    if (email_queue_id) {
      const supabase = await createClient();
      await supabase
        .from('email_queue')
        .update({ status: 'failed', last_error: msg })
        .eq('id', email_queue_id)
        .then(() => {}, () => {});
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
