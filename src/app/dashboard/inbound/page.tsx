import { InboundView } from "@/components/layout/inbound/InboundView";
import { getInboundData } from "./actions";

export default async function InboundPage() {
  const result = await getInboundData();
  const posts  = result.data?.posts        ?? [];
  const leads  = result.data?.inboundLeads ?? [];

  return (
    <div className="flex flex-1 overflow-hidden">
      <InboundView initialPosts={posts} initialLeads={leads} />
    </div>
  );
}
