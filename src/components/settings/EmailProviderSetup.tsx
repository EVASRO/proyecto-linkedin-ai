'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Settings2,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  saveEmailProvider,
  sendTestEmail,
  type EmailProvider,
  type EmailProviderConfig,
} from '@/app/dashboard/settings/email/actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProviderType = 'smtp' | 'resend' | 'mailgun' | 'sendgrid';

const PROVIDERS: { type: ProviderType; label: string; badge?: string; desc: string }[] = [
  { type: 'resend',    label: 'Resend',     badge: 'Recomendado', desc: 'Gratis hasta 3.000 emails/mes' },
  { type: 'smtp',      label: 'SMTP',                             desc: 'Gmail, Outlook, cualquier servidor' },
  { type: 'mailgun',   label: 'Mailgun',                          desc: 'API robusta, ideal para volumen' },
  { type: 'sendgrid',  label: 'SendGrid',                         desc: 'Popular en startups, gratis 100/día' },
];

// ---------------------------------------------------------------------------
// Field components
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[var(--foreground-muted)]">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-faint)] focus:border-[#2563EB] focus:ring-2 focus:ring-[rgba(37,99,235,0.2)] transition-all';

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputCls} pr-9 w-full`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider-specific form fields
// ---------------------------------------------------------------------------

function SmtpFields({
  cfg,
  set,
}: {
  cfg: Partial<EmailProviderConfig>;
  set: (p: Partial<EmailProviderConfig>) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field label="Host SMTP">
            <input
              value={cfg.host ?? ''}
              onChange={(e) => set({ host: e.target.value })}
              placeholder="smtp.gmail.com"
              className={`${inputCls} w-full`}
            />
          </Field>
        </div>
        <Field label="Puerto">
          <input
            value={cfg.port ?? '587'}
            onChange={(e) => set({ port: e.target.value })}
            placeholder="587"
            className={`${inputCls} w-full`}
          />
        </Field>
      </div>
      <Field label="Usuario">
        <input
          value={cfg.user ?? ''}
          onChange={(e) => set({ user: e.target.value })}
          placeholder="tu@gmail.com"
          className={`${inputCls} w-full`}
        />
      </Field>
      <Field label="Contraseña de aplicación">
        <PasswordInput
          value={cfg.pass ?? ''}
          onChange={(v) => set({ pass: v })}
          placeholder="xxxx xxxx xxxx xxxx"
        />
      </Field>
    </>
  );
}

function ApiKeyFields({
  cfg,
  set,
  showDomain,
}: {
  cfg: Partial<EmailProviderConfig>;
  set: (p: Partial<EmailProviderConfig>) => void;
  showDomain?: boolean;
}) {
  return (
    <>
      <Field label="API Key">
        <PasswordInput
          value={cfg.api_key ?? ''}
          onChange={(v) => set({ api_key: v })}
          placeholder="re_xxxxxxxxxxxxxxxx"
        />
      </Field>
      {showDomain && (
        <Field label="Dominio">
          <input
            value={cfg.domain ?? ''}
            onChange={(e) => set({ domain: e.target.value })}
            placeholder="mg.tudominio.com"
            className={`${inputCls} w-full`}
          />
        </Field>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EmailProviderSetup({ initial }: { initial: EmailProvider | null }) {
  const [providerType, setProviderType] = useState<ProviderType>(
    (initial?.provider_type as ProviderType) ?? 'resend'
  );
  const [cfg, setCfg] = useState<Partial<EmailProviderConfig>>({
    from_name:  (initial?.config.from_name  as string) ?? '',
    from_email: (initial?.config.from_email as string) ?? '',
    host:       (initial?.config.host       as string) ?? '',
    port:       (initial?.config.port       as string) ?? '587',
    user:       (initial?.config.user       as string) ?? '',
    pass:       '',
    api_key:    '',
    domain:     (initial?.config.domain     as string) ?? '',
  });

  const [saving,   setSaving]   = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [status,   setStatus]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [verified, setVerified] = useState(initial?.verified ?? false);

  function set(partial: Partial<EmailProviderConfig>) {
    setCfg((prev) => ({ ...prev, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    const res = await saveEmailProvider({ ...cfg, provider_type: providerType } as EmailProviderConfig);
    setSaving(false);
    setStatus(res.success ? { ok: true, msg: '¡Proveedor guardado!' } : { ok: false, msg: res.error ?? 'Error al guardar' });
  }

  async function handleTest() {
    setTesting(true);
    setStatus(null);
    const res = await sendTestEmail();
    setTesting(false);
    if (res.success) {
      setVerified(true);
      setStatus({ ok: true, msg: `Email de prueba enviado a tu cuenta. ¡Revisa tu bandeja!` });
    } else {
      setStatus({ ok: false, msg: res.error ?? 'Error al enviar email de prueba' });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(37,99,235,0.12)]">
          <Settings2 className="h-4.5 w-4.5 text-[#2563EB]" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[var(--foreground)]">Proveedor de Email</h2>
          <p className="text-xs text-[var(--foreground-muted)]">Configura cómo cazary.ai envía emails a tus leads</p>
        </div>
        {verified && (
          <div className="ml-auto flex items-center gap-1.5 rounded-full border border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.12)] px-3 py-1 text-xs font-semibold text-[#10B981]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Verificado
          </div>
        )}
      </div>

      {/* Provider selector */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PROVIDERS.map((p) => (
          <button
            key={p.type}
            onClick={() => setProviderType(p.type)}
            className={[
              'flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-all',
              providerType === p.type
                ? 'border-[#2563EB] bg-[rgba(37,99,235,0.08)] ring-1 ring-[rgba(37,99,235,0.3)]'
                : 'border-[var(--border)] bg-[var(--background)] hover:border-[rgba(37,99,235,0.4)]',
            ].join(' ')}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[var(--foreground)]">{p.label}</span>
              {p.badge && (
                <span className="rounded-full bg-[rgba(37,99,235,0.15)] px-1.5 py-0.5 text-[9px] font-bold text-[#2563EB]">
                  {p.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] text-[var(--foreground-faint)]">{p.desc}</span>
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        {/* Sender info (common to all) */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre del remitente">
            <input
              value={cfg.from_name ?? ''}
              onChange={(e) => set({ from_name: e.target.value })}
              placeholder="Equipo Ventas Acme"
              className={`${inputCls} w-full`}
            />
          </Field>
          <Field label="Email del remitente">
            <input
              type="email"
              value={cfg.from_email ?? ''}
              onChange={(e) => set({ from_email: e.target.value })}
              placeholder="ventas@acme.com"
              className={`${inputCls} w-full`}
            />
          </Field>
        </div>

        <div className="h-px bg-[var(--border)]" />

        {/* Provider-specific fields */}
        {providerType === 'smtp'     && <SmtpFields     cfg={cfg} set={set} />}
        {providerType === 'resend'   && <ApiKeyFields   cfg={cfg} set={set} />}
        {providerType === 'mailgun'  && <ApiKeyFields   cfg={cfg} set={set} showDomain />}
        {providerType === 'sendgrid' && <ApiKeyFields   cfg={cfg} set={set} />}

        {/* Resend hint */}
        {providerType === 'resend' && (
          <div className="rounded-lg bg-[rgba(37,99,235,0.06)] px-3 py-2.5 text-[11px] text-[var(--foreground-muted)]">
            <span className="font-semibold">ℹ️ Resend:</span> El email remitente debe estar verificado en tu cuenta Resend.
            Regístrate gratis en{' '}
            <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline text-[#2563EB]">
              resend.com
            </a>
          </div>
        )}
      </div>

      {/* Status message */}
      {status && (
        <div
          className={[
            'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm',
            status.ok
              ? 'border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)] text-[#10B981]'
              : 'border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] text-[#EF4444]',
          ].join(' ')}
        >
          {status.ok
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <AlertCircle  className="h-4 w-4 shrink-0" />}
          {status.msg}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !cfg.from_email || !cfg.from_name}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-5 py-2.5 text-sm font-semibold
                     text-white shadow-[0_0_16px_rgba(37,99,235,0.3)] transition-all hover:opacity-90
                     disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar configuración
        </button>

        <button
          onClick={handleTest}
          disabled={testing || saving}
          className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5
                     text-sm font-semibold text-[var(--foreground-muted)] transition-all hover:border-[rgba(37,99,235,0.4)] hover:text-[#2563EB]
                     disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar email de prueba
        </button>
      </div>
    </div>
  );
}
