import { DashboardHeader } from "@/components/layout/dashboard-header";

type PageShellProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <>
      <DashboardHeader title={title} description={description} />
      <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
    </>
  );
}
