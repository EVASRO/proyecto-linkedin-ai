export type ColumnColor =
  | "blue" | "sky" | "violet" | "amber" | "green"
  | "red" | "pink" | "orange" | "indigo" | "purple";

export type TagColor =
  | "blue" | "violet" | "green" | "amber" | "red"
  | "pink" | "sky" | "gray" | "indigo";

export type LeadSource = "LinkedIn" | "Web" | "Referido" | "Email" | "Llamada";

export type LeadTag = {
  label: string;
  color: TagColor;
};

export type CrmLead = {
  id: string;
  name: string;
  company: string;
  value: number;
  source: LeadSource;
  tags: LeadTag[];
  nextTask: string | null;
  status: string;
  crmColumn: string | null;
  createdAt: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  assignedTo?: string;
  score?: number;
};

export type Column = {
  id: string;
  title: string;
  color: ColumnColor;
  key?: string;
};

export type AutomationTrigger = {
  id: string;
  columnId: string;
  triggerLabel: string;
  actionLabel: string;
};
