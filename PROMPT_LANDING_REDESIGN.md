# PROMPT PARA VS CODE — CAZARY.AI LANDING PAGE REDESIGN
## Header + Hero · Prueba de Design System

---

## CONTEXTO PARA EL AGENTE

Eres el agente de desarrollo del SaaS B2B **cazary.ai** (antes NexusAI). Competimos directamente con **Apollo.io, ElevenLabs, Waalaxy y Dripify**. El estándar de calidad visual es ElevenLabs.io — minimalista, premium, oscuro, con animaciones suaves y tipografía bold impactante.

Esta tarea es una **prueba de diseño en la landing page** antes de aplicar cambios al dashboard completo. El objetivo es rediseñar ÚNICAMENTE:
1. `src/app/globals.css` — Design tokens cazary.ai
2. `src/components/layout/marketing-header.tsx` — Navbar premium
3. `src/components/landing/hero.tsx` — Hero section nivel ElevenLabs

**NO tocar ningún otro archivo por ahora.**

---

## PALETA OFICIAL cazary.ai (NO usar otros colores)

```
Gradiente marca:    #2563EB → #06B6D4  (izquierda a derecha / abajo hacia arriba)
Fondo dark:         #0F172A  (slate oscuro — NO negro puro)
Surface dark:       #1E293B  (cards y paneles)
Border dark:        #2D3F55
Sidebar:            #080F1E
Texto dark:         #F8FAFC  (no blanco puro)
Texto muted:        #94A3B8
Texto faint:        #475569
Fondo light:        #F8FAFC
Texto light:        #1E293B
Success:            #10B981
Warning:            #F59E0B
Danger:             #EF4444
```

---

## PASO 1 — Actualizar `src/app/globals.css`

Reemplaza completamente el bloque `:root` y añade el tema oscuro. Mantén los imports de tailwindcss y xyflow intactos al inicio.

```css
@import "tailwindcss";
@import "@xyflow/react/dist/style.css";

/* ── cazary.ai Design Tokens ── */
:root {
  /* Identidad de marca */
  --cazary-cobalt:        #2563EB;
  --cazary-cyan:          #06B6D4;
  --cazary-gradient:      linear-gradient(135deg, #2563EB 0%, #06B6D4 100%);

  /* Dark mode (default) */
  --background:           #0F172A;
  --surface:              #1E293B;
  --surface-hover:        #263348;
  --border:               #2D3F55;
  --border-subtle:        #1E2D42;
  --foreground:           #F8FAFC;
  --foreground-muted:     #94A3B8;
  --foreground-faint:     #475569;

  /* Acento primario */
  --primary:              #2563EB;
  --primary-hover:        #1D4ED8;
  --primary-foreground:   #FFFFFF;
  --primary-soft:         rgba(37, 99, 235, 0.12);

  /* Acento secundario IA */
  --accent:               #06B6D4;
  --accent-hover:         #0891B2;
  --accent-foreground:    #FFFFFF;
  --accent-soft:          rgba(6, 182, 212, 0.12);

  /* Sidebar (siempre dark) */
  --sidebar:              #080F1E;
  --sidebar-border:       #1E293B;
  --sidebar-muted:        #475569;

  /* Semánticos */
  --success:              #10B981;
  --success-soft:         rgba(16, 185, 129, 0.10);
  --warning:              #F59E0B;
  --warning-soft:         rgba(245, 158, 11, 0.10);
  --danger:               #EF4444;
  --danger-soft:          rgba(239, 68, 68, 0.10);

  /* Sombras */
  --shadow-sm:            0 1px 2px rgba(0,0,0,0.4);
  --shadow-md:            0 4px 16px rgba(0,0,0,0.35);
  --shadow-lg:            0 8px 32px rgba(0,0,0,0.45);
  --shadow-glow-primary:  0 0 24px rgba(37,99,235,0.30);
  --shadow-glow-accent:   0 0 24px rgba(6,182,212,0.22);

  /* Transiciones */
  --transition-fast:      150ms ease;
  --transition-base:      200ms ease;
  --transition-slow:      300ms ease;

  /* Legacy compat */
  --muted:                #94A3B8;
  --card-shadow:          0 1px 3px rgba(0,0,0,0.4);
}

/* Light mode override */
[data-theme="light"] {
  --background:           #F8FAFC;
  --surface:              #FFFFFF;
  --surface-hover:        #F1F5F9;
  --border:               #E2E8F0;
  --border-subtle:        #F1F5F9;
  --foreground:           #1E293B;
  --foreground-muted:     #64748B;
  --foreground-faint:     #94A3B8;
  --primary-soft:         rgba(37, 99, 235, 0.08);
  --accent-soft:          rgba(6, 182, 212, 0.08);
  --shadow-sm:            0 1px 2px rgba(0,0,0,0.06);
  --shadow-md:            0 4px 16px rgba(0,0,0,0.08);
  --shadow-lg:            0 8px 32px rgba(0,0,0,0.12);
  --shadow-glow-primary:  0 0 16px rgba(37,99,235,0.15);
  --shadow-glow-accent:   0 0 16px rgba(6,182,212,0.12);
}

@theme inline {
  --color-background:       var(--background);
  --color-foreground:       var(--foreground);
  --color-muted:            var(--foreground-muted);
  --color-border:           var(--border);
  --color-primary:          var(--primary);
  --color-primary-hover:    var(--primary-hover);
  --color-primary-soft:     var(--primary-soft);
  --color-accent:           var(--accent);
  --color-surface:          var(--surface);
  --color-sidebar:          var(--sidebar);
  --color-sidebar-border:   var(--sidebar-border);
  --color-sidebar-muted:    var(--sidebar-muted);
  --color-success:          var(--success);
  --color-warning:          var(--warning);
  --color-danger:           var(--danger);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Utilidad: texto con gradiente de marca */
.text-gradient-cazary {
  background: var(--cazary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Utilidad: borde con gradiente */
.border-gradient-cazary {
  border: 1px solid transparent;
  background: linear-gradient(var(--surface), var(--surface)) padding-box,
              var(--cazary-gradient) border-box;
}
```

