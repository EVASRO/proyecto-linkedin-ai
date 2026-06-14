import Image from "next/image";
import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="bg-[var(--sidebar)] relative">
      {/* Gradient top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-[#2563EB]/20 via-[#06B6D4]/20 to-transparent" />

      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <Image
              src="/logo-rect-navy.png"
              alt="cazary.ai"
              width={120}
              height={32}
              className="h-8 w-auto object-contain"
            />
            <p className="mt-4 text-sm leading-relaxed text-[var(--foreground-muted)]">
              Automatiza tu prospección en LinkedIn con IA. Más reuniones, menos trabajo manual. — cazary.ai
            </p>
            {/* Social icons */}
            <div className="mt-4 flex gap-4">
              <a href="#" aria-label="LinkedIn" className="text-[var(--foreground-faint)] transition-colors duration-150 hover:text-[var(--foreground)]">
                <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a href="#" aria-label="Twitter / X" className="text-[var(--foreground-faint)] transition-colors duration-150 hover:text-[var(--foreground)]">
                <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            <div>
              <p className="font-semibold text-[var(--foreground)]">Producto</p>
              <ul className="mt-3 space-y-2">
                <li><a href="#caracteristicas" className="text-[var(--foreground-muted)] transition-colors duration-150 hover:text-[var(--foreground)]">Características</a></li>
                <li><a href="#comparativa"     className="text-[var(--foreground-muted)] transition-colors duration-150 hover:text-[var(--foreground)]">Comparativa</a></li>
                <li><a href="#precios"         className="text-[var(--foreground-muted)] transition-colors duration-150 hover:text-[var(--foreground)]">Precios</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-[var(--foreground)]">Empresa</p>
              <ul className="mt-3 space-y-2">
                <li><a href="#faq"                   className="text-[var(--foreground-muted)] transition-colors duration-150 hover:text-[var(--foreground)]">FAQ</a></li>
                <li><a href="mailto:hola@cazary.ai"  className="text-[var(--foreground-muted)] transition-colors duration-150 hover:text-[var(--foreground)]">Contacto</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-[var(--foreground)]">Cuenta</p>
              <ul className="mt-3 space-y-2">
                <li><Link href="/login" className="text-[var(--foreground-muted)] transition-colors duration-150 hover:text-[var(--foreground)]">Iniciar sesión</Link></li>
                <li><Link href="/login" className="text-[var(--foreground-muted)] transition-colors duration-150 hover:text-[var(--foreground)]">Registrarse</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[var(--border)] pt-8 text-xs text-[var(--foreground-faint)] sm:flex-row">
          <span>© cazary.ai 2026 — Todos los derechos reservados.</span>
          <div className="flex gap-4">
            <a href="#" className="transition-colors duration-150 hover:text-[var(--foreground-muted)]">Términos de uso</a>
            <a href="#" className="transition-colors duration-150 hover:text-[var(--foreground-muted)]">Privacidad</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
