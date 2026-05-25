import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="bg-sidebar py-20">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          ¿Listo para transformar tu flujo de trabajo?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
          Únete a equipos que ya automatizan su presencia profesional con
          NexusAI.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            href="/login"
            className="min-w-[200px] bg-white text-sidebar hover:bg-slate-100"
          >
            Crear cuenta gratuita
          </Button>
          <Button
            variant="outline"
            href="#precios"
            className="min-w-[200px] border-slate-600 text-white hover:bg-slate-800"
          >
            Comparar planes
          </Button>
        </div>
      </div>
    </section>
  );
}
