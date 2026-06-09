import { getEmailProvider } from './actions';
import { EmailProviderSetup } from '@/components/settings/EmailProviderSetup';

export default async function EmailSettingsPage() {
  const { data } = await getEmailProvider();
  return (
    <div className="mx-auto max-w-2xl p-6">
      <EmailProviderSetup initial={data} />
    </div>
  );
}
