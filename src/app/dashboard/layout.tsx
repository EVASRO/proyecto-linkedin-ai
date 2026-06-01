import type { Metadata } from "next";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DemoModeProvider } from "@/components/providers/demo-mode-provider";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoModeProvider>
      <DashboardShell>{children}</DashboardShell>
    </DemoModeProvider>
  );
}
