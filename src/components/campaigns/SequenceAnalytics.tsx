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
    return <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />;
  }

  const maxLeads = data.steps[0]?.totalLeads ?? 1;

  return (
    <div className="space-y-4">
      {/* -- Funnel visual -- */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          Funnel de conversión por paso
        </h3>
        <div className="space-y-3">
          {data.steps.map((step) => {
            const pct = maxLeads > 0 ? (step.totalLeads / maxLeads) * 100 : 0;
            const rateColor =
              step.step === 0         ? 'text-zinc-500' :
              step.convRate >= 70     ? 'text-green-600' :
              step.convRate >= 40     ? 'text-amber-600' : 'text-red-500';
            const barColor =
              step.step === 0         ? 'bg-blue-400' :
              step.step === 1         ? 'bg-indigo-500' :
              step.step === 2         ? 'bg-violet-500' :
              step.step === 3         ? 'bg-amber-500' :
              step.step === 4         ? 'bg-green-500' : 'bg-emerald-600';

            return (
              <div key={step.step}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full
                                     bg-zinc-100 text-[10px] font-bold text-zinc-500">
                      {step.step}
                    </span>
                    <span className="text-xs font-medium text-zinc-700">{step.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] tabular-nums text-zinc-400">
                      {step.totalLeads} leads
                    </span>
                    {step.step > 0 && step.dropped > 0 && (
                      <span className="text-[10px] text-red-400">−{step.dropped}</span>
                    )}
                    {step.step > 0 && (
                      <span className={`text-[11px] font-bold tabular-nums ${rateColor}`}>
                        {step.convRate}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
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
          <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
            {data.steps.slice(1).filter((s) => s.dropped > 0).map((s) => (
              <span key={s.step}
                className="rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-medium text-red-600">
                −{s.dropped} en "{s.label}"
              </span>
            ))}
          </div>
        )}
      </div>

      {/* -- A/B Test results -- */}
      {data.abTest && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Resultados A/B Test
            </h3>
            {!data.abTest.sampleOk && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-medium text-amber-600">
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
                  isWinner ? 'border-green-400 bg-green-50' :
                  isLoser  ? 'border-zinc-200 bg-zinc-50 opacity-60' :
                  v === 'a' ? 'border-blue-200 bg-blue-50/40' : 'border-violet-200 bg-violet-50/40',
                ].join(' ')}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className={[
                      'rounded-full px-2 py-0.5 text-xs font-bold text-white',
                      v === 'a' ? 'bg-blue-600' : 'bg-violet-600',
                    ].join(' ')}>{v.toUpperCase()}</span>
                    {isWinner && (
                      <span className="rounded-full bg-green-500 px-2 py-0.5
                                       text-[9px] font-bold text-white">
                        GANADORA ✓
                      </span>
                    )}
                  </div>
                  <p className="text-3xl font-black tabular-nums text-zinc-900">{vd.rate}%</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">tasa de aceptación</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className={`h-1.5 rounded-full ${v === 'a' ? 'bg-blue-500' : 'bg-violet-500'}`}
                      style={{ width: `${vd.rate}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-zinc-400 tabular-nums">
                    {vd.accepted} aceptados / {vd.sent} enviados
                  </p>
                </div>
              );
            })}
          </div>

          {data.abTest.sampleOk && !data.abTest.winner && (
            <p className="mt-3 text-center text-[11px] text-zinc-500">
              Muestra suficiente — selecciona el ganador manualmente en el editor A/B.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