---

## PASO 2 — Rediseñar `src/components/layout/marketing-header.tsx`

Usa los **MCPs disponibles en VS Code** de esta forma:
- **shadcn MCP**: Para el componente `Button` y `Badge` si necesitas actualizarlos
- **21st.dev MCP**: Busca un componente navbar premium tipo "glassmorphism navbar dark" y úsalo como referencia/base
- **Magic UI MCP**: Usa `<AnimatedGradientText>` para el badge de anuncio en el header si está disponible

Crea un header completamente nuevo con estas especificaciones:

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

// Config de navegación
const navLinks = [
  { label: "Características", href: "#caracteristicas" },
  { label: "Comparativa", href: "#comparativa" },
  { label: "Precios", href: "#precios" },
  { label: "FAQ", href: "#faq" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-[var(--border)] bg-[#0F172A]/90 backdrop-blur-xl shadow-[var(--shadow-md)]"
          : "border-b border-transparent bg-transparent",
      ].join(" ")}
    >
      {/* Línea superior de gradiente (sutil) */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#2563EB] to-[#06B6D4] opacity-60" />

      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/brand/logo-rect-navy.png"
            alt="cazary.ai"
            width={120}
            height={32}
            className="h-8 w-auto object-contain"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--foreground-muted)] transition-colors duration-150 hover:text-[var(--foreground)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)] sm:block"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-glow-primary)] transition-all duration-200 hover:opacity-90 hover:shadow-[var(--shadow-glow-accent)]"
          >
            Empezar gratis
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>

          {/* Mobile burger */}
          <button
            type="button"
            className="ml-1 rounded-lg p-2 text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)] md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Menú"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {open
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[var(--border)] bg-[#0F172A]/95 backdrop-blur-xl px-6 md:hidden"
          >
            <nav className="flex flex-col gap-1 py-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
                <Link href="/login" className="block rounded-lg border border-[var(--border)] px-4 py-2.5 text-center text-sm font-medium text-[var(--foreground-muted)] hover:border-[var(--primary)] hover:text-[var(--foreground)]">
                  Iniciar sesión
                </Link>
                <Link href="/login" className="block rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2.5 text-center text-sm font-semibold text-white">
                  Empezar gratis →
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
```

**IMPORTANTE con el logo:**
- Copia `brand/logo/logo-rect-navy.png` a `public/logo-rect-navy.png` para que Next.js Image lo sirva correctamente.
- Copia también `brand/logo/logo-icon-dark.png` a `public/logo-icon-dark.png`

---

## PASO 3 — Rediseñar `src/components/landing/hero.tsx`

Usa los **MCPs** de esta forma:
- **Magic UI MCP**: Busca y usa `<NumberTicker>` para animar las estadísticas (500+, 19%, 14x)
- **Magic UI MCP**: Usa `<ShimmerButton>` o `<BorderBeam>` para el CTA principal si está disponible
- **21st.dev MCP**: Busca "hero section dark gradient" como referencia visual
- **framer-motion**: Usa `motion.div` con `initial/animate/transition` para entrada suave de elementos

Crea el hero con estas especificaciones exactas:

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
// Importar desde Magic UI si está disponible:
// import { NumberTicker } from "@/components/magicui/number-ticker";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const stats = [
  { value: 500, suffix: "+", label: "Prospectos al mes" },
  { value: 19, suffix: "%", label: "Tasa de respuesta" },
  { value: 14, suffix: "x", label: "Más eficiente que manual" },
];

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#0F172A] pt-16">

      {/* ── Fondo: radial gradient de marca ── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Glow azul izquierda */}
        <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-[#2563EB] opacity-[0.08] blur-[120px]" />
        {/* Glow cyan derecha */}
        <div className="absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full bg-[#06B6D4] opacity-[0.06] blur-[100px]" />
        {/* Grid sutil */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">

        {/* ── Badge de anuncio ── */}
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

        {/* ── Headline principal ── */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 text-center"
        >
          <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-5xl lg:text-6xl xl:text-7xl">
            Automatiza tu prospección
            <br />
            <span
              className="bg-gradient-to-r from-[#2563EB] to-[#06B6D4] bg-clip-text text-transparent"
            >
              en LinkedIn con IA
            </span>
          </h1>
        </motion.div>

        {/* ── Subtítulo ── */}
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-[var(--foreground-muted)] md:text-xl"
        >
          Conecta con <strong className="font-semibold text-[var(--foreground)]">500+ prospectos calificados</strong> al mes
          con mensajes personalizados y una IA que negocia por ti — sin arriesgar tu cuenta.
        </motion.p>

        {/* ── CTAs ── */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          {/* CTA primario con gradiente */}
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-8 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(37,99,235,0.35)] transition-all duration-200 hover:shadow-[0_0_40px_rgba(6,182,212,0.40)] hover:scale-[1.02]"
          >
            Empezar gratis
            <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>

          {/* CTA secundario con borde sutil */}
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

        {/* ── Trust line ── */}
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-5 text-center text-sm text-[var(--foreground-faint)]"
        >
          Sin tarjeta de crédito · 7 días gratis · Cancela cuando quieras
        </motion.p>

        {/* ── Stats ── */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-8 text-center"
        >
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-bold text-[var(--foreground)] md:text-4xl">
                {/* Si NumberTicker de Magic UI está disponible: */}
                {/* <NumberTicker value={stat.value} />{stat.suffix} */}
                {/* Si no, usar el valor directo: */}
                <span>{stat.value}{stat.suffix}</span>
              </p>
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Dashboard Mockup ── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mx-auto mt-20 max-w-4xl"
        >
          {/* Outer glow */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#06B6D4] opacity-20 blur-xl" />

            {/* Frame */}
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

              {/* Dashboard content */}
              <div className="mt-2 rounded-xl bg-[#0F172A] p-5">
                {/* Metrics row */}
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    { label: "Conexiones enviadas", value: "487", change: "+12%", positive: true },
                    { label: "Respuestas recibidas", value: "93", change: "19% tasa", positive: true },
                    { label: "Reuniones agendadas", value: "14", change: "+3 esta semana", positive: true },
                    { label: "Mensajes IA enviados", value: "41", change: "Autopilot activo", positive: null },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--foreground-faint)]">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{stat.value}</p>
                      <p className={`mt-1 text-[11px] font-medium ${stat.positive === true ? "text-[#10B981]" : stat.positive === false ? "text-[#EF4444]" : "text-[var(--foreground-muted)]"}`}>
                        {stat.change}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Pipeline hint */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { col: "Contactados", count: 142, color: "border-[var(--border)] bg-[var(--surface)]" },
                    { col: "Respondieron", count: 37, color: "border-[#2563EB]/30 bg-[#2563EB]/10" },
                    { col: "Interesados", count: 14, color: "border-[#06B6D4]/30 bg-[#06B6D4]/10" },
                  ].map((col) => (
                    <div key={col.col} className={`rounded-lg border ${col.color} px-3 py-2.5`}>
                      <p className="text-xs font-semibold text-[var(--foreground-muted)]">{col.col}</p>
                      <p className="mt-0.5 text-lg font-bold text-[var(--foreground)]">{col.count} leads</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Caption bajo el mockup */}
          <p className="mt-4 text-center text-xs text-[var(--foreground-faint)]">
            Dashboard en tiempo real · Actualización cada 60 segundos
          </p>
        </motion.div>

      </div>
    </section>
  );
}
```

---

## PASO 4 — Ajustes adicionales requeridos

### 4a. Copiar logos al directorio público:
```bash
cp brand/logo/logo-rect-navy.png public/logo-rect-navy.png
cp brand/logo/logo-icon-dark.png public/logo-icon-dark.png
cp brand/logo/logo-rect-light.png public/logo-rect-light.png
```

### 4b. Actualizar `src/app/layout.tsx`
Asegúrate de que el `<html>` tenga la clase del tema dark por defecto:
```tsx
// En el elemento <html>, agregar:
<html lang="es" className="dark" suppressHydrationWarning>
```
Y en el `<head>`, actualizar metadata:
```tsx
export const metadata: Metadata = {
  title: "cazary.ai — Automatiza tu prospección en LinkedIn con IA",
  description: "Conecta con 500+ prospectos calificados al mes. La IA que prospecta, negocia y agenda reuniones por ti.",
};
```

### 4c. Verificar que `framer-motion` está instalado:
```bash
npm list framer-motion
# Si no está: npm install framer-motion
```

---

## PASO 5 — USO DE MCPs EN VS CODE (instrucción al agente)

Para cada componente, el agente de VS Code debe:

1. **21st.dev MCP** — Usar el comando de búsqueda disponible para buscar:
   - `"glassmorphism navbar dark premium"`
   - `"hero section dark AI SaaS"`
   Tomar como **inspiración visual** el resultado y adaptar al código especificado arriba.

2. **Magic UI MCP** — Intentar instalar y usar:
   ```
   npx magicui-cli add number-ticker
   npx magicui-cli add border-beam
   npx magicui-cli add animated-gradient-text
   ```
   Si el CLI falla, crear el componente manualmente en `src/components/magicui/number-ticker.tsx` basado en la documentación en https://magicui.design/docs/components/number-ticker

3. **shadcn MCP** — Verificar que los componentes Button y Badge usan los nuevos tokens de color.

4. **Playwright MCP** — Después de implementar, correr:
   ```
   npx playwright test tests/visual/ --reporter=html
   ```
   Y tomar un screenshot de localhost:3000 para verificar el resultado.

---

## VALIDACIÓN FINAL

Antes de reportar como completo, el agente debe:
1. Correr `npm run build` — debe compilar sin errores TypeScript
2. Correr `npm run dev` y navegar a `localhost:3000`
3. Verificar visualmente: fondo `#0F172A`, gradiente azul→cyan en headline y CTA, logo correcto
4. Verificar que el header se vuelve glass al hacer scroll
5. Reportar cualquier error con el stack trace completo

---

## RESULTADO ESPERADO

Una landing page de nivel **ElevenLabs.io** con:
- ✅ Fondo dark slate `#0F172A`
- ✅ Gradiente de marca `#2563EB → #06B6D4` en headline, CTA y detalles
- ✅ Header glass con efecto blur al hacer scroll
- ✅ Logo cazary.ai correcto (no texto)
- ✅ Animaciones suaves con framer-motion
- ✅ Dashboard mockup en dark mode con colores de marca
- ✅ Stats con valores impactantes
- ✅ Mobile responsive
