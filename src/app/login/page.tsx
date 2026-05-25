import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/ui/logo";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default function LoginPage() {
  const googleEnabled = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  return (
    <div className="flex min-h-full">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-12 lg:flex">
        <Logo variant="light" />
        <div>
          <blockquote className="text-xl font-medium leading-relaxed text-white">
            &ldquo;NexusAI redujo nuestro tiempo de producción de contenido en un
            60%. El panel es exactamente lo que esperábamos de una herramienta
            corporativa.&rdquo;
          </blockquote>
          <p className="mt-6 text-sm text-slate-400">
            — María García, Directora de Marketing
          </p>
        </div>
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} NexusAI
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Bienvenido de nuevo
          </h1>
          <p className="mt-2 text-sm text-muted">
            Inicia sesión para acceder a tu panel de control.
          </p>
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm googleEnabled={googleEnabled} />
          </Suspense>
          <p className="mt-8 text-center text-sm text-muted">
            ¿No tienes cuenta?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Regístrate gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="mt-8 space-y-5 animate-pulse">
      <div className="h-10 rounded-lg bg-slate-200" />
      <div className="h-10 rounded-lg bg-slate-200" />
      <div className="h-10 rounded-lg bg-slate-200" />
    </div>
  );
}
