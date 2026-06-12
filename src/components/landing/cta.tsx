import { Button } from "@/components/ui/button";

// -- Testimonials --------------------------------------------------------------

const testimonials = [
  {
    quote: "En 3 semanas conseguí 18 reuniones con CTOs de startups que antes ignoraban mis mensajes. La IA escribe mejor que yo.",
    name: "Sebastián Mora",
    role: "Account Executive",
    company: "SaaS B2B · Lima",
    initials: "SM",
    color: "bg-indigo-600",
  },
  {
    quote: "Waalaxy me costaba $112/mes y no tenía CRM. Con NexusAI veo todo en un solo panel y el autopilot atiende a mis leads mientras duermo.",
    name: "Valentina Cruz",
    role: "SDR Lead",
    company: "Agencia de Growth · Bogotá",
    initials: "VC",
    color: "bg-emerald-600",
  },
  {
    quote: "El equipo respondió mis dudas en menos de una hora. El onboarding fue en 10 minutos y la primera campaña estaba corriendo ese mismo día.",
    name: "Rodrigo Pérez",
    role: "Founder",
    company: "Consultora B2B · CDMX",
    initials: "RP",
    color: "bg-violet-600",
  },
];

function Testimonials() {
  return (
    <section className="bg-zinc-50 py-24 border-t border-zinc-100">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            Testimonios
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
            SDRs que ya lo usan
          </h2>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-zinc-600">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <div className="mt-6 flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${t.color}`}>
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{t.name}</p>
                  <p className="text-xs text-zinc-400">{t.role} · {t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// -- FAQ -----------------------------------------------------------------------

const faqs = [
  {
    q: "¿Es seguro para mi cuenta de LinkedIn?",
    a: "Sí. NexusAI imita el comportamiento humano y respeta los límites diarios recomendados por LinkedIn (conexiones, mensajes, visitas de perfil). Puedes configurar tus propios límites en la sección de Configuración. Llevamos más de 6 meses operando sin cuentas baneadas.",
  },
  {
    q: "¿Necesito instalar algo?",
    a: "Sí, una extensión de Chrome ligera (~2 MB). Es la que opera tu LinkedIn en segundo plano. El dashboard y la IA funcionan completamente en la nube — no necesitas mantener tu computadora encendida.",
  },
  {
    q: "¿Puedo cancelar en cualquier momento?",
    a: "Claro. Sin permanencia ni penalización. Cancelas desde el panel de configuración y no se te cobra el siguiente mes. Tus datos quedan exportables por 30 días.",
  },
  {
    q: "¿Funciona con Sales Navigator?",
    a: "Sí. Puedes importar directamente los leads de cualquier búsqueda de Sales Navigator como CSV, o usar la extensión para capturarlos directamente desde la interfaz de LinkedIn.",
  },
  {
    q: "¿El Autopilot IA puede mandar mensajes sin que yo los vea?",
    a: "Sólo si activas el modo 'automático'. Por defecto está en modo 'revisión': la IA redacta el mensaje y tú lo apruebas con un clic desde el Smart Inbox antes de que salga.",
  },
  {
    q: "¿Cuánto tarda en configurarse?",
    a: "Menos de 10 minutos. Instala la extensión, conecta tu LinkedIn, sube tu CSV (o usa una búsqueda guardada) y lanza tu primera campaña. No necesitas hablar con un sales rep.",
  },
];

function FAQ() {
  return (
    <section id="faq" className="bg-white py-24 border-t border-zinc-100">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">FAQ</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
            Preguntas frecuentes
          </h2>
        </div>

        <dl className="mt-12 space-y-4">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 open:bg-white open:shadow-sm transition-all"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-zinc-900">
                {faq.q}
                <span className="shrink-0 text-zinc-400 transition-transform group-open:rotate-45">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">{faq.a}</p>
            </details>
          ))}
        </dl>
      </div>
    </section>
  );
}

// -- Final CTA -----------------------------------------------------------------

export function CTA() {
  return (
    <>
      <Testimonials />
      <FAQ />

      {/* Final CTA band */}
      <section className="bg-indigo-600 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Empieza a prospectar hoy — gratis
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-200">
            7 días sin compromiso. Cancela cuando quieras. Tu primera reunión puede estar a 48 horas.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              href="/login"
              className="min-w-[220px] bg-white text-indigo-600 hover:bg-indigo-50 font-bold shadow-none"
            >
              Crear cuenta gratis →
            </Button>
            <Button
              variant="outline"
              href="#precios"
              className="min-w-[220px] border-indigo-400 text-white hover:bg-indigo-500"
            >
              Ver planes
            </Button>
          </div>
          <p className="mt-5 text-sm text-indigo-300">Sin tarjeta de crédito · Configuración en 10 minutos</p>
        </div>
      </section>
    </>
  );
}
