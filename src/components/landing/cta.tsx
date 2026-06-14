"use client";

import Link from "next/link";
import { motion } from "framer-motion";

// -- Testimonials --------------------------------------------------------------

const testimonials = [
  {
    quote: "En 3 semanas conseguí 18 reuniones con CTOs de startups que antes ignoraban mis mensajes. La IA escribe mejor que yo.",
    name: "Sebastián Mora",
    role: "Account Executive",
    company: "SaaS B2B · Lima",
    initials: "SM",
  },
  {
    quote: "Waalaxy me costaba $112/mes y no tenía CRM. Con cazary.ai veo todo en un solo panel y el autopilot atiende a mis leads mientras duermo.",
    name: "Valentina Cruz",
    role: "SDR Lead",
    company: "Agencia de Growth · Bogotá",
    initials: "VC",
  },
  {
    quote: "El equipo respondió mis dudas en menos de una hora. El onboarding fue en 10 minutos y la primera campaña estaba corriendo ese mismo día.",
    name: "Rodrigo Pérez",
    role: "Founder",
    company: "Consultora B2B · CDMX",
    initials: "RP",
  },
];

const avatarColors = ["from-[#2563EB] to-[#1D4ED8]", "from-[#06B6D4] to-[#0891B2]", "from-[#2563EB] to-[#06B6D4]"];

function Testimonials() {
  return (
    <section className="border-t border-[var(--border)] bg-[var(--surface)] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="bg-gradient-to-r from-[#2563EB] to-[#06B6D4] bg-clip-text text-xs font-semibold uppercase tracking-widest text-transparent">
            Testimonios
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--foreground)] md:text-4xl">
            SDRs que ya lo usan
          </h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-12 grid gap-6 sm:grid-cols-3"
        >
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 transition-all duration-300 hover:border-[rgba(37,99,235,0.3)] hover:shadow-[0_0_16px_rgba(37,99,235,0.08)]"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, si) => (
                  <svg key={si} className="h-4 w-4 text-[#F59E0B]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-[var(--foreground-muted)]">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <div className="mt-6 flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColors[i]} text-xs font-bold text-white`}>
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{t.name}</p>
                  <p className="text-xs text-[var(--foreground-faint)]">{t.role} · {t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// -- FAQ -----------------------------------------------------------------------

const faqs = [
  {
    q: "¿Es seguro para mi cuenta de LinkedIn?",
    a: "Sí. cazary.ai imita el comportamiento humano y respeta los límites diarios recomendados por LinkedIn (conexiones, mensajes, visitas de perfil). Puedes configurar tus propios límites en la sección de Configuración. Llevamos más de 6 meses operando sin cuentas baneadas.",
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
    <section id="faq" className="border-t border-[var(--border)] bg-[var(--background)] py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <span className="bg-gradient-to-r from-[#2563EB] to-[#06B6D4] bg-clip-text text-xs font-semibold uppercase tracking-widest text-transparent">
            FAQ
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--foreground)] md:text-4xl">
            Preguntas frecuentes
          </h2>
        </div>

        <dl className="mt-12 space-y-3">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 open:border-[rgba(37,99,235,0.3)] open:bg-[var(--surface-hover)] transition-all duration-200"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[var(--foreground)]">
                {faq.q}
                <span className="shrink-0 text-[var(--foreground-muted)] transition-transform duration-200 group-open:rotate-45">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">{faq.a}</p>
            </details>
          ))}
        </dl>
      </div>
    </section>
  );
}

// -- Final CTA -----------------------------------------------------------------

const socialAvatars = [
  { initials: "MS", gradient: "from-[#2563EB] to-[#1D4ED8]" },
  { initials: "AL", gradient: "from-[#06B6D4] to-[#0891B2]" },
  { initials: "JR", gradient: "from-[#2563EB] to-[#06B6D4]" },
  { initials: "CP", gradient: "from-[#1D4ED8] to-[#06B6D4]" },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export function CTA() {
  return (
    <>
      <Testimonials />
      <FAQ />

      {/* Final CTA band */}
      <section className="relative overflow-hidden border-t border-[var(--border)] bg-[var(--background)] py-24">
        {/* Decorative top line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2563EB] to-transparent" />

        {/* Background blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-1/4 top-0 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2563EB] opacity-[0.10] blur-3xl"
          />
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-0 right-1/4 h-[300px] w-[300px] translate-x-1/2 translate-y-1/2 rounded-full bg-[#06B6D4] opacity-[0.08] blur-3xl"
          />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          {/* Icon */}
          <motion.div
            {...fadeUp}
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#06B6D4] shadow-[var(--shadow-glow-primary)]">
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-8 text-3xl font-bold tracking-tight text-[var(--foreground)] md:text-5xl"
          >
            Empieza hoy. Tus primeras{" "}
            <span className="bg-gradient-to-r from-[#2563EB] to-[#06B6D4] bg-clip-text text-transparent">
              50 conexiones son gratis.
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-4 max-w-xl text-lg text-[var(--foreground-muted)]"
          >
            Sin tarjeta de crédito. Sin contratos. Sin riesgo.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-8 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow-glow-primary)] transition-all duration-200 hover:scale-[1.02] hover:opacity-90"
            >
              Crear cuenta gratis
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="#precios"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-8 py-3.5 text-sm font-semibold text-[var(--foreground-muted)] transition-all duration-200 hover:border-[var(--primary)]/50 hover:text-[var(--foreground)]"
            >
              Ver planes
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          >
            <div className="flex items-center">
              {socialAvatars.map((a, i) => (
                <div
                  key={a.initials}
                  className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${a.gradient} border-2 border-[var(--background)] text-[10px] font-bold text-white ${i > 0 ? "-ml-2" : ""}`}
                >
                  {a.initials}
                </div>
              ))}
            </div>
            <p className="text-sm text-[var(--foreground-muted)]">
              Más de <span className="font-semibold text-[var(--foreground)]">50 SDRs en LATAM</span> ya automatizan con cazary.ai
            </p>
          </motion.div>
        </div>
      </section>
    </>
  );
}
