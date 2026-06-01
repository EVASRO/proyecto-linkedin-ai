import { getTeamData } from "./actions";
import { EquipoView } from "@/components/equipo/EquipoView";

export default async function EquipoPage() {
  const result = await getTeamData();
  return (
    <EquipoView
      initialMembers={result.data?.members ?? []}
      initialInvitations={result.data?.invitations ?? []}
    />
  );
}
