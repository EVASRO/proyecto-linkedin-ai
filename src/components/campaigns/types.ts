// ── Campaign Hierarchy ────────────────────────────────────────────────────────

export type CampaignType   = "linkedin" | "sales_navigator" | "email";
export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "archived";
export type SegmentSource  = "crm" | "external_link";

export type Campaign = {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  createdAt: string;
  segmentCount: number;
  totalLeads: number;
  leadsTotal?: number;
  leadsQueued?: number;
  workflow_json?: Record<string, unknown>;
};

export type WizardData = {
  campaignType: CampaignType | null;
  campaignName: string;
  segmentationUrl: string;
  crmSegment: string | null;
  segmentName: string;
  automationName: string;
  selectedTemplateId: string | null;
  estimatedLeads: number;
};

// ── Flow Node System ──────────────────────────────────────────────────────────

export type CampaignNodeType =
  | "start"
  | "connect"
  | "message"
  | "email_node"
  | "wait"
  | "condition"
  | "autopilot"
  | "visit"
  | "like"
  | "end";

export type NodeData = Record<string, unknown> & {
  nodeType: CampaignNodeType;
  label: string;
  // Connect node
  addNote?: boolean;
  useABTest?: boolean;
  messageA?: string;
  messageB?: string;
  // Message / Email node
  subject?: string;
  bodyA?: string;
  bodyB?: string;
  // Wait node
  days?: number;
  // Condition node
  conditionType?: "accepted_connection" | "replied" | "no_response";
  waitDays?: number;
};

// Using a plain shape avoids circular import issues with @xyflow/react generics
export type FlowNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: NodeData;
  [key: string]: unknown;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  animated?: boolean;
  label?: string;
  style?: Record<string, unknown>;
  [key: string]: unknown;
};

export type FlowConfig = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

// ── Segment ───────────────────────────────────────────────────────────────────

export type SegmentStatus = "active" | "paused" | "closed" | "completed" | "draft";

export type SegmentMetrics = {
  totalLeads:  number;
  contacted:   number;
  connected:   number;
  replied:     number;
  meetings:    number;
  duplicates:  number;
  bounced:     number;
};

export type Segment = {
  id: string;
  campaignId: string;
  name: string;
  searchUrl?: string;
  source: SegmentSource;
  status: SegmentStatus;
  metrics: SegmentMetrics;
  automationId: string;
  automationName: string;
  createdAt: string;
};

// ── Autopilot Config ──────────────────────────────────────────────────────────

export type AutopilotStyle = "professional" | "friendly" | "direct";

export type AutopilotConfig = {
  enabled: boolean;
  style: AutopilotStyle;
  maxTurns: number;
  calendarUrl: string;
  workHoursStart: number; // 0-23
  workHoursEnd: number;
  workDays: number[]; // 0=Sun … 6=Sat
  objective: string;
};

// ── Templates ─────────────────────────────────────────────────────────────────

export type Template = {
  id: string;
  name: string;
  description: string;
  types: CampaignType[];
  nodeCount: number;
  flowConfig: FlowConfig;
};
