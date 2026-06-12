import { Suspense } from "react";
import { getDashboardMetrics } from "./actions";
import { DashboardView } from "@/components/dashboard/DashboardView";

// Revalidate this page every 60 seconds (ISR / server-side cache)
export const revalidate = 60;

// -- Inner async component — lets Suspense stream it ---------------------------

async function DashboardContent() {
  const result = await getDashboardMetrics();
  return <DashboardView metrics={result.data ?? null} />;
}

// -- Skeleton fallback for the entire view -------------------------------------

function DashboardSkeleton() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Header skeleton */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-white px-6 py-4">
        <div className="space-y-1.5">
          <div className="h-5 w-40 animate-pulse rounded bg-zinc-200" />
          <div className="h-3 w-48 animate-pulse rounded bg-zinc-100" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-xl bg-zinc-200" />
      </div>

      {/* Body skeleton */}
      <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6 space-y-6">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-28 animate-pulse rounded bg-zinc-200" />
                  <div className="h-8 w-20 animate-pulse rounded bg-zinc-200" />
                  <div className="h-2.5 w-24 animate-pulse rounded bg-zinc-100" />
                </div>
                <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-xl bg-zinc-200" />
              </div>
            </div>
          ))}
        </div>

        {/* Engine */}
        <div className="h-28 animate-pulse rounded-2xl bg-zinc-200" />

        {/* Chart */}
        <div className="h-56 animate-pulse rounded-2xl bg-zinc-200" />

        {/* Two-col */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="h-80 animate-pulse rounded-2xl bg-zinc-200" />
          <div className="space-y-6">
            <div className="h-52 animate-pulse rounded-2xl bg-zinc-200" />
            <div className="h-44 animate-pulse rounded-2xl bg-zinc-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Page ----------------------------------------------------------------------

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
