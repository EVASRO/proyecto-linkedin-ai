import { redirect } from "next/navigation";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { WorkspaceSettings } from "@/components/settings/WorkspaceSettings";
import { LinkedInLimitsSettings } from "@/components/settings/LinkedInLimitsSettings";
import { BlacklistSettings } from "@/components/settings/BlacklistSettings";
import { EmailProviderSetup } from "@/components/settings/EmailProviderSetup";
import {
  getUserProfile,
  getWorkspaceSettings,
  getLinkedInStatus,
  getBlacklist,
} from "./actions";
import { getEmailProvider } from "./email/actions";

export const metadata = { title: "Configuración" };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://proyecto-linkedin-ai.vercel.app";

export default async function SettingsPage() {
  const [profileRes, wsRes, liRes, blacklistRes, emailRes] = await Promise.all([
    getUserProfile(),
    getWorkspaceSettings(),
    getLinkedInStatus(),
    getBlacklist(),
    getEmailProvider(),
  ]);

  if (!profileRes.success || !profileRes.data) redirect("/login");

  const wsData = wsRes.data ?? {
    workspace_name:      null,
    logo_url:            null,
    daily_connect_limit: 20,
    daily_message_limit: 50,
    daily_view_limit:    100,
    working_hours_start: 9,
    working_hours_end:   18,
    timezone:            "America/Lima",
  };

  const liStatus = liRes.data ?? {
    connected:         false,
    lastSeen:          null,
    dailyConnectsSent: 0,
    dailyMessagesSent: 0,
    dailyViewsSent:    0,
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-5">
        <h1 className="text-xl font-semibold text-zinc-100">Configuración</h1>
        <p className="text-sm text-zinc-400">Gestiona tu cuenta, workspace y límites de LinkedIn</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <SettingsLayout>
          {(tab) => (
            <>
              {tab === "profile" && (
                <ProfileSettings initial={profileRes.data!} />
              )}
              {tab === "workspace" && (
                <WorkspaceSettings initial={wsData} appUrl={APP_URL} />
              )}
              {tab === "linkedin" && (
                <LinkedInLimitsSettings
                  initialSettings={wsData}
                  initialStatus={liStatus}
                />
              )}
              {tab === "email" && (
                <div className="max-w-2xl">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-zinc-100">Email</h2>
                    <p className="text-sm text-zinc-400">Configura el proveedor de email para tus secuencias</p>
                  </div>
                  <EmailProviderSetup initial={emailRes.data ?? null} />
                </div>
              )}
              {tab === "blacklist" && (
                <BlacklistSettings initial={blacklistRes.data ?? []} />
              )}
            </>
          )}
        </SettingsLayout>
      </div>
    </div>
  );
}
