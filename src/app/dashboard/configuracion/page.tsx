import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getIntegrationsData } from "./actions";
import { IntegrationsView } from "@/components/integraciones/IntegrationsView";

export const metadata = { title: "Integraciones" };

async function IntegrationsContent() {
  const result = await getIntegrationsData();

  if (!result.success || !result.data) {
    redirect("/login");
  }

  return <IntegrationsView data={result.data} />;
}

function IntegrationsSkeleton() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <div className="space-y-1.5">
          <div className="h-5 w-32 animate-pulse rounded bg-[var(--border)]" />
          <div className="h-3 w-56 animate-pulse rounded bg-[var(--border)] opacity-70" />
        </div>
      </div>
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="h-32 animate-pulse rounded-2xl bg-[var(--border)]" />
        <div className="h-44 animate-pulse rounded-2xl bg-[var(--border)]" />
      </div>
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <Suspense fallback={<IntegrationsSkeleton />}>
      <IntegrationsContent />
    </Suspense>
  );
}
