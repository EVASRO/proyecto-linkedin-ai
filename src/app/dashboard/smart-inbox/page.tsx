import { getConversationsWithMessages } from "./actions";
import { InboxLayout } from "@/components/smart-inbox/InboxLayout";

export default async function SmartInboxPage() {
  const result = await getConversationsWithMessages();
  const conversations = result.data?.conversations ?? [];
  const workspaceId   = result.data?.workspaceId   ?? "";
  return (
    <div className="flex flex-1 overflow-hidden">
      <InboxLayout initialConversations={conversations} workspaceId={workspaceId} />
    </div>
  );
}
