/*
  SQL para ejecutar en Supabase (una sola vez):

  CREATE TABLE nexus_campaigns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE nexus_segments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES nexus_campaigns(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL,
    segmentation_url TEXT,
    crm_filter JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE nexus_automations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    segment_id UUID REFERENCES nexus_segments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    flow_config JSONB NOT NULL DEFAULT '{}',
    is_template BOOLEAN DEFAULT FALSE,
    template_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE nexus_campaigns ENABLE ROW LEVEL SECURITY;
  ALTER TABLE nexus_segments  ENABLE ROW LEVEL SECURITY;
  ALTER TABLE nexus_automations ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "allow_all" ON nexus_campaigns    FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "allow_all" ON nexus_segments     FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "allow_all" ON nexus_automations  FOR ALL USING (true) WITH CHECK (true);
*/

import type { Campaign, Template } from "./types";

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: "c1",
    name: "Directores IT Lima - Q2",
    type: "linkedin",
    status: "active",
    createdAt: "2026-05-20",
    segmentCount: 2,
    totalLeads: 847,
  },
  {
    id: "c2",
    name: "C-Level Fintech LATAM",
    type: "sales_navigator",
    status: "active",
    createdAt: "2026-05-22",
    segmentCount: 1,
    totalLeads: 312,
  },
  {
    id: "c3",
    name: "Newsletter Mayo 2026",
    type: "email",
    status: "draft",
    createdAt: "2026-05-25",
    segmentCount: 1,
    totalLeads: 2104,
  },
  {
    id: "c4",
    name: "Startups SaaS Perú",
    type: "linkedin",
    status: "paused",
    createdAt: "2026-05-10",
    segmentCount: 3,
    totalLeads: 520,
  },
];

import type { Segment } from "./types";

export const MOCK_SEGMENTS: Segment[] = [
  // Campaign c1 — Directores IT Lima Q2
  {
    id: "seg_c1_1",
    campaignId: "c1",
    name: "Directores IT · Lima Metropolitana",
    searchUrl: "https://www.linkedin.com/search/results/people/?keywords=director+IT&geoUrn=...",
    source: "external_link",
    status: "active",
    metrics: { totalLeads: 412, contacted: 310, connected: 187, replied: 42, meetings: 8, duplicates: 5, bounced: 12 },
    automationId: "auto_c1_1",
    automationName: "Secuencia de Conexión 5 pasos",
    createdAt: "2026-05-20",
  },
  {
    id: "seg_c1_2",
    campaignId: "c1",
    name: "CTOs · Empresas 50-200 empleados",
    searchUrl: "https://www.linkedin.com/search/results/people/?keywords=CTO&...",
    source: "external_link",
    status: "paused",
    metrics: { totalLeads: 235, contacted: 91, connected: 44, replied: 9, meetings: 2, duplicates: 3, bounced: 7 },
    automationId: "auto_c1_2",
    automationName: "Nurturing 3-touch",
    createdAt: "2026-05-22",
  },
  // Campaign c2 — C-Level Fintech LATAM
  {
    id: "seg_c2_1",
    campaignId: "c2",
    name: "CFOs · Fintech LATAM",
    searchUrl: "https://www.linkedin.com/sales/search/people?...",
    source: "external_link",
    status: "active",
    metrics: { totalLeads: 312, contacted: 289, connected: 201, replied: 67, meetings: 18, duplicates: 11, bounced: 4 },
    automationId: "auto_c2_1",
    automationName: "C-Level Outreach Premium",
    createdAt: "2026-05-22",
  },
  // Campaign c3 — Newsletter
  {
    id: "seg_c3_1",
    campaignId: "c3",
    name: "Base completa CRM",
    source: "crm",
    status: "draft",
    metrics: { totalLeads: 2104, contacted: 0, connected: 0, replied: 0, meetings: 0, duplicates: 47, bounced: 0 },
    automationId: "auto_c3_1",
    automationName: "Drip Email 3 toques",
    createdAt: "2026-05-25",
  },
  // Campaign c4 — Startups SaaS
  {
    id: "seg_c4_1",
    campaignId: "c4",
    name: "Founders · SaaS B2B",
    source: "external_link",
    status: "paused",
    metrics: { totalLeads: 198, contacted: 132, connected: 78, replied: 15, meetings: 4, duplicates: 6, bounced: 9 },
    automationId: "auto_c4_1",
    automationName: "Conexión + Autopilot",
    createdAt: "2026-05-10",
  },
  {
    id: "seg_c4_2",
    campaignId: "c4",
    name: "Product Managers · Lima",
    source: "external_link",
    status: "closed",
    metrics: { totalLeads: 167, contacted: 167, connected: 103, replied: 31, meetings: 9, duplicates: 2, bounced: 14 },
    automationId: "auto_c4_2",
    automationName: "Secuencia de Conexión 5 pasos",
    createdAt: "2026-05-10",
  },
  {
    id: "seg_c4_3",
    campaignId: "c4",
    name: "Head of Sales · Startups",
    source: "external_link",
    status: "active",
    metrics: { totalLeads: 155, contacted: 88, connected: 51, replied: 11, meetings: 3, duplicates: 4, bounced: 6 },
    automationId: "auto_c4_3",
    automationName: "Nurturing 5-Touchpoints",
    createdAt: "2026-05-15",
  },
];

export const CRM_SEGMENTS = [
  { id: "seg_all",      label: "Todos los leads",       count: 5 },
  { id: "seg_sql",      label: "SQL — Calificados",      count: 2 },
  { id: "seg_iql",      label: "IQL — Interesados",      count: 2 },
  { id: "seg_hot",      label: "Hot Leads",              count: 1 },
  { id: "seg_inactive", label: "Sin actividad 30 días",  count: 3 },
];

