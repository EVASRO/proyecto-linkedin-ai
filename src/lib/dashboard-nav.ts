import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  Columns3,
  Inbox,
  LayoutDashboard,
  Megaphone,
  PenLine,
  Settings,
  Users,
} from "lucide-react";

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  section?: "main" | "account";
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Inicio y métricas generales",
    section: "main",
  },
  {
    label: "Analítica",
    href: "/dashboard/analytics",
    icon: BarChart3,
    description: "KPIs, embudo de conversión y rendimiento",
    section: "main",
  },
  {
    label: "Campañas",
    href: "/dashboard/campanas",
    icon: Megaphone,
    description: "Secuencias de prospección B2B",
    section: "main",
  },
  {
    label: "Smart Inbox",
    href: "/dashboard/smart-inbox",
    icon: Inbox,
    description: "Bandeja unificada LinkedIn + Email",
    section: "main",
  },
  {
    label: "CRM (Pipeline)",
    href: "/dashboard/crm",
    icon: Columns3,
    description: "Pipeline de contactos y leads",
    section: "main",
  },
  {
    label: "Inbound",
    href: "/dashboard/inbound",
    icon: PenLine,
    description: "Generación y programación de contenido",
    section: "main",
  },
  {
    label: "Agentes IA",
    href: "/dashboard/agentes-ia",
    icon: Bot,
    description: "Knowledge base y configuración de agentes",
    section: "main",
  },
  {
    label: "Equipo",
    href: "/dashboard/equipo",
    icon: Users,
    description: "Asesores, roles y métricas del equipo",
    section: "main",
  },
  {
    label: "Configuración",
    href: "/dashboard/settings",
    icon: Settings,
    description: "Cuenta, workspace, LinkedIn, email y webhooks",
    section: "account",
  },
];
