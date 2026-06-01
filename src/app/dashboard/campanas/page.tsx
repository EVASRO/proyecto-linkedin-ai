import { getCampaignsData } from "./actions";
import CampanasClient from "@/components/campaigns/CampanasClient";

export default async function CampanasPage() {
  const result = await getCampaignsData();

  if (!result.success || !result.data) {
    return <CampanasClient initialData={{ campaigns: [], linkedinAccounts: [] }} />;
  }

  return <CampanasClient initialData={result.data} />;
}
