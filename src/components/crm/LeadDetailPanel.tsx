'use client';

import { useState, useEffect } from 'react';
import {
  X, ExternalLink, Mail, Phone, MapPin, Link2, Loader2,
  UserPlus, UserCheck, MessageSquare, MessageCircle,
  Eye, ArrowRight, Zap,
} from 'lucide-react';
import { getLeadDetail, updateLeadField } from '@/app/dashboard/crm/actions';

type Tab = 'profile' | 'activity' | 'messages';

interface LeadDetailPanelProps {
  leadId: string | null;
  onClose: () => void;
  onStageChange?: (leadId: string, newStage: string) => void;
}

type DetailData = NonNullable<Awaited<ReturnType<typeof getLeadDetail>>['data']>;

const ACTION_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  connect_sent:     { icon: UserPlus,      color: 'text-[#2563EB]'  },
  connect_accepted: { icon: UserCheck,     color: 'text-[#10B981]'  },
  message_sent:     { icon: MessageSquare, color: 'text-[#06B6D4]'  },
  reply_received:   { icon: MessageCircle, color: 'text-[#F59E0B]'  },
  view_profile:     { icon: Eye,           color: 'text-[var(--foreground-faint)]' },
  stage_changed:    { icon: ArrowRight,    color: 'text-[#2563EB]'  },
};

const STAGES = [
  { key: 'extraido',           label: 'Extraído'        },
  { key: 'conexion_enviada',   label: 'Conexión env.'   },
  { key: 'conexion_aceptada',  label: 'Conectado'       },
  { key: 'en_conversacion',    label: 'En conversación' },
  { key: 'reunion_agendada',   label: 'Reunión agend.'  },
  { key: 'cliente',            label: 'Cliente'         },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'ahora';
  if (mins < 60)  return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 30)  return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es', { day: '2-digit', month: 'short' });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--foreground-faint)]">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, href, external }: {
  icon: React.ElementType; label: string; value: string | null;
  href?: string; external?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-[var(--foreground-faint)]" />
      <span className="w-16 flex-shrink-0 text-[10px] text-[var(--foreground-muted)]">{label}</span>
      {href ? (
        <a href={href} target={external ? '_blank' : undefined} rel="noopener noreferrer"
           className="truncate text-xs text-[#2563EB] hover:underline">
          {value}
        </a>
      ) : (
        <span className="truncate text-xs text-[var(--foreground)]">{value}</span>
      )}
    </div>
  );
}

