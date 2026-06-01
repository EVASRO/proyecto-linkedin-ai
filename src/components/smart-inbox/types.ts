export type MessageSender = "user" | "lead" | "ai";
export type InboxSource   = "linkedin" | "email";
export type ConvStatus    = "new" | "active" | "ai_handling" | "human" | "archived";
export type PipelineStage =
  | "leads_entrantes" | "en_contacto" | "demo_agendada"
  | "propuesta" | "cerrado" | "perdido";

export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export type Message = {
  id: string;
  text: string;
  sender: MessageSender;
  timestamp: string; // ISO
  read: boolean;
  status?: MessageStatus;   // only for user/ai outbound messages
};

export type QuickReplyTemplate = {
  id: string;
  label: string;
  text: string;
  category: "seguimiento" | "calificacion" | "propuesta" | "cierre" | "general";
};

export type AISuggestion = {
  id: string;
  text: string;
  intent: "follow_up" | "qualify" | "schedule" | "value_prop" | "close";
};

export type InboxLead = {
  id: string;
  name: string;
  company: string;
  title: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  source: InboxSource;
  pipeline: PipelineStage;
  tags: { label: string; color: string }[];
  value: number;
  notes: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  lead: InboxLead;
  status: ConvStatus;
  autopilotActive: boolean;
  unreadCount: number;
  messages: Message[];
  aiSuggestions: AISuggestion[];
  assignedTo?: string;      // member id
  resolvedAt?: string;      // ISO — set when archived
};
