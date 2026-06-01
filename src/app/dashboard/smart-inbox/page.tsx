import { getInboxData } from "./actions";
import { InboxLayout } from "@/components/smart-inbox/InboxLayout";

export default async function SmartInboxPage() {
  const result = await getInboxData();
  const conversations = result.data?.conversations ?? [];
  return (
    <div className="flex flex-1 overflow-hidden">
      <InboxLayout initialConversations={conversations} />
    </div>
  );
}
