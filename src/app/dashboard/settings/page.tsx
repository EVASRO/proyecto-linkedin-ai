import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsPageClient } from "@/components/settings/SettingsPageClient";
import {
  getUserProfile,
  getWorkspaceSettings,
  getLinkedInStatus,
  getBlacklist,
} from "./actions";
import { getEmailProvider } from "./email/actions";
import { getProfileData } from "@/app/dashboard/perfil/actions";

export const metadata = { title: "Configuración" };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://proyecto-linkedin-ai.vercel.app";

export default async function SettingsPage() {
  const [profileRes, wsRes, liRes, blacklistRes, emailRes, perfilRes] = await Promise.all([
    getUserProfile(),
    getWorkspaceSettings(),
    getLinkedInStatus(),
    getBlacklist(),
    getEmailProvider(),
    getProfileData(),
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
      <div className="border-b border-[var(--border)] px-6 py-5">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Configuración</h1>
        <p className="text-sm text-[var(--foreground-muted)]">Gestiona tu cuenta, workspace, LinkedIn, email y webhooks</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Suspense fallback={null}>
          <SettingsPageClient
            profileData={profileRes.data!}
            wsData={wsData}
            liStatus={liStatus}
            emailData={emailRes.data ?? null}
            blacklistData={blacklistRes.data ?? []}
            webhooksData={perfilRes.data?.webhooks ?? []}
            appUrl={APP_URL}
          />
        </Suspense>
      </div>
    </div>
  );
}
