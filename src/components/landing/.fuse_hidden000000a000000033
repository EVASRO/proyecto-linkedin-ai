import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section
      id="producto"
      className="relative overflow-hidden border-b border-border bg-white"
    >
      {/* Subtle gradient backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(79,70,229,0.08),transparent)]" />

      <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Beta · Cupos limitados — únete ahora
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl lg:text-6xl">
            Automatiza tu prospección{" "}
            <span className="text-indigo-600">en LinkedIn</span>
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-zinc-500 md:text-xl">
            Conecta con <strong className="text-zinc-700">500+ prospectos calificados</strong> al mes
            con mensajes personalizados y una IA que negocia por ti — sin arriesgar tu cuenta.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button href="/login" className="min-w-[200px] bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-200">
              Empezar gratis →
            </Button>
            <Button variant="outline" href="/dashboard" className="min-w-[200px]">
              Ver demo
            </Button>
          </div>

          <p className="mt-5 text-sm text-zinc-400">
            Sin tarjeta de crédito · 7 días gratis · Cancela cuando quieras
          </p>

          <p className="mt-3 text-xs font-medium text-zinc-400">
            Usado por <span className="text-zinc-600 font-semibold">+50 SDRs en LATAM</span>
          </p>
        </div>

        {/* Dashboard mockup */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2 shadow-2xl shadow-zinc-200/60 ring-1 ring-zinc-100">
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-4 rounded-md bg-zinc-200 px-3 py-0.5 text-xs text-zinc-500">
                  app.nexusai.io/dashboard
                </span>
              </div>

              {/* Dashboard preview */}
              <div className="p-6">
                <div className="grid gap-4 sm:grid-cols-4">
                  {[
                    { label: "Conexiones enviadas", value: "487", change: "+12% esta semana" },
                    { label: "Respuestas recibidas", value: "93", change: "19% tasa de respuesta" },
                    { label: "Reuniones agendadas", value: "14", change: "+3 esta semana" },
                    { label: "Mensajes IA enviados", value: "41", change: "Autopilot activo" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                      <p className="text-xs font-medium text-zinc-400">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold text-zinc-900">{stat.value}</p>
                      <p className="mt-1 text-[11px] text-indigo-600">{stat.change}</p>
                    </div>
                  ))}
                </div>

                {/* Mini kanban hint */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { col: "Contactados", color: "bg-zinc-100", count: 142 },
                    { col: "Respondieron", color: "bg-blue-50", count: 37 },
                    { col: "Interesados", color: "bg-indigo-50", count: 14 },
                  ].map((col) => (
                    <div key={col.col} className={`rounded-lg border border-zinc-200 ${col.color} px-3 py-2`}>
                      <p className="text-xs font-semibold text-zinc-600">{col.col}</p>
                      <p className="mt-0.5 text-sm font-bold text-zinc-900">{col.count} leads</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
