import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    price: "0",
    description: "Para individuos que empiezan.",
    features: ["1 usuario", "10 publicaciones/mes", "Soporte por email"],
    highlighted: false,
  },
  {
    name: "Pro",
    price: "49",
    description: "Para equipos en crecimiento.",
    features: [
      "Hasta 10 usuarios",
      "Publicaciones ilimitadas",
      "IA avanzada",
      "Analítica completa",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Para organizaciones grandes.",
    features: ["Usuarios ilimitados", "SSO", "SLA dedicado", "Onboarding"],
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="precios" className="border-t border-border bg-surface py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Planes transparentes
          </h2>
          <p className="mt-4 text-lg text-muted">
            Escala cuando lo necesites. Sin sorpresas en la facturación.
          </p>
        </div>
        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-xl border p-8 ${
                plan.highlighted
                  ? "border-primary bg-slate-50 shadow-lg ring-1 ring-primary/20"
                  : "border-border bg-surface"
              }`}
            >
              {plan.highlighted && (
                <span className="mb-4 w-fit rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
                  Más popular
                </span>
              )}
              <h3 className="text-xl font-semibold text-foreground">
                {plan.name}
              </h3>
              <p className="mt-2 text-sm text-muted">{plan.description}</p>
              <div className="mt-6 flex items-baseline gap-1">
                {plan.price !== "Custom" ? (
                  <>
                    <span className="text-4xl font-bold text-foreground">
                      €{plan.price}
                    </span>
                    <span className="text-muted">/mes</span>
                  </>
                ) : (
                  <span className="text-4xl font-bold text-foreground">
                    A medida
                  </span>
                )}
              </div>
              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm text-muted"
                  >
                    <svg
                      className="h-4 w-4 shrink-0 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.highlighted ? "primary" : "outline"}
                href="/login"
                className="mt-8 w-full"
              >
                {plan.price === "Custom" ? "Contactar ventas" : "Elegir plan"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
