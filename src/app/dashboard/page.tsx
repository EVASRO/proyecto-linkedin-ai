import { getDashboardData } from "./actions";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const result = await getDashboardData();
  return <DashboardView initialData={result.data ?? null} />;
}
