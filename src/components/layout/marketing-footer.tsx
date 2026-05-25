import { Logo } from "@/components/ui/logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Plataforma SaaS corporativa para equipos que quieren escalar su
              presencia profesional con IA.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 text-sm">
            <div>
              <p className="font-semibold text-foreground">Producto</p>
              <ul className="mt-3 space-y-2 text-muted">
                <li>
                  <a href="#caracteristicas" className="hover:text-foreground">
                    Características
                  </a>
                </li>
                <li>
                  <a href="#precios" className="hover:text-foreground">
                    Precios
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">Empresa</p>
              <ul className="mt-3 space-y-2 text-muted">
                <li>
                  <a href="#" className="hover:text-foreground">
                    Sobre nosotros
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground">
                    Contacto
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">Legal</p>
              <ul className="mt-3 space-y-2 text-muted">
                <li>
                  <a href="#" className="hover:text-foreground">
                    Privacidad
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground">
                    Términos
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-border pt-8 text-center text-sm text-muted">
          © {new Date().getFullYear()} NexusAI. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
