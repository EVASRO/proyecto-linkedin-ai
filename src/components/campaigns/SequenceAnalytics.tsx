'use client';

import { useState, useEffect } from 'react';
import { getSequenceAnalytics } from '@/app/dashboard/campanas/actions';

type AnalyticsData = NonNullable<Awaited<ReturnType<typeof getSequenceAnalytics>>['data']>;

export function SequenceAnalytics({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    getSequenceAnalytics(campaignId).then((r) => {
      if (r.success && r.data) setData(r.data);
    });
  }, [campaignId]);

  if (!data) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface)]" />;
  }

  const maxLeads = data.steps[0]?.totalLeads ?? 1;

  return (
    <div className="space-y-4">
      {/* -- Funnel visual -- */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[var(--foreground-faint)]">
          Funnel de conversión por paso
        </h3>
        <div className="space-y-3">
          {data.steps.map((step) => {
            const pct = maxLeads > 0 ? (step.totalLeads / maxLeads) * 100 : 0;
            const rateColor =
              step.step === 0         ? 'text-[var(--foreground-muted)]' :
              step.convRate >= 70     ? 'text-[#10B981]' :
              step.convRate >= 40     ? 'text-[#F59E0B]' : 'text-[#EF4444]';
            const barColor =
              step.step === 0         ? 'bg-[#2563EB]' :
              step.step === 1         ? 'bg-[#3B82F6]' :
              step.step === 2         ? 'bg-[#06B6D4]' :
              step.step === 3         ? 'bg-[#F59E0B]' :
              step.step === 4         ? 'bg-[#10B981]' : 'bg-[#10B981]';

            return (
              <div key={step.step}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full
                                     bg-[rgba(255,255,255,0.06)] text-[10px] font-bold text-[var(--foreground-muted)]">
                      {step.step}
                    </span>
                    <span className="text-xs font-medium text-[var(--foreground)]">{step.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] tabular-nums text-[var(--foreground-faint)]">
                      {step.totalLeads} leads
                    </span>
                    {step.step > 0 && step.dropped > 0 && (
                      <span className="text-[10px] text-[#EF4444]">−{step.dropped}</span>
                    )}
                    {step.step > 0 && (
                      <span className={`text-[11px] font-bold tabular-nums ${rateColor}`}>
                        {step.convRate}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Drop-off summary */}
        {data.steps.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
            {data.steps.slice(1).filter((s) => s.dropped > 0).map((s) => (
              <span key={s.step}
                className="rounded-full bg-[rgba(239,68,68,0.12)] px-2.5 py-0.5 text-[10px] font-medium text-[#EF4444]">
                −{s.dropped} en "{s.label}"
              </span>
            ))}
          </div>
        )}
      </div>

      {/* -- A/B Test results -- */}
      {data.abTest && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--foreground-faint)]">
              Resultados A/B Test
            </h3>
            {!data.abTest.sampleOk && (
              <span className="rounded-full bg-[rgba(245,158,11,0.12)] px-2.5 py-0.5 text-[10px] font-medium text-[#F59E0B]">
                ⏳ Recolectando datos mínimos
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(['a', 'b'] as const).map((v) => {
              const vd = v === 'a' ? data.abTest!.variantA : data.abTest!.variantB;
              const isWinner = data.abTest!.winner === v;
              const isLoser  = data.abTest!.winner !== null && data.abTest!.winner !== v;
              return (
                <div key={v} className={[
                  'rounded-xl border-2 p-4 transition-all',
                  isWinner ? 'border-[#10B981] bg-[rgba(16,185,129,0.08)]' :
                  isLoser  ? 'border-[var(--border)] bg-[var(--background)] opacity-60' :
                  v === 'a' ? 'border-[rgba(37,99,235,0.4)] bg-[rgba(37,99,235,0.06)]' : 'border-[rgba(124,58,237,0.4)] bg-[rgba(124,58,237,0.06)]',
                ].join(' ')}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className={[
                      'rounded-full px-2 py-0.5 text-xs font-bold text-white',
                      v === 'a' ? 'bg-[#2563EB]' : 'bg-[#7C3AED]',
                    ].join(' ')}>{v.toUpperCase()}</span>
                    {isWinner && (
                      <span className="rounded-full bg-[#10B981] px-2 py-0.5
                                       text-[9px] font-bold text-white">
                        GANADORA ✓
                      </span>
                    )}
                  </div>
                  <p className="text-3xl font-black tabular-nums text-[var(--foreground)]">{vd.rate}%</p>
                  <p className="mt-0.5 text-[10px] text-[var(--foreground-faint)]">tasa de aceptación</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                    <div
                      className={`h-1.5 rounded-full ${v === 'a' ? 'bg-[#2563EB]' : 'bg-[#7C3AED]'}`}
                      style={{ width: `${vd.rate}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-[var(--foreground-faint)] tabular-nums">
                    {vd.accepted} aceptados / {vd.sent} enviados
                  </p>
                </div>
              );
            })}
          </div>

          {data.abTest.sampleOk && !data.abTest.winner && (
            <p className="mt-3 text-center text-[11px] text-[var(--foreground-muted)]">
              Muestra suficiente — selecciona el ganador manualmente en el editor A/B.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
