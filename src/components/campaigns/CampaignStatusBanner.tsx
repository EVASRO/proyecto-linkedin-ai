"use client";

import type { Campaign } from "./types";

interface CampaignStatusBannerProps {
  campaign: Campaign;
  leadsQueued: number;
  leadsTotal: number;
}

const PCT_CAP = 100;

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export function CampaignStatusBanner({ campaign, leadsQueued, leadsTotal }: CampaignStatusBannerProps) {
  if (campaign.status === "active") {
    const pct = leadsTotal > 0
      ? clamp(Math.round((leadsQueued / leadsTotal) * PCT_CAP), 0, PCT_CAP)
      : 0;

    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-green-800">Campaña activa</span>
          </div>
          <span className="text-xs font-semibold tabular-nums text-green-700">
            {leadsQueued.toLocaleString("es-PE")} / {leadsTotal.toLocaleString("es-PE")} leads procesados
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-green-200">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-green-600">{pct}% completado</p>
      </div>
    );
  }

  if (campaign.status === "paused") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="text-xs font-semibold text-amber-700">En pausa</span>
        <span className="ml-auto text-[10px] text-amber-600">La campaña está pausada. Reactívala para continuar.</span>
      </div>
    );
  }

  if (campaign.status === "completed") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-blue-400" />
        <span className="text-xs font-semibold text-blue-700">Completada</span>
        <span className="ml-auto text-[10px] text-blue-500">
          {leadsTotal > 0 ? `${leadsTotal.toLocaleString("es-PE")} leads procesados en total` : "Campaña finalizada"}
        </span>
      </div>
    );
  }

  // draft (default)
  return (
    <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5">
      <span className="h-2 w-2 rounded-full bg-zinc-400" />
      <span className="text-xs font-semibold text-zinc-600">Borrador</span>
      <span className="ml-auto text-[10px] text-zinc-400">Lanza la campaña para empezar a procesar leads.</span>
    </div>
  );
}
