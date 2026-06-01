import { auth } from "@/auth";
import { Bell } from "lucide-react";
import Link from "next/link";

type DashboardHeaderProps = {
  title: string;
  description?: string;
};

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "U";
}

export async function DashboardHeader({
  title,
  description,
}: DashboardHeaderProps) {
  const session = await auth();
  const initials = getInitials(session?.user?.name, session?.user?.email);

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/95 px-4 py-5 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Plataforma B2B
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alertas</span>
          </button>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-foreground">
              {session?.user?.name ?? "Usuario"}
            </p>
            <p className="text-xs text-muted">{session?.user?.email}</p>
          </div>
          <Link
            href="/dashboard/perfil"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-sm font-bold text-white shadow-md shadow-emerald-500/25 transition-transform hover:scale-105"
            title="Ver mi perfil"
          >
            {initials}
          </Link>
        </div>
      </div>
    </header>
  );
}