// ── Default Templates ─────────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "tpl_connection",
    name: "Secuencia de Conexión",
    description: "Visita → Conexión con nota → Mensaje IA → Seguimiento 5 días",
    types: ["linkedin", "sales_navigator"],
    nodeCount: 5,
    flowConfig: {
      nodes: [
        { id: "s1", type: "start",   position: { x: 240, y: 40  }, data: { nodeType: "start",   label: "Inicio de Secuencia" } },
        { id: "n1", type: "visit",   position: { x: 240, y: 160 }, data: { nodeType: "visit",   label: "Visitar Perfil" } },
        { id: "n2", type: "connect", position: { x: 240, y: 280 }, data: { nodeType: "connect", label: "Enviar Conexión", addNote: true, messageA: "Hola {{nombre}}, vi tu perfil en {{empresa}} y me gustaría conectar.", useABTest: false } },
        { id: "n3", type: "wait",    position: { x: 240, y: 400 }, data: { nodeType: "wait",    label: "Esperar", days: 3 } },
        { id: "n4", type: "message", position: { x: 240, y: 520 }, data: { nodeType: "message", label: "Mensaje IA", bodyA: "Hola {{nombre}}, gracias por conectar. ¿Tienes 15 minutos para hablar sobre cómo NexusAI puede ayudar a {{empresa}}?" } },
      ],
      edges: [
        { id: "e1", source: "s1", target: "n1", animated: true },
        { id: "e2", source: "n1", target: "n2", animated: true },
        { id: "e3", source: "n2", target: "n3", animated: true },
        { id: "e4", source: "n3", target: "n4", animated: true },
      ],
    },
  },
  {
    id: "tpl_nurturing",
    name: "Nurturing 5-Touchpoints",
    description: "Secuencia de 5 mensajes progresivos con esperas inteligentes",
    types: ["linkedin", "sales_navigator"],
    nodeCount: 9,
    flowConfig: {
      nodes: [
        { id: "s1", type: "start",   position: { x: 240, y: 40  }, data: { nodeType: "start",   label: "Inicio" } },
        { id: "n1", type: "connect", position: { x: 240, y: 160 }, data: { nodeType: "connect", label: "Conexión + Nota", addNote: true } },
        { id: "n2", type: "wait",    position: { x: 240, y: 280 }, data: { nodeType: "wait",    label: "Esperar", days: 2 } },
        { id: "n3", type: "message", position: { x: 240, y: 400 }, data: { nodeType: "message", label: "Mensaje 1 — Valor" } },
        { id: "n4", type: "wait",    position: { x: 240, y: 520 }, data: { nodeType: "wait",    label: "Esperar", days: 4 } },
        { id: "n5", type: "message", position: { x: 240, y: 640 }, data: { nodeType: "message", label: "Mensaje 2 — Caso de éxito" } },
        { id: "n6", type: "wait",    position: { x: 240, y: 760 }, data: { nodeType: "wait",    label: "Esperar", days: 5 } },
        { id: "n7", type: "message", position: { x: 240, y: 880 }, data: { nodeType: "message", label: "Mensaje 3 — CTA Demo" } },
        { id: "n8", type: "autopilot", position: { x: 240, y: 1000 }, data: { nodeType: "autopilot", label: "Autopilot IA" } },
      ],
      edges: [
        { id: "e1", source: "s1", target: "n1", animated: true },
        { id: "e2", source: "n1", target: "n2", animated: true },
        { id: "e3", source: "n2", target: "n3", animated: true },
        { id: "e4", source: "n3", target: "n4", animated: true },
        { id: "e5", source: "n4", target: "n5", animated: true },
        { id: "e6", source: "n5", target: "n6", animated: true },
        { id: "e7", source: "n6", target: "n7", animated: true },
        { id: "e8", source: "n7", target: "n8", animated: true },
      ],
    },
  },
  {
    id: "tpl_email_drip",
    name: "Drip Email Campaign",
    description: "Secuencia de 3 emails con condición de apertura",
    types: ["email"],
    nodeCount: 7,
    flowConfig: {
      nodes: [
        { id: "s1", type: "start",      position: { x: 240, y: 40  }, data: { nodeType: "start",      label: "Inicio" } },
        { id: "n1", type: "email_node", position: { x: 240, y: 160 }, data: { nodeType: "email_node", label: "Email 1 — Bienvenida", subject: "Te damos la bienvenida a NexusAI" } },
        { id: "n2", type: "wait",       position: { x: 240, y: 280 }, data: { nodeType: "wait",       label: "Esperar", days: 3 } },
        { id: "n3", type: "condition",  position: { x: 240, y: 400 }, data: { nodeType: "condition",  label: "¿Abrió el email?", conditionType: "replied" } },
        { id: "n4", type: "email_node", position: { x: 80,  y: 540 }, data: { nodeType: "email_node", label: "Email 2 — Caso de éxito" } },
        { id: "n5", type: "email_node", position: { x: 400, y: 540 }, data: { nodeType: "email_node", label: "Email 2 — Recordatorio" } },
        { id: "n6", type: "autopilot",  position: { x: 240, y: 680 }, data: { nodeType: "autopilot",  label: "Autopilot IA" } },
      ],
      edges: [
        { id: "e1", source: "s1", target: "n1", animated: true },
        { id: "e2", source: "n1", target: "n2", animated: true },
        { id: "e3", source: "n2", target: "n3", animated: true },
        { id: "e4", source: "n3", target: "n4", animated: true, sourceHandle: "yes", label: "Sí" },
        { id: "e5", source: "n3", target: "n5", animated: true, sourceHandle: "no",  label: "No" },
        { id: "e6", source: "n4", target: "n6", animated: true },
        { id: "e7", source: "n5", target: "n6", animated: true },
      ],
    },
  },
];
