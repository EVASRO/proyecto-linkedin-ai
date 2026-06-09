import { getCrmData } from "./actions";
import { CrmView } from "@/components/crm/CrmView";

export default async function CrmPage() {
  const result = await getCrmData();

  if (!result.success || !result.data) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <CrmView initialLeads={[]} initialColumns={[]} initialAutomations={[]} workspaceId="" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <CrmView
        initialLeads={result.data.leads}
        initialColumns={result.data.columns}
        initialAutomations={result.data.automations}
        workspaceId={result.data.workspaceId}
      />
    </div>
  );
}
