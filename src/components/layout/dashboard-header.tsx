import { auth } from "@/auth";

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
    <header className="flex flex-col gap-1 border-b border-border bg-surface px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-slate-50 hover:text-foreground"
        >
          Notificaciones
        </button>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-foreground">
            {session?.user?.name ?? "Usuario"}
          </p>
          <p className="text-xs text-muted">{session?.user?.email}</p>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white"
          title={session?.user?.email ?? undefined}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
