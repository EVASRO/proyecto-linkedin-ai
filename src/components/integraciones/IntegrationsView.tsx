"use client";

import { useState, useCallback, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { LinkedInConnectionCard } from "./LinkedInConnectionCard";
import { EngineStatusCard } from "./EngineStatusCard";
import { getIntegrationsData, disconnectLinkedIn } from "@/app/dashboard/configuracion/actions";
import type { IntegrationsData, LinkedInAccount } from "@/app/dashboard/configuracion/actions";

type Props = {
  data: IntegrationsData;
};

export function IntegrationsView({ data }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Local state — initialized from server, updated by refreshData()
  const [linkedInAccount, setLinkedInAccount] = useState<LinkedInAccount | null>(
    data.linkedInAccount
  );
  const [engine, setEngine] = useState(data.engine);

  // Track previous data to sync when RSC passes new props after router.refresh()
  const prevData = useRef(data);
  if (prevData.current !== data) {
    prevData.current = data;
    setLinkedInAccount(data.linkedInAccount);
    setEngine(data.engine);
  }

  const refreshData = useCallback(async () => {
    // Call server action directly so local state updates immediately
    // (router.refresh() alone doesn't update useState after mount)
    try {
      const result = await getIntegrationsData();
      if (result.success && result.data) {
        setLinkedInAccount(result.data.linkedInAccount);
        setEngine(result.data.engine);
      }
    } catch (_) {}
    // Also trigger RSC refresh for other components on the page
    startTransition(() => router.refresh());
  }, [router]);

  const handleDisconnect = useCallback(async () => {
    // Update DB first, then refresh local state
    await disconnectLinkedIn();
    setLinkedInAccount(null);
    await refreshData();
  }, [refreshData]);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Integraciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Conecta tu cuenta de LinkedIn y gestiona el motor de automatización
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6 max-w-3xl">
        {/* LinkedIn section */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">LinkedIn</h2>
            <p className="text-xs text-muted-foreground">
              Vincula tu perfil de LinkedIn para habilitar el motor de prospección
            </p>
          </div>
          <LinkedInConnectionCard
            account={linkedInAccount}
            onRefresh={refreshData}
            onDisconnect={handleDisconnect}
          />
        </section>

        {/* Engine section */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Motor Ghost Engine</h2>
            <p className="text-xs text-muted-foreground">
              Estado del motor de automatización en segundo plano
            </p>
          </div>
          <EngineStatusCard engine={engine} onRefresh={refreshData} />
        </section>
      </div>
    </div>
  );
}
