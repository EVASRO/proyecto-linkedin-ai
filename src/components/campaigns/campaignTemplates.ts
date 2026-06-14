import type { Template } from "./types";

const EDGE_STYLE = { stroke: "#6366f1", strokeWidth: 2 };

export const CAMPAIGN_TEMPLATES: Template[] = [
  // ── Template 1: Cold Outreach Clásico ─────────────────────────────────────
  {
    id: "tpl_cold_outreach",
    name: "Cold Outreach Clásico",
    description: "Conexión + nota personalizada → esperar 3 días → mensaje de seguimiento",
    types: ["linkedin", "sales_navigator"],
    nodeCount: 4,
    flowConfig: {
      nodes: [
        {
          id: "start_1",
          type: "start",
          position: { x: 220, y: 40 },
          data: { nodeType: "start", label: "Inicio" },
        },
        {
          id: "n2",
          type: "connect",
          position: { x: 220, y: 180 },
          data: {
            nodeType: "connect",
            label: "Enviar conexión",
            addNote: true,
            connectionNote:
              "Hola {{nombre}}, vi tu perfil y me parece muy interesante tu trayectoria en {{empresa}}. Me gustaría conectar.",
          },
        },
        {
          id: "n3",
          type: "delay",
          position: { x: 220, y: 320 },
          data: { nodeType: "delay", label: "Esperar aceptación", days: 3 },
        },
        {
          id: "n4",
          type: "message",
          position: { x: 220, y: 460 },
          data: {
            nodeType: "message",
            label: "Mensaje de seguimiento",
            bodyA: "Hola {{nombre}}, gracias por aceptar mi conexión. ¿Tendrías 15 min para una llamada esta semana?",
          },
        },
      ],
      edges: [
        { id: "e1-2", source: "start_1", target: "n2", animated: true, style: EDGE_STYLE },
        { id: "e2-3", source: "n2",      target: "n3", animated: true, style: EDGE_STYLE },
        { id: "e3-4", source: "n3",      target: "n4", animated: true, style: EDGE_STYLE },
      ],
    },
  },

  // ── Template 2: Follow-up Agresivo ────────────────────────────────────────
  {
    id: "tpl_followup_agresivo",
    name: "Follow-up Agresivo",
    description: "Conexión → mensaje día 2 → seguimiento día 5 → break-up day 10",
    types: ["linkedin", "sales_navigator"],
    nodeCount: 6,
    flowConfig: {
      nodes: [
        {
          id: "start_1",
          type: "start",
          position: { x: 220, y: 40 },
          data: { nodeType: "start", label: "Inicio" },
        },
        {
          id: "n2",
          type: "connect",
          position: { x: 220, y: 180 },
          data: { nodeType: "connect", label: "Enviar conexión", addNote: false },
        },
        {
          id: "n3",
          type: "delay",
          position: { x: 220, y: 320 },
          data: { nodeType: "delay", label: "Esperar 2 días", days: 2 },
        },
        {
          id: "n4",
          type: "message",
          position: { x: 220, y: 460 },
          data: {
            nodeType: "message",
            label: "Primer mensaje",
            bodyA: "Hola {{nombre}}, ¿pudiste ver mi perfil? Me gustaría compartirte algo que podría interesarte.",
          },
        },
        {
          id: "n5",
          type: "delay",
          position: { x: 220, y: 600 },
          data: { nodeType: "delay", label: "Esperar 3 días", days: 3 },
        },
        {
          id: "n6",
          type: "message",
          position: { x: 220, y: 740 },
          data: {
            nodeType: "message",
            label: "Break-up message",
            bodyA: "{{nombre}}, último intento — ¿tienes 10 min esta semana para una llamada rápida?",
          },
        },
      ],
      edges: [
        { id: "e1-2", source: "start_1", target: "n2", animated: true, style: EDGE_STYLE },
        { id: "e2-3", source: "n2",      target: "n3", animated: true, style: EDGE_STYLE },
        { id: "e3-4", source: "n3",      target: "n4", animated: true, style: EDGE_STYLE },
        { id: "e4-5", source: "n4",      target: "n5", animated: true, style: EDGE_STYLE },
        { id: "e5-6", source: "n5",      target: "n6", animated: true, style: EDGE_STYLE },
      ],
    },
  },

  // ── Template 3: Secuencia con Condición ───────────────────────────────────
  {
    id: "tpl_con_condicion",
    name: "Secuencia con Condición",
    description: "Conexión → si acepta enviar mensaje personalizado, si no → retirar",
    types: ["linkedin", "sales_navigator"],
    nodeCount: 6,
    flowConfig: {
      nodes: [
        {
          id: "start_1",
          type: "start",
          position: { x: 220, y: 40 },
          data: { nodeType: "start", label: "Inicio" },
        },
        {
          id: "n2",
          type: "connect",
          position: { x: 220, y: 180 },
          data: {
            nodeType: "connect",
            label: "Enviar conexión",
            addNote: true,
            connectionNote:
              "Hola {{nombre}}, trabajo con empresas como {{empresa}} para mejorar su prospección B2B.",
          },
        },
        {
          id: "n3",
          type: "delay",
          position: { x: 220, y: 320 },
          data: { nodeType: "delay", label: "Esperar 4 días", days: 4 },
        },
        {
          id: "n4",
          type: "condition",
          position: { x: 220, y: 460 },
          data: {
            nodeType: "condition",
            label: "¿Aceptó la conexión?",
            conditionType: "conexion_aceptada",
          },
        },
        {
          id: "n5",
          type: "message",
          position: { x: 80, y: 600 },
          data: {
            nodeType: "message",
            label: "Mensaje personalizado",
            bodyA: "Hola {{nombre}}, gracias por conectar. ¿Tienes 15 min para una llamada esta semana?",
            abVariant: "A",
          },
        },
        {
          id: "n6",
          type: "end",
          position: { x: 360, y: 600 },
          data: { nodeType: "end", label: "Fin — No aceptó" },
        },
      ],
      edges: [
        { id: "e1-2", source: "start_1", target: "n2", animated: true, style: EDGE_STYLE },
        { id: "e2-3", source: "n2",      target: "n3", animated: true, style: EDGE_STYLE },
        { id: "e3-4", source: "n3",      target: "n4", animated: true, style: EDGE_STYLE },
        {
          id: "e4-5",
          source: "n4",
          target: "n5",
          sourceHandle: "yes",
          animated: true,
          label: "✓ Sí",
          style: EDGE_STYLE,
        },
        {
          id: "e4-6",
          source: "n4",
          target: "n6",
          sourceHandle: "no",
          animated: true,
          label: "✗ No",
          style: EDGE_STYLE,
        },
      ],
    },
  },

  // ── Template 4: Autopilot IA ──────────────────────────────────────────────
  {
    id: "tpl_autopilot",
    name: "Autopilot IA",
    description: "Conexión → mensaje inicial → Agente IA toma el control de la conversación",
    types: ["linkedin", "sales_navigator"],
    nodeCount: 5,
    flowConfig: {
      nodes: [
        {
          id: "start_1",
          type: "start",
          position: { x: 220, y: 40 },
          data: { nodeType: "start", label: "Inicio" },
        },
        {
          id: "n2",
          type: "connect",
          position: { x: 220, y: 180 },
          data: { nodeType: "connect", label: "Enviar conexión", addNote: false },
        },
        {
          id: "n3",
          type: "delay",
          position: { x: 220, y: 320 },
          data: { nodeType: "delay", label: "Esperar 1 día", days: 1 },
        },
        {
          id: "n4",
          type: "message",
          position: { x: 220, y: 460 },
          data: {
            nodeType: "message",
            label: "Mensaje inicial",
            bodyA: "Hola {{nombre}}, ¿tienes un momento para explorar cómo podríamos colaborar?",
          },
        },
        {
          id: "n5",
          type: "autopilot",
          position: { x: 220, y: 600 },
          data: {
            nodeType: "autopilot",
            label: "Agente IA",
            autopilotEnabled: true,
            autopilotStyle: "professional",
            autopilotObjective: "Agendar una llamada de 15 minutos",
            autopilotMaxTurns: 5,
          },
        },
      ],
      edges: [
        { id: "e1-2", source: "start_1", target: "n2", animated: true, style: EDGE_STYLE },
        { id: "e2-3", source: "n2",      target: "n3", animated: true, style: EDGE_STYLE },
        { id: "e3-4", source: "n3",      target: "n4", animated: true, style: EDGE_STYLE },
        { id: "e4-5", source: "n4",      target: "n5", animated: true, style: EDGE_STYLE },
      ],
    },
  },

  // ── Template 5: Email + LinkedIn Omnicanal ────────────────────────────────
  {
    id: "tpl_omnicanal",
    name: "Email + LinkedIn Omnicanal",
    description: "Email de presentación → seguimiento LinkedIn → cierre por email",
    types: ["email"],
    nodeCount: 5,
    flowConfig: {
      nodes: [
        {
          id: "start_1",
          type: "start",
          position: { x: 220, y: 40 },
          data: { nodeType: "start", label: "Inicio" },
        },
        {
          id: "n2",
          type: "email",
          position: { x: 220, y: 180 },
          data: {
            nodeType: "email",
            label: "Email de presentación",
            subject: "¿Podemos hablar 15 min, {{nombre}}?",
            bodyA: "Hola {{nombre}}, te escribo porque creo que podemos ayudar a {{empresa}}...",
          },
        },
        {
          id: "n3",
          type: "delay",
          position: { x: 220, y: 320 },
          data: { nodeType: "delay", label: "Esperar 3 días", days: 3 },
        },
        {
          id: "n4",
          type: "connect",
          position: { x: 220, y: 460 },
          data: {
            nodeType: "connect",
            label: "Conectar en LinkedIn",
            addNote: true,
            connectionNote:
              "Hola {{nombre}}, te envié un email hace unos días. Me gustaría conectar también aquí.",
          },
        },
        {
          id: "n5",
          type: "delay",
          position: { x: 220, y: 600 },
          data: { nodeType: "delay", label: "Esperar 2 días", days: 2 },
        },
      ],
      edges: [
        { id: "e1-2", source: "start_1", target: "n2", animated: true, style: EDGE_STYLE },
        { id: "e2-3", source: "n2",      target: "n3", animated: true, style: EDGE_STYLE },
        { id: "e3-4", source: "n3",      target: "n4", animated: true, style: EDGE_STYLE },
        { id: "e4-5", source: "n4",      target: "n5", animated: true, style: EDGE_STYLE },
      ],
    },
  },
];
