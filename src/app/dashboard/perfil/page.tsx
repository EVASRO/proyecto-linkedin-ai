import { redirect } from "next/navigation";
import { getProfileData } from "./actions";
import { PerfilView } from "@/components/perfil/PerfilView";

export default async function PerfilPage() {
  const result = await getProfileData();
  if (!result.success || !result.data) redirect("/login");
  return <PerfilView initialData={result.data} />;
}
