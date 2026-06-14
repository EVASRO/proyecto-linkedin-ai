import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { getAnalyticsData } from "./actions";

export default async function AnalyticsPage() {
  const result = await getAnalyticsData();
  const data = result.success ? result.data : null;
  return <AnalyticsView data={data ?? undefined} />;
}
