"use client";

import Link from "next/link";
import { motion } from "framer-motion";

// -- Comparison table ----------------------------------------------------------

const comparisonRows = [
  { feature: "Automatización LinkedIn",  cazary: "✅", waalaxy: "✅",    dripify: "✅"    },
  { feature: "CRM integrado",            cazary: "✅", waalaxy: "❌",    dripify: "Básico" },
  { feature: "Autopilot IA",             cazary: "✅", waalaxy: "❌",    dripify: "❌"    },
  { feature: "Secuencias de email",      cazary: "✅", waalaxy: "Pro",   dripify: "Pro"   },
  { feature: "A/B Testing",              cazary: "✅", waalaxy: "❌",    dripify: "✅"    },
  { feature: "Import CSV",               cazary: "✅", waalaxy: "✅",    dripify: "✅"    },
  { feature: "Smart Inbox",              cazary: "✅", waalaxy: "❌",    dripify: "❌"    },
  { feature: "Precio mensual",           cazary: "$49", waalaxy: "$112", dripify: "$59"  },
];

function CompareCheck({ value, highlight }: { value: string; highlight?: boolean }) {
  const isYes = value === "✅";
  const isNo  = value === "❌";
  const isPrice = value.startsWith("$");
  return (
    <span className={`text-sm font-medium ${
      highlight && isPrice
        ? "bg-gradient-to-r from-[#2563EB] to-[#06B6D4] bg-clip-text text-transparent font-bold text-lg"
        : isYes
          ? "text-[#10B981]"
          : isNo
            ? "text-[var(--foreground-faint)]"
            : "text-[var(--foreground-muted)]"
    }`}>
      {value}
    </span>
  );
}

function ComparisonTable() {
  return (
    <motion.section
      id="comparativa"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="border-t border-[var(--border)] bg-[var(--surface)] py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="bg-gradient-to-r from-[#2563EB] to-[#06B6D4] bg-clip-text text-xs font-semibold uppercase tracking-widest text-transparent">
            Comparativa
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--foreground)] md:text-4xl">
            ¿Por qué cazary.ai?
          </h2>
          <p className="mt-4 text-lg text-[var(--foreground-muted)]">
            Más features. Menos precio. IA nativa — no un chatbot pegado con cinta adhesiva.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-6 py-4 text-sm font-semibold text-[var(--foreground-muted)]">Feature</th>
                <th className="px-6 py-4 text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-3 py-1 text-xs font-bold text-white">
                    cazary.ai
                  </span>
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-[var(--foreground-muted)]">Waalaxy</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-[var(--foreground-muted)]">Dripify</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-b border-[var(--border)] last:border-0 ${
                    i % 2 === 0 ? "bg-[var(--background)]" : "bg-[var(--surface)]"
                  }`}
                >
                  <td className="px-6 py-3.5 text-sm text-[var(--foreground-muted)]">{row.feature}</td>
                  <td className="bg-[rgba(37,99,235,0.04)] px-6 py-3.5 text-center">
                    <CompareCheck value={row.cazary} highlight />
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    <CompareCheck value={row.waalaxy} />
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    <CompareCheck value={row.dripify} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.section>
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

export function Pricing() {
  return (
    <>
      <ComparisonTable />

      <section id="precios" className="border-t border-[var(--border)] bg-[var(--background)] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="bg-gradient-to-r from-[#2563EB] to-[#06B6D4] bg-clip-text text-xs font-semibold uppercase tracking-widest text-transparent">
              Pricing
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--foreground)] md:text-4xl">
              Planes para cada etapa
            </h2>
            <p className="mt-4 text-lg text-[var(--foreground-muted)]">
              7 días gratis en todos los planes. Sin tarjeta de crédito.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-16 grid gap-8 lg:grid-cols-3"
          >
            {plans.map((plan) => (
              <motion.div
                key={plan.name}
                whileHover={{ scale: 1.01, transition: { type: "spring", stiffness: 300 } }}
                className={`relative flex flex-col rounded-2xl p-8 transition-all duration-300 ${
                  plan.highlighted
                    ? "border border-transparent bg-[var(--surface)] shadow-[var(--shadow-glow-primary)]"
                    : "border border-[var(--border)] bg-[var(--surface)] hover:border-[rgba(37,99,235,0.3)]"
                }`}
                style={plan.highlighted ? {
                  background: "linear-gradient(var(--surface), var(--surface)) padding-box, linear-gradient(135deg, #2563EB, #06B6D4) border-box",
                  border: "1px solid transparent",
                } : undefined}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-3 py-1 text-xs font-bold text-white shadow-[var(--shadow-glow-primary)]">
                    {plan.badge}
                  </span>
                )}

                <div>
                  <h3 className="text-xl font-bold text-[var(--foreground)]">{plan.name}</h3>
                  <p className="mt-1 text-sm text-[var(--foreground-muted)]">{plan.description}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className={`text-4xl font-bold ${plan.highlighted ? "bg-gradient-to-r from-[#2563EB] to-[#06B6D4] bg-clip-text text-transparent" : "text-[var(--foreground)]"}`}>
                      ${plan.price}
                    </span>
                    <span className="text-[var(--foreground-muted)]">/mes</span>
                  </div>
                </div>

                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-[var(--foreground-muted)]">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/login"
                  className={`mt-8 block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition-all duration-200 ${
                    plan.highlighted
                      ? "bg-gradient-to-r from-[#2563EB] to-[#06B6D4] text-white shadow-[var(--shadow-glow-primary)] hover:opacity-90"
                      : "border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--primary)]/50 hover:text-[var(--foreground)]"
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <p className="mt-8 text-center text-sm text-[var(--foreground-faint)]">
            ¿Equipo grande?{" "}
            <a href="mailto:hola@cazary.ai" className="bg-gradient-to-r from-[#2563EB] to-[#06B6D4] bg-clip-text font-medium text-transparent hover:opacity-80">
              Contáctanos
            </a>{" "}
            para un plan a medida.
          </p>
        </div>
      </section>
    </>
  );
}
