"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { LoginForm } from "@/components/auth/login-form";

const bullets = [
  "500+ prospectos calificados al mes",
  "IA que negocia y agenda reuniones",
  "Sin riesgo para tu cuenta de LinkedIn",
];

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-[var(--background)]">

      {/* ── Left panel ── */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="relative hidden w-[45%] flex-col overflow-hidden bg-[var(--sidebar)] lg:flex"
      >
        {/* Gradient top line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#2563EB] to-[#06B6D4]" />

        {/* Background glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-1/4 h-[350px] w-[350px] rounded-full bg-[#2563EB] opacity-[0.08] blur-[80px]" />
          <div className="absolute bottom-1/4 right-0 h-[280px] w-[280px] rounded-full bg-[#06B6D4] opacity-[0.06] blur-[80px]" />
        </div>

        <div className="relative flex flex-1 flex-col justify-between p-12">
          {/* Logo */}
          <Image
            src="/logo-rect-navy.png"
            alt="cazary.ai"
            width={140}
            height={38}
            className="h-9 w-auto object-contain"
            priority
          />

          {/* Central content */}
          <div>
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2563EB]/30 bg-[#2563EB]/10 px-3 py-1.5 text-xs font-semibold text-[#93C5FD]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#06B6D4]" />
              Plataforma #1 de prospección IA en LATAM
            </div>

            <h2 className="text-3xl font-bold leading-tight text-[var(--foreground)]">
              Convierte LinkedIn en tu{" "}
              <span className="bg-gradient-to-r from-[#2563EB] to-[#06B6D4] bg-clip-text text-transparent">
                máquina de ventas
              </span>
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--foreground-muted)]">
              Automatiza mensajes, gestiona leads y cierra más reuniones — sin arriesgar tu cuenta.
            </p>

            <ul className="mt-6 space-y-3">
              {bullets.map((b) => (
                <li key={b} className="flex items-center gap-3 text-sm text-[var(--foreground-muted)]">
                  <svg className="h-4 w-4 shrink-0 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Testimonial card */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">
              &ldquo;En 3 semanas conseguí 18 reuniones con CTOs de startups que antes ignoraban mis mensajes. cazary.ai escribe mejor que yo.&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#06B6D4] text-xs font-bold text-white">
                MG
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">María García</p>
                <p className="text-xs text-[var(--foreground-faint)]">Directora de Marketing · SaaS B2B</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Right panel (form) ── */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="relative flex flex-1 flex-col items-center justify-center px-6 py-12"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(37,99,235,0.04), transparent)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-[400px]"
        >
          {/* Logo mobile only */}
          <div className="mb-8 lg:hidden">
            <Image
              src="/logo-rect-navy.png"
              alt="cazary.ai"
              width={130}
              height={35}
              className="h-9 w-auto object-contain"
            />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Bienvenido de nuevo
          </h1>
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">
            Inicia sesión para acceder a tu panel de control.
          </p>

          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
          </Suspense>

          <p className="mt-8 text-center text-sm text-[var(--foreground-muted)]">
            ¿No tienes cuenta?{" "}
            <Link
              href="/login"
              className="bg-gradient-to-r from-[#2563EB] to-[#06B6D4] bg-clip-text font-semibold text-transparent hover:opacity-80"
            >
              Regístrate gratis
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="mt-8 animate-pulse space-y-5">
      <div className="h-10 rounded-lg bg-[var(--surface)]" />
      <div className="h-10 rounded-lg bg-[var(--surface)]" />
      <div className="h-10 rounded-lg bg-[var(--surface)]" />
    </div>
  );
}
