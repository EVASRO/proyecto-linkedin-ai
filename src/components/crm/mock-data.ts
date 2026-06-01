import type { CrmLead, Column, AutomationTrigger } from "./types";

export const INITIAL_COLUMNS: Column[] = [
  { id: "leads_entrantes", title: "LEADS ENTRANTES",   color: "blue"   },
  { id: "en_contacto",     title: "EN CONTACTO",       color: "sky"    },
  { id: "demo_agendada",   title: "DEMO AGENDADA",     color: "violet" },
  { id: "propuesta",       title: "PROPUESTA ENVIADA", color: "amber"  },
  { id: "cerrado",         title: "CERRADO / GANADO",  color: "green"  },
  { id: "perdido",         title: "PERDIDO",           color: "red"    },
];

export const MOCK_LEADS: CrmLead[] = [
  {
    id: "274",
    name: "Carlos Mendoza",
    company: "TechVision Perú",
    value: 8500,
    source: "LinkedIn",
    tags: [
      { label: "IQL - Interesado", color: "blue"   },
      { label: "SaaS",             color: "violet" },
    ],
    nextTask: "Llamar mañana 10:00 AM",
    status: "leads_entrantes",
    createdAt: "2026-05-25",
    email: "c.mendoza@techvision.pe",
  },
  {
    id: "275",
    name: "María Santos",
    company: "Grupo Inversión Lima",
    value: 15000,
    source: "Web",
    tags: [
      { label: "SQL - Calificado", color: "green"  },
      { label: "Enterprise",       color: "indigo" },
    ],
    nextTask: "Enviar propuesta técnica",
    status: "en_contacto",
    createdAt: "2026-05-23",
    email: "m.santos@grupoinversion.com",
  },
  {
    id: "276",
    name: "Roberto Díaz",
    company: "Startup Fintech SA",
    value: 22000,
    source: "Referido",
    tags: [
      { label: "SQL - Hot Lead", color: "red" },
      { label: "Fintech",        color: "sky" },
    ],
    nextTask: "Demo el viernes 3:00 PM",
    status: "demo_agendada",
    createdAt: "2026-05-20",
    email: "r.diaz@fintechsa.pe",
    phone: "+51 987 654 321",
  },
  {
    id: "277",
    name: "Ana García",
    company: "Corporación Digital SAC",
    value: 35000,
    source: "Email",
    tags: [
      { label: "Enterprise",     color: "indigo" },
      { label: "CRM + Campañas", color: "violet" },
    ],
    nextTask: null,
    status: "propuesta",
    createdAt: "2026-05-18",
    email: "a.garcia@corpdigital.com",
  },
  {
    id: "278",
    name: "Luis Torres",
    company: "LogiTech Distribución",
    value: 6200,
    source: "LinkedIn",
    tags: [{ label: "IQL - Frío", color: "gray" }],
    nextTask: "Seguimiento en 1 semana",
    status: "leads_entrantes",
    createdAt: "2026-05-27",
    phone: "+51 999 123 456",
  },
];

export const MOCK_AUTOMATIONS: AutomationTrigger[] = [
  {
    id: "a1",
    columnId: "leads_entrantes",
    triggerLabel: "Cuando se crea un lead en esta etapa",
    actionLabel: "Enviar email de bienvenida automático",
  },
  {
    id: "a2",
    columnId: "en_contacto",
    triggerLabel: "Cuando pasan 48 horas sin actividad",
    actionLabel: "Notificar al SDR asignado por Slack",
  },
  {
    id: "a3",
    columnId: "demo_agendada",
    triggerLabel: "Cuando se mueve a esta etapa",
    actionLabel: "Crear evento en Google Calendar",
  },
  {
    id: "a4",
    columnId: "propuesta",
    triggerLabel: "Cuando se mueve a esta etapa",
    actionLabel: "Generar propuesta PDF con Claude IA",
  },
  {
    id: "a5",
    columnId: "cerrado",
    triggerLabel: "Cuando se marca como ganado",
    actionLabel: "Notificar a Slack #ventas-won",
  },
];
