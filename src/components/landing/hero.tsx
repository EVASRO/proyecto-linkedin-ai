import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section
      id="producto"
      className="relative overflow-hidden border-b border-border bg-surface"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(37,99,235,0.12),transparent)]" />
      <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            Plataforma SaaS · IA para equipos
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Escala tu presencia profesional{" "}
            <span className="text-primary">sin fricción</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted md:text-xl">
            NexusAI centraliza contenido, analítica y automatización en un solo
            panel corporativo. Diseñado para equipos de marketing y ventas B2B.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button href="/login" className="min-w-[180px]">
              Comenzar prueba gratuita
            </Button>
            <Button variant="outline" href="#caracteristicas" className="min-w-[180px]">
              Ver demostración
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted">
            Sin tarjeta de crédito · Configuración en 5 minutos
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-4xl rounded-xl border border-border bg-slate-50 p-2 shadow-xl shadow-slate-200/50">
          <div className="rounded-lg border border-border bg-surface p-6">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-4 text-xs text-muted">dashboard.nexusai.app</span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Publicaciones", value: "128" },
                { label: "Alcance", value: "42.5K" },
                { label: "Engagement", value: "8.2%" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border bg-slate-50 p-4"
                >
                  <p className="text-xs font-medium text-muted">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
