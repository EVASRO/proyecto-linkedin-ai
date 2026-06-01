import { redirect } from "next/navigation";
import { getCampaignsData } from "./actions";
import CampanasClient from "@/components/campaigns/CampanasClient";

export default async function CampanasPage() {
  const result = await getCampaignsData();
  if (!result.success || !result.data) redirect("/login");
  return <CampanasClient initialData={result.data} />;
}
