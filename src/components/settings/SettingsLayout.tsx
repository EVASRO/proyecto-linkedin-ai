"use client";

import { useState } from "react";
import { User, Building2, Briefcase, Mail, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsTab = "profile" | "workspace" | "linkedin" | "email" | "blacklist";

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "profile",   label: "Perfil",      icon: User },
  { id: "workspace", label: "Workspace",   icon: Building2 },
  { id: "linkedin",  label: "LinkedIn",    icon: Briefcase },
  { id: "email",     label: "Email",       icon: Mail },
  { id: "blacklist", label: "Blacklist",   icon: Ban },
];

type Props = {
  defaultTab?: SettingsTab;
  children: (activeTab: SettingsTab) => React.ReactNode;
};

export function SettingsLayout({ defaultTab = "profile", children }: Props) {
  const [active, setActive] = useState<SettingsTab>(defaultTab);

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      {/* Sidebar vertical */}
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
                  ? "bg-gradient-to-r from-emerald-600/90 to-green-600/90 text-white shadow-md shadow-emerald-900/30"
                  : "text-zinc-400 hover:bg-zinc-800/80 hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active === id ? "text-white" : "text-zinc-500"
                )}
                strokeWidth={active === id ? 2.25 : 2}
              />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content area */}
      <main className="min-w-0 flex-1">
        {children(active)}
      </main>
    </div>
  );
}
