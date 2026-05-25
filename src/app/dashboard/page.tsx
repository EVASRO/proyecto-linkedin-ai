import { DashboardHeader } from "@/components/layout/dashboard-header";

export default function DashboardPage() {
  return (
    <>
      <DashboardHeader
        title="Resumen"
        description="Vista general de tu actividad y métricas principales."
      />
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-xl font-semibold text-foreground">
            Tu dashboard está listo
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Este es el espacio principal tras iniciar sesión. Aquí podrás
            añadir widgets, gráficos y acciones rápidas cuando conectes tu
            lógica de negocio.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["Contenido", "Analítica", "Equipo"].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-sm font-medium text-muted"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
