"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LinkedInConnectionCard } from "./LinkedInConnectionCard";
import { EngineStatusCard } from "./EngineStatusCard";
import type { IntegrationsData, LinkedInAccount } from "@/app/dashboard/configuracion/actions";

type Props = {
  data: IntegrationsData;
};

export function IntegrationsView({ data }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Local state so UI updates without full page reload
  const [linkedInAccount, setLinkedInAccount] = useState<LinkedInAccount | null>(
    data.linkedInAccount
  );
  const [engine, setEngine] = useState(data.engine);

  const refreshData = useCallback(async () => {
    // Trigger server re-fetch via router refresh, which re-renders the RSC
    // and passes new props. The local state will sync once wizard closes.
    startTransition(() => router.refresh());
  }, [router]);

  const handleDisconnect = useCallback(async () => {
    // Optimistically clear, then re-fetch
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
