"use client";

import React, { useEffect, useState } from "react";
import { User, Building2, Briefcase, Mail, Ban, Webhook } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ProfileSettings } from "./ProfileSettings";
import { WorkspaceSettings } from "./WorkspaceSettings";
import { LinkedInLimitsSettings } from "./LinkedInLimitsSettings";
import { BlacklistSettings } from "./BlacklistSettings";
import { EmailProviderSetup } from "./EmailProviderSetup";
import { WebhooksSettings } from "./WebhooksSettings";
import type { WebhookRow } from "@/app/dashboard/perfil/actions";

type SettingsTab = "profile" | "workspace" | "linkedin" | "email" | "blacklist" | "webhooks";

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "profile",   label: "Perfil",    icon: User },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "linkedin",  label: "LinkedIn",  icon: Briefcase },
  { id: "email",     label: "Email",     icon: Mail },
  { id: "blacklist", label: "Blacklist", icon: Ban },
  { id: "webhooks",  label: "Webhooks",  icon: Webhook },
];

const VALID_TABS = new Set<string>(TABS.map((t) => t.id));

type Props = {
  profileData:   NonNullable<any>;
  wsData:        any;
  liStatus:      any;
  emailData:     any;
  blacklistData: any[];
  webhooksData:  WebhookRow[];
  appUrl:        string;
};

export function SettingsPageClient({
  profileData, wsData, liStatus, emailData, blacklistData, webhooksData, appUrl,
}: Props) {
  const searchParams = useSearchParams();
  const tabParam     = searchParams.get("tab");
  const initial      = VALID_TABS.has(tabParam ?? "") ? (tabParam as SettingsTab) : "profile";
  const [active, setActive] = useState<SettingsTab>(initial);

  // Sync if URL param changes (e.g. redirect from /configuracion or /perfil)
  useEffect(() => {
    if (tabParam && VALID_TABS.has(tabParam)) setActive(tabParam as SettingsTab);
  }, [tabParam]);

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      {/* Sidebar */}
      <aside className="w-56 shrink-0">
        <nav className="flex flex-col gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all text-left",
                active === id
                  ? "bg-gradient-to-r from-[#2563EB] to-[#06B6D4] text-white shadow-md shadow-[rgba(37,99,235,0.3)]"
                  : "text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              )}
            >
              <Icon
                className={cn("h-4 w-4 shrink-0", active === id ? "text-white" : "text-[var(--foreground-faint)]")}
                strokeWidth={active === id ? 2.25 : 2}
              />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="min-w-0 flex-1">
        {active === "profile"   && <ProfileSettings initial={profileData} />}
        {active === "workspace" && <WorkspaceSettings initial={wsData} appUrl={appUrl} />}
        {active === "linkedin"  && (
          <LinkedInLimitsSettings initialSettings={wsData} initialStatus={liStatus} />
        )}
        {active === "email" && (
          <div className="max-w-2xl">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Email</h2>
              <p className="text-sm text-[var(--foreground-muted)]">Configura el proveedor de email para tus secuencias</p>
            </div>
            <EmailProviderSetup initial={emailData ?? null} />
          </div>
        )}
        {active === "blacklist" && <BlacklistSettings initial={blacklistData} />}
        {active === "webhooks"  && (
          <div className="max-w-2xl">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Webhooks</h2>
              <p className="text-sm text-[var(--foreground-muted)]">Recibe eventos de cazary.ai en tus endpoints</p>
            </div>
            <WebhooksSettings initial={webhooksData} />
          </div>
        )}
      </main>
    </div>
  );
}
