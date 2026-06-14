"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const navLinks = [
  { label: "Características", href: "#caracteristicas" },
  { label: "Comparativa", href: "#comparativa" },
  { label: "Precios", href: "#precios" },
  { label: "FAQ", href: "#faq" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Logo logic:
  // - Light mode + header NOT scrolled (transparent over light hero) → logo-rect-light.png (dark text, no bg)
  // - Dark mode OR header scrolled (bg-[#0F172A]/90 always dark) → logo-rect-navy.png (white text, no bg)
  const useLightLogo = mounted && theme === "light" && !scrolled;
  const logoSrc = useLightLogo ? "/logo-rect-black-ghost.png" : "/logo-rect-black.png";

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-[var(--border)] bg-[#0F172A]/90 backdrop-blur-xl shadow-[var(--shadow-md)]"
          : "border-b border-transparent bg-transparent",
      ].join(" ")}
    >
      {/* Gradient accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#2563EB] to-[#06B6D4] opacity-60" />

      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {/* Logo — 30% bigger, switches between light/dark version */}
        <Link href="/" className="flex items-center">
          <Image
            src={logoSrc}
            alt="cazary.ai"
            width={218}
            height={58}
            className="h-14 w-auto object-contain transition-opacity duration-200"
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
          <ThemeToggle />
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

      {/* Mobile menu — always dark bg so always use light text */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[#2D3F55] bg-[#0F172A]/95 backdrop-blur-xl px-6 md:hidden"
          >
            <nav className="flex flex-col gap-1 py-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#94A3B8] transition-colors hover:bg-[#1E293B] hover:text-[#F1F5F9]"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-[#2D3F55] pt-3">
                <Link
                  href="/login"
                  className="block rounded-lg border border-[#2D3F55] px-4 py-2.5 text-center text-sm font-medium text-[#94A3B8] hover:border-[#2563EB] hover:text-[#F1F5F9]"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/login"
                  className="block rounded-lg bg-gradient-to-r from-[#2563EB] to-[#06B6D4] px-4 py-2.5 text-center text-sm font-semibold text-white"
                >
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
