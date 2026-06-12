// -- Campaign Hierarchy --------------------------------------------------------

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

// -- Flow Node Types -----------------------------------------------------------

export type NodeType =
  | "start"
  | "connect"
  | "message"
  | "delay"
  | "condition"
  | "email"
  | "end"
  // legacy / extended
  | "email_node"
  | "wait"
  | "autopilot"
  | "visit"
  | "like"
  // new
  | "withdraw"
  | "find_email"
  | "find_phone"
  | "connect_email";

/** @deprecated Use NodeType */
export type CampaignNodeType = NodeType;

export type ConditionKind = "conexion_aceptada" | "respondio" | "no_respondio";
export type DelayUnit     = "dias" | "horas";
export type AutopilotStyle = "professional" | "friendly" | "direct";

export type NodeData = {
  nodeType: NodeType;
  label: string;
  // connect
  addNote?: boolean;
  connectionNote?: string;        // primary note field
  messageA?: string;              // legacy / A/B variant A
  messageB?: string;              // A/B variant B
  useABTest?: boolean;
  abNoteMode?: "note_vs_note" | "note_vs_no_note";
  // message
  bodyA?: string;
  bodyB?: string;
  // delay / wait
  days?: number;
  delayUnit?: DelayUnit;
  // condition
  conditionType?: ConditionKind | "accepted_connection" | "replied" | "no_response";
  waitDays?: number;
  // email
  subject?: string;
  // autopilot
  autopilotEnabled?: boolean;
  autopilotStyle?: string;
  autopilotMaxTurns?: number;
  autopilotCalendar?: string;
  autopilotObjective?: string;
  // AB variant badge
  abVariant?: "A" | "B";
  // arbitrary extra keys from legacy data
  [key: string]: unknown;
};

// -- React Flow node/edge shapes (avoids circular imports with @xyflow/react) -

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

// -- A/B Test ------------------------------------------------------------------

export type ABVariant = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  splitPercent: number; // 0-100
};

// -- Workflow JSON (persisted to Supabase) -------------------------------------

export type WorkflowJSON = {
  version: "2.0";
  nodes: FlowNode[];
  edges: FlowEdge[];
  ab_enabled: boolean;
  variant_a: ABVariant;
  variant_b: ABVariant;
  updated_at: string;
  segments?: unknown[];
  [key: string]: unknown;
};

// -- PropertyPanel -------------------------------------------------------------

export type PropertyPanelProps = {
  node: FlowNode;
  onUpdate: (id: string, data: Partial<NodeData>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

// -- Segment -------------------------------------------------------------------

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

// -- Templates -----------------------------------------------------------------

export type Template = {
  id: string;
  name: string;
  description: string;
  types: CampaignType[];
  nodeCount: number;
  flowConfig: FlowConfig;
};
