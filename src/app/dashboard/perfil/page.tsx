import { redirect } from "next/navigation";

export default function PerfilPage() {
  redirect("/dashboard/settings?tab=workspace");
}
