import { Button } from "@/components/ui/button";

// -- Comparison table ----------------------------------------------------------

const comparisonRows = [
  { feature: "Automatización LinkedIn",  nexus: "✅", waalaxy: "✅",   dripify: "✅"    },
  { feature: "CRM integrado",            nexus: "✅", waalaxy: "❌",   dripify: "Básico" },
  { feature: "Autopilot IA",             nexus: "✅", waalaxy: "❌",   dripify: "❌"    },
  { feature: "Secuencias de email",      nexus: "✅", waalaxy: "Pro",  dripify: "Pro"   },
  { feature: "A/B Testing",              nexus: "✅", waalaxy: "❌",   dripify: "✅"    },
  { feature: "Import CSV",               nexus: "✅", waalaxy: "✅",   dripify: "✅"    },
  { feature: "Smart Inbox",              nexus: "✅", waalaxy: "❌",   dripify: "❌"    },
  { feature: "Precio mensual",           nexus: "$49", waalaxy: "$112", dripify: "$59"  },
];

function CompareCheck({ value }: { value: string }) {
  const isYes = value === "✅";
  const isNo  = value === "❌";
  return (
    <span className={`text-sm font-medium ${isYes ? "text-emerald-600" : isNo ? "text-zinc-300" : "text-zinc-500"}`}>
      {value}
    </span>
  );
}

function ComparisonTable() {
  return (
    <section id="comparativa" className="bg-zinc-50 py-24 border-t border-zinc-100">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            Comparativa
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
            ¿Por qué NexusAI?
          </h2>
          <p className="mt-4 text-lg text-zinc-500">
            Más features. Menos precio. IA nativa — no un chatbot pegado con cinta adhesiva.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="pb-4 pr-6 text-sm font-semibold text-zinc-500">Feature</th>
                <th className="pb-4 px-6 text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
                    NexusAI
                  </span>
                </th>
                <th className="pb-4 px-6 text-center text-sm font-semibold text-zinc-400">Waalaxy</th>
                <th className="pb-4 pl-6 text-center text-sm font-semibold text-zinc-400">Dripify</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-b border-zinc-100 ${i % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}`}
                >
                  <td className="py-3.5 pr-6 text-sm text-zinc-700">{row.feature}</td>
                  <td className="py-3.5 px-6 text-center">
                    <CompareCheck value={row.nexus} />
                  </td>
                  <td className="py-3.5 px-6 text-center">
                    <CompareCheck value={row.waalaxy} />
                  </td>
                  <td className="py-3.5 pl-6 text-center">
                    <CompareCheck value={row.dripify} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// -- Pricing plans -------------------------------------------------------------

const plans = [
  {
    name: "Starter",
    price: "29",
    description: "Para empezar a prospectar en serio.",
    features: [
      "1 cuenta LinkedIn",
      "500 conexiones/mes",
      "CRM + Kanban",
      "Importar CSV",
      "Soporte por email",
    ],
    highlighted: false,
    cta: "Empezar 7 días gratis",
  },
  {
    name: "Pro",
    price: "49",
    description: "El arsenal completo del SDR moderno.",
    features: [
      "1 cuenta LinkedIn",
      "1 000 conexiones/mes",
      "Todo lo de Starter +",
      "Secuencias de email",
      "A/B Testing",
      "Autopilot IA",
      "Analytics avanzado",
    ],
    highlighted: true,
    badge: "Más popular",
    cta: "Empezar 7 días gratis",
  },
  {
    name: "Team",
    price: "99",
    description: "Para equipos de ventas de alto rendimiento.",
    features: [
      "3 cuentas LinkedIn",
      "Conexiones ilimitadas",
      "Todo lo de Pro +",
      "Multi-SDR dashboard",
      "Reportes de equipo",
      "Soporte prioritario",
    ],
    highlighted: false,
    cta: "Empezar 7 días gratis",
  },
];

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function Pricing() {
  return (
    <>
      <ComparisonTable />

      <section id="precios" className="bg-white py-24 border-t border-zinc-100">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Pricing
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
              Planes para cada etapa
            </h2>
            <p className="mt-4 text-lg text-zinc-500">
              7 días gratis en todos los planes. Sin tarjeta de crédito.
            </p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-8 transition-shadow ${
                  plan.highlighted
                    ? "border-indigo-500 bg-indigo-600 shadow-2xl shadow-indigo-200"
                    : "border-zinc-200 bg-white shadow-sm hover:shadow-md"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-zinc-900">
                    {plan.badge}
                  </span>
                )}

                <div>
                  <h3 className={`text-xl font-bold ${plan.highlighted ? "text-white" : "text-zinc-900"}`}>
                    {plan.name}
                  </h3>
                  <p className={`mt-1 text-sm ${plan.highlighted ? "text-indigo-200" : "text-zinc-500"}`}>
                    {plan.description}
                  </p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className={`text-4xl font-bold ${plan.highlighted ? "text-white" : "text-zinc-900"}`}>
                      ${plan.price}
                    </span>
                    <span className={`${plan.highlighted ? "text-indigo-200" : "text-zinc-400"}`}>/mes</span>
                  </div>
                </div>

                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <svg
                        className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlighted ? "text-indigo-200" : "text-emerald-500"}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={`text-sm ${plan.highlighted ? "text-indigo-100" : "text-zinc-600"}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  href="/login"
                  className={`mt-8 w-full ${
                    plan.highlighted
                      ? "bg-white text-indigo-600 hover:bg-indigo-50 shadow-none font-bold"
                      : "bg-indigo-600 text-white hover:bg-indigo-500"
                  }`}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-zinc-400">
            ¿Equipo grande? <a href="mailto:hola@nexusai.io" className="font-medium text-indigo-600 hover:underline">Contáctanos</a> para un plan a medida.
          </p>
        </div>
      </section>
    </>
  );
}
