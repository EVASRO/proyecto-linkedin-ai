import { getConfigData } from "./actions";
import { ConfiguracionView } from "@/components/configuracion/ConfiguracionView";

export default async function ConfiguracionPage() {
  const result = await getConfigData();
  return (
    <ConfiguracionView
      initialSettings={result.data?.settings ?? null}
      initialWebhooks={result.data?.webhooks ?? []}
    />
  );
}