export function LeadDetailPanel({ leadId, onClose, onStageChange }: LeadDetailPanelProps) {
  const [tab, setTab]         = useState<Tab>('profile');
  const [data, setData]       = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!leadId) { setData(null); return; }
    setLoading(true);
    setTab('profile');
    getLeadDetail(leadId).then((res) => {
      if (res.success && res.data) {
        setData(res.data);
        setEditNotes((res.data.lead.notes as string) ?? '');
      }
      setLoading(false);
    });
  }, [leadId]);

  const isOpen = !!leadId;
  const lead   = data?.lead;

  const initials = lead
    ? String(lead.full_name ?? '').split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase()
    : '';

  async function handleStageChange(newStage: string) {
    if (!leadId || !data) return;
    setSaving(true);
    await updateLeadField(leadId, { crm_column: newStage });
    setData((prev) => prev ? { ...prev, lead: { ...prev.lead, crm_column: newStage } } : prev);
    onStageChange?.(leadId, newStage);
    setSaving(false);
  }

  async function handleSaveNotes() {
    if (!leadId) return;
    setSaving(true);
    await updateLeadField(leadId, { notes: editNotes });
    setSaving(false);
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}

      <div className={[
        'fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col',
        'bg-[var(--surface)] shadow-2xl border-l border-[var(--border)]',
        'transition-transform duration-300',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}>

        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--foreground-muted)]" />
          </div>
        ) : lead ? (
          <>
            {/* HEADER */}
            <div className="flex-shrink-0 border-b border-[var(--border)] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center
                                rounded-full bg-gradient-to-br from-[#2563EB] to-[#06B6D4]
                                text-sm font-bold text-white overflow-hidden">
                  {lead.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={String(lead.avatar_url)} className="h-12 w-12 object-cover" alt="" />
                    : initials}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-bold text-[var(--foreground)]">
                    {String(lead.full_name ?? 'Sin nombre')}
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-[var(--foreground-muted)]">
                    {[lead.headline, lead.company].filter(Boolean).join(' · ')}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {typeof lead.score === 'number' && (
                      <span className={[
                        'rounded-full px-2 py-0.5 text-[10px] font-bold',
                        (lead.score as number) >= 80
                          ? 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B]'
                          : (lead.score as number) >= 50
                          ? 'bg-[rgba(37,99,235,0.15)] text-[#2563EB]'
                          : 'bg-[var(--border)] text-[var(--foreground-muted)]',
                      ].join(' ')}>
                        Score {lead.score as number}
                      </span>
                    )}
                    <span className="rounded-full bg-[rgba(37,99,235,0.12)] px-2 py-0.5 text-[10px] font-medium text-[#2563EB]">
                      {STAGES.find((s) => s.key === lead.crm_column)?.label ?? String(lead.crm_column ?? '—')}
                    </span>
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {!!lead.linkedin_url && (
                    <a
                      href={String(lead.linkedin_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-7 w-7 items-center justify-center rounded-lg
                                 border border-[var(--border)] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                      title="Abrir en LinkedIn"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-[var(--foreground-muted)]" />
                    </a>
                  )}
                  <button
                    onClick={onClose}
                    className="flex h-7 w-7 items-center justify-center rounded-lg
                               border border-[var(--border)] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                  >
                    <X className="h-3.5 w-3.5 text-[var(--foreground-muted)]" />
                  </button>
                </div>
              </div>
            </div>

            {/* TABS */}
            <div className="flex-shrink-0 border-b border-[var(--border)] px-4">
              <div className="flex gap-4">
                {(['profile', 'activity', 'messages'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={[
                      '-mb-px border-b-2 py-2.5 text-xs font-medium transition-colors',
                      tab === t
                        ? 'border-[#2563EB] text-[#2563EB]'
                        : 'border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]',
                    ].join(' ')}
                  >
                    {t === 'profile' ? 'Perfil' : t === 'activity' ? 'Actividad' : 'Mensajes'}
                    {t === 'messages' && (data?.messages?.length ?? 0) > 0 && (
                      <span className="ml-1.5 rounded-full bg-[rgba(37,99,235,0.15)] px-1.5 py-0.5
                                       text-[9px] font-bold text-[#2563EB]">
                        {data!.messages.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto space-y-4 p-4">

              {/* -- PERFIL -- */}
              {tab === 'profile' && (
                <>
                  <Section title="Datos de contacto">
                    <InfoRow icon={Mail}   label="Email"     value={lead.email    ? String(lead.email)    : null} href={lead.email    ? `mailto:${String(lead.email)}`   : undefined} />
                    <InfoRow icon={Phone}  label="Teléfono"  value={lead.phone    ? String(lead.phone)    : null} href={lead.phone    ? `tel:${String(lead.phone)}`      : undefined} />
                    <InfoRow icon={MapPin} label="Ubicación" value={lead.location ? String(lead.location) : null} />
                    <InfoRow icon={Link2}  label="LinkedIn"  value={lead.linkedin_url ? 'Ver perfil' : null}
                      href={lead.linkedin_url ? String(lead.linkedin_url) : undefined} external />
                  </Section>

                  <Section title="Etapa CRM">
                    <select
                      value={String(lead.crm_column ?? 'extraido')}
                      onChange={(e) => handleStageChange(e.target.value)}
                      disabled={saving}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5
                                 text-xs text-[var(--foreground)] focus:border-[#2563EB] focus:outline-none
                                 focus:ring-1 focus:ring-[rgba(37,99,235,0.3)] disabled:opacity-60"
                    >
                      {STAGES.map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </Section>

                  <Section title="Valor del lead">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--foreground-muted)]">$</span>
                      <input
                        type="number"
                        defaultValue={Number(lead.value ?? 0)}
                        onBlur={(e) => updateLeadField(leadId!, { value: Number(e.target.value) })}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5
                                   text-xs text-[var(--foreground)] focus:border-[#2563EB] focus:outline-none"
                      />
                    </div>
                  </Section>

                  <Section title="Notas">
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={4}
                      placeholder="Agrega notas sobre este lead..."
                      className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2
                                 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-faint)]
                                 focus:border-[#2563EB] focus:outline-none"
                    />
                    <button
                      onClick={handleSaveNotes}
                      disabled={saving}
                      className="mt-1.5 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-3 py-1.5 text-xs
                                 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {saving ? 'Guardando...' : 'Guardar notas'}
                    </button>
                  </Section>

                  {(data?.tasks?.length ?? 0) > 0 && (
                    <Section title="Estado de automatización">
                      <div className="space-y-1.5">
                        {data!.tasks.slice(0, 5).map((task) => (
                          <div key={task.id} className="flex items-center justify-between
                                                         rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2">
                            <div>
                              <p className="text-[11px] font-medium text-[var(--foreground)]">{task.task_type}</p>
                              {task.last_error && (
                                <p className="text-[10px] text-[#EF4444]">{task.last_error}</p>
                              )}
                            </div>
                            <span className={[
                              'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase',
                              task.status === 'done'
                                ? 'bg-[rgba(16,185,129,0.15)] text-[#10B981]'
                                : task.status === 'failed'
                                ? 'bg-[rgba(239,68,68,0.15)] text-[#EF4444]'
                                : task.status === 'pending'
                                ? 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B]'
                                : 'bg-[var(--border)] text-[var(--foreground-muted)]',
                            ].join(' ')}>
                              {task.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                </>
              )}

              {/* -- ACTIVIDAD -- */}
              {tab === 'activity' && (
                <div className="relative pl-6">
                  <div className="absolute bottom-2 left-[15px] top-2 w-px bg-[var(--border)]" />

                  {(data?.activity ?? []).length === 0 && (
                    <p className="py-8 text-center text-xs text-[var(--foreground-faint)]">Sin actividad registrada</p>
                  )}

                  {(data?.activity ?? []).map((item, i) => {
                    const cfg  = ACTION_ICON[item.action_type] ?? { icon: Zap, color: 'text-[var(--foreground-faint)]' };
                    const Icon = cfg.icon as React.ElementType;
                    return (
                      <div key={item.id} className={`relative flex gap-3 ${i > 0 ? 'mt-3' : ''}`}>
                        <div className="absolute -left-[6px] top-1 flex h-5 w-5 items-center
                                        justify-center rounded-full border-2 border-[var(--border)] bg-[var(--surface)]">
                          <Icon className={`h-2.5 w-2.5 ${cfg.color}`} />
                        </div>
                        <div className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                          <p className="text-xs text-[var(--foreground)]">{item.description}</p>
                          <p className="mt-0.5 text-[10px] text-[var(--foreground-faint)]">{timeAgo(item.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* -- MENSAJES -- */}
              {tab === 'messages' && (
                <div className="space-y-2">
                  {(data?.messages ?? []).length === 0 && (
                    <p className="py-8 text-center text-xs text-[var(--foreground-faint)]">Sin mensajes registrados</p>
                  )}
                  {(data?.messages ?? []).map((msg) => {
                    const isOutbound = msg.sender === 'user' || msg.sender === 'ai';
                    return (
                      <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                        <div className={[
                          'max-w-[80%] rounded-2xl px-3 py-2 text-xs',
                          isOutbound
                            ? 'rounded-br-sm bg-gradient-to-br from-[#2563EB] to-[#06B6D4] text-white'
                            : 'rounded-bl-sm bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)]',
                        ].join(' ')}>
                          <p className="whitespace-pre-wrap">{msg.message_text}</p>
                          <p className={`mt-0.5 text-[9px] ${isOutbound ? 'text-white/60' : 'text-[var(--foreground-faint)]'}`}>
                            {timeAgo(msg.timestamp)}
                            {msg.sender === 'ai' && ' · IA'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : !loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-[var(--foreground-faint)]">Lead no encontrado</p>
          </div>
        ) : null}
      </div>
    </>
  );
}
