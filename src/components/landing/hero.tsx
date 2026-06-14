"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const stats = [
  { value: "500+", label: "Prospectos al mes" },
  { value: "19%", label: "Tasa de respuesta" },
  { value: "14x", label: "Más eficiente que manual" },
];

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[var(--background)] pt-16">

      {/* Background glows + grid */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-[#2563EB] opacity-[0.08] blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full bg-[#06B6D4] opacity-[0.06] blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">

        {/* Badge */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex justify-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2563EB]/30 bg-[#2563EB]/10 px-4 py-1.5 text-xs font-semibold text-[#93C5FD] backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#06B6D4] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#06B6D4]" />
            </span>
            Beta · Cupos limitados — únete ahora
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 text-center"
        >
          <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-5xl lg:text-6xl xl:text-7xl">
            Automatiza tu prospección
            <br />
            <span className="bg-gradient-to-r from-[#2563EB] to-[#06B6D4] bg-clip-text text-transparent">
              en LinkedIn con IA
            </span>
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-[var(--foreground-muted)] md:text-xl"
        >
          Conecta con{" "}
          <strong className="font-semibold text-[var(--foreground)]">500+ prospectos calificados</strong>{" "}
          al mes con mensajes personalizados y una IA que negocia por ti — sin arriesgar tu cuenta.
        </motion.p>

        {/* CTAs */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-8 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(37,99,235,0.35)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(6,182,212,0.40)]"
          >
            Empezar gratis
            <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/50 px-8 py-3.5 text-sm font-semibold text-[var(--foreground-muted)] backdrop-blur-sm transition-all duration-200 hover:border-[var(--primary)]/50 hover:text-[var(--foreground)]"
          >
            Ver demo en vivo
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Link>
        </motion.div>

        {/* Trust line */}
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-5 text-center text-sm text-[var(--foreground-faint)]"
        >
          Sin tarjeta de crédito · 7 días gratis · Cancela cuando quieras
        </motion.p>

        {/* Stats */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-8 text-center"
        >
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-bold text-[var(--foreground)] md:text-4xl">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mx-auto mt-20 max-w-4xl"
        >
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] opacity-20 blur-xl" />

            <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-lg)]">

              {/* Browser chrome */}
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--sidebar)] px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-[#EF4444]/80" />
                <span className="h-3 w-3 rounded-full bg-[#F59E0B]/80" />
                <span className="h-3 w-3 rounded-full bg-[#10B981]/80" />
                <div className="ml-4 flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-1">
                  <svg className="h-3 w-3 text-[var(--foreground-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                  <span className="text-xs text-[var(--foreground-faint)]">app.cazary.ai/dashboard</span>
                </div>
              </div>

              {/* Dashboard content — always dark, hardcoded colors */}
              <div
                className="relative mt-2 overflow-hidden rounded-xl bg-[#0A1628] p-5"
                style={{
                  backgroundImage: `linear-gradient(rgba(37,99,235,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.06) 1px, transparent 1px)`,
                  backgroundSize: "32px 32px",
                }}
              >
                {/* Subtle glow */}
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#2563EB] opacity-[0.07] blur-[60px]" />
                <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-[#06B6D4] opacity-[0.06] blur-[40px]" />

                <div className="relative grid gap-3 sm:grid-cols-4">
                  {[
                    { label: "Conexiones enviadas", value: "487", change: "+12%", positive: true },
                    { label: "Respuestas recibidas", value: "93", change: "19% tasa", positive: true },
                    { label: "Reuniones agendadas", value: "14", change: "+3 esta semana", positive: true },
                    { label: "Mensajes IA enviados", value: "41", change: "Autopilot activo", positive: null },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-[#2D3F55] bg-[#1E293B] p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-[#475569]">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold text-[#F8FAFC]">{stat.value}</p>
                      <p className={`mt-1 text-[11px] font-medium ${stat.positive === true ? "text-[#10B981]" : stat.positive === false ? "text-[#EF4444]" : "text-[#94A3B8]"}`}>
                        {stat.change}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="relative mt-3 grid grid-cols-3 gap-2">
                  {[
                    { col: "Contactados",  count: 142, border: "#2D3F55",              bg: "rgba(30,41,59,1)"           },
                    { col: "Respondieron", count: 37,  border: "rgba(37,99,235,0.4)",  bg: "rgba(37,99,235,0.12)"       },
                    { col: "Interesados",  count: 14,  border: "rgba(6,182,212,0.4)",  bg: "rgba(6,182,212,0.12)"       },
                  ].map((col) => (
                    <div key={col.col} className="rounded-lg px-3 py-2.5" style={{ border: `1px solid ${col.border}`, background: col.bg }}>
                      <p className="text-xs font-semibold text-[#94A3B8]">{col.col}</p>
                      <p className="mt-0.5 text-lg font-bold text-[#F8FAFC]">{col.count} leads</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-[var(--foreground-faint)]">
            Dashboard en tiempo real · Actualización cada 60 segundos
          </p>
        </motion.div>

      </div>
    </section>
  );
}
