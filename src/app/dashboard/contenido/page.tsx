import { DashboardHeader } from "@/components/layout/dashboard-header";

export default function ContenidoPage() {
  return (
    <>
      <DashboardHeader
        title="Contenido"
        description="Gestiona publicaciones y borradores generados con IA."
      />
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted">Sección en construcción.</p>
      </div>
    </>
  );
}
