# NEXUSAI — PRD & ARQUITECTURA TÉCNICA
## Versión 3.0 · Actualizado: 2026-05-30

---

## 1. RESUMEN EJECUTIVO

NexusAI es una plataforma SaaS B2B "Todo en Uno" para automatización de prospección comercial. Combina una **Extensión de Chrome** (Ghost Engine local), un **Dashboard Web** (Next.js), un **Backend IA** (FastAPI + Claude) y una integración **Inbound** de contenido LinkedIn.

**Estado actual:** V2 en desarrollo activo — extensión operativa, dashboard funcional con 10 módulos, backend con 15 endpoints, base de datos V3 con 20 tablas.

---

## 2. PRICING

| Característica | GROWTH ($49/mes) | PRO ($129/mes) | ENTERPRISE (consultar) |
|:---|:---|:---|:---|
| Cuentas LinkedIn | 1 | 3 | Ilimitadas |
| Ejecución | Extensión Chrome | Nube 24/7 | Nube 24/7 + Proxies VIP |
| Campañas | LinkedIn solo | Omnicanal (LinkedIn + Email) | Omnicanal + A/B Testing |
| IA | Copiloto (sugerencias) | Autopilot (autónomo) | Autopilot + Prompts equipo |
| CRM | Etapas fijas | Personalizable | Multi-pipeline |
| Equipo | Solo | Solo | Multi-SDR / Delegado |

---

## 3. ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NEXUSAI — ARQUITECTURA V3                          │
└─────────────────────────────────────────────────────────────────────────────┘

  USUARIO / NAVEGADOR
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                                                                          │
  │  ┌─────────────────────────────────┐   ┌──────────────────────────────┐ │
  │  │    DASHBOARD WEB (Next.js 15)   │   │  EXTENSIÓN CHROME (MV3)      │ │
  │  │    localhost:3000               │   │                              │ │
  │  │                                 │   │  ┌────────────────────────┐  │ │
  │  │  /dashboard                     │   │  │ background.js          │  │ │
  │  │  ├── /agentes-ia  (Wizard IA)   │   │  │ (Service Worker)       │  │ │
  │  │  ├── /analytics   (KPIs+Funnel) │   │  │ · Task Queue           │  │ │
  │  │  ├── /campanas    (FlowBuilder) │◄──┼──│ · Delays humanos       │  │ │
  │  │  ├── /crm         (Kanban)      │   │  │ · Límites diarios      │  │ │
  │  │  ├── /smart-inbox (Chat+IA)     │   │  │ · broadcastStatus()    │  │ │
  │  │  ├── /inbound     (Contenido)   │   │  │   → POST /engine/sync  │  │ │
  │  │  ├── /equipo                    │   │  └────────────┬───────────┘  │ │
  │  │  ├── /perfil                    │   │               │              │ │
  │  │  └── /configuracion (OAuth)     │   │  ┌────────────▼───────────┐  │ │
  │  │                                 │   │  │ content.js             │  │ │
  │  │  Auth: Supabase Auth            │   │  │ (DOM Injected)         │  │ │
  │  │  Session: NextAuth JWT          │   │  │ · extract_profile      │  │ │
  │  └──────────┬──────────────────────┘   │  │ · send_connection      │  │ │
  │             │                          │  │ · send_message         │  │ │
  │             │ fetch()                  │  │ · like_post            │  │ │
  │             │ polling 4s               │  │ · visit_profile        │  │ │
  └─────────────┼──────────────────────────┘  └────────────────────────┘  │ │
                │                          └──────────────────────────────┘ │
                │                                       │ sendMessage API    │
  ──────────────┼───────────────────────────────────────┼────────────────────┘
                │                                       │
                ▼                                       ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │                    BACKEND (FastAPI · Python 3.11)                   │
  │                    localhost:8000                                    │
  │                                                                      │
  │  ENDPOINTS IA:                    ENDPOINTS DATOS:                  │
  │  POST /api/generate-message       GET  /api/leads                   │
  │  POST /api/ai/suggest             POST /api/leads                   │
  │  POST /api/agents/test-chat       PATCH /api/leads/{id}             │
  │                                   GET  /api/campaigns               │
  │  ENDPOINTS MOTOR:                 POST /api/campaigns               │
  │  GET  /api/engine/status ◄──────  PATCH /api/campaigns/{id}         │
  │  POST /api/engine/start           POST /api/activity                │
  │  POST /api/engine/stop            POST /api/scrape-url              │
  │  POST /api/engine/sync ◄────────  POST /api/scrape-profile          │
  │  (extensión Chrome envía aquí)    GET  /api/health                  │
  │                                                                      │
  │  ┌──────────────────────┐   ┌──────────────────────────────────┐   │
  │  │   Claude Sonnet 4.6  │   │   Playwright (Scraping)          │   │
  │  │   (Anthropic API)    │   │   BeautifulSoup (Parsing)        │   │
  │  └──────────────────────┘   └──────────────────────────────────┘   │
  └──────────────────────────────────────┬──────────────────────────────┘
                                         │ supabase-py SDK
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │                    SUPABASE (PostgreSQL + Auth + RLS)                │
  │                    qamqcygybwrlbsylkxyo.supabase.co                 │
  │                                                                      │
  │  CORE:         workspaces, profiles                                  │
  │  LINKEDIN:     linkedin_accounts (cookie + OAuth fields)             │
  │  CAMPAÑAS:     campaigns (workflow_json JSONB)                       │
  │  CRM:          leads, crm_columns, crm_automations                   │
  │  INBOX:        messages, conversations, lead_notes                   │
  │  AGENTES IA:   agents, quick_reply_templates                         │
  │  INBOUND:      inbound_posts              ← NUEVO V3.0               │
  │  EMAIL:        email_connections          ← NUEVO V3.0               │
  │  GHOST ENGINE: ghost_engine_sessions      ← NUEVO V3.0               │
  │  CONFIG:       workspace_settings, webhooks                          │
  │  EQUIPO:       team_invitations                                      │
  │  LOG:          activity_log                                          │
  │                                          Total: 20 tablas, RLS 100%  │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## 4. FLUJO DE DATOS — GHOST ENGINE

```
LinkedIn.com ──► content.js (extrae perfil)
                     │
                     ▼
              background.js (Task Queue)
                     │
         ┌───────────┴──────────────┐
         │ Cada acción:             │
         │ 1. Delay aleatorio       │
         │    (3-8 min)             │
         │ 2. Ejecutar vía          │
         │    sendMessage→content.js│
         │ 3. Loguear resultado     │
         │ 4. broadcastStatus()     │
         │    → POST /engine/sync   │
         └───────────┬──────────────┘
                     │
                     ▼
         Dashboard (polling 4s)
         GET /api/engine/status
                     │
                     ▼
         GhostEnginePanel (React)
         muestra estado en tiempo real
```

---

## 5. FLUJO — CREACIÓN DE LEAD DESDE LINKEDIN URL

```
Usuario pega URL linkedin.com/in/xxx
         │
         ▼
CreateLeadModal → POST /api/scrape-profile
         │           (Playwright + cookie li_at)
         │
         ▼
Perfil extraído: name, company, headline
         │
         ▼
Auto-rellena formulario del modal
         │
Usuario ajusta y guarda
         │
         ▼
Lead aparece en Kanban CRM
```

---

## 6. FLUJO — INBOUND CONTENT

```
Usuario configura:
 · Tipo (post/artículo/carrusel)
 · Tono
 · Tema principal
         │
         ▼
POST /api/agents/test-chat (Claude)
         │
         ▼
Contenido generado → textarea editable
         │
  ┌──────┴──────┐
  │             │
  ▼             ▼
Borrador    Programar fecha
(localStorage)    │
             ▼
         Calendario
         (inbound_posts en Supabase)
         │
         ▼ (futuro con LinkedIn API)
         Publicar automáticamente
```

---

## 7. MÓDULOS — ESTADO ACTUAL

| Módulo | Ruta | Estado | Backend | Notas |
|--------|------|--------|---------|-------|
| Dashboard | `/dashboard` | ✅ Funcional | `/api/engine/status` (polling) | Ghost Engine conectado |
| Agentes IA | `/dashboard/agentes-ia` | ✅ Funcional | `/api/agents/test-chat` | Test chat con Claude real |
| Analytics | `/dashboard/analytics` | ✅ Funcional | Mock data | Filtros de tiempo funcionales, resolver conflictos |
| Campañas | `/dashboard/campanas` | ✅ Funcional | `/api/campaigns` | FlowBuilder persiste en localStorage |
| CRM | `/dashboard/crm` | ✅ Funcional | `/api/leads` | Nuevo lead desde URL LinkedIn |
| Smart Inbox | `/dashboard/smart-inbox` | ✅ Funcional | `/api/ai/suggest` | Copiloto IA operativo |
| Inbound | `/dashboard/inbound` | ✅ Funcional | `/api/agents/test-chat` | Generador IA + calendario |
| Configuración | `/dashboard/configuracion` | ✅ Funcional | — | Panel OAuth LinkedIn + Gmail + SMTP |
| Equipo | `/dashboard/equipo` | ✅ Funcional | — | UI completa |
| Perfil | `/dashboard/perfil` | ✅ Funcional | — | UI completa |
| Extensión Chrome | — | ✅ Funcional | `/api/engine/sync` | Sincroniza estado al dashboard |

---

## 8. STACK TÉCNICO

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | Next.js (App Router) | 15.x |
| Lenguaje FE | TypeScript | 5.x |
| Estilos | TailwindCSS | 4.x |
| Flow Builder | @xyflow/react | latest |
| Auth | Supabase Auth + NextAuth | — |
| Backend | FastAPI + Uvicorn | 0.128 / 0.39 |
| Lenguaje BE | Python | 3.11 |
| IA | Anthropic Claude Sonnet 4.6 | claude-sonnet-4-6 |
| Scraping | Playwright + playwright-stealth | 1.60 |
| Base de datos | Supabase (PostgreSQL) | — |
| Extensión | Chrome MV3 (Manifest V3) | — |

---

## 9. ESTRUCTURA DE DIRECTORIOS

```
proyecto-linkedin-ai/
│
├── backend/
│   ├── main.py                    # 15 endpoints FastAPI
│   ├── requirements.txt
│   ├── .env                       # ANTHROPIC_API_KEY, SUPABASE_*
│   └── venv/
│
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── page.tsx           # Dashboard principal
│   │   │   ├── agentes-ia/        # Wizard + test chat Claude
│   │   │   ├── analytics/         # KPIs, funnel, health check
│   │   │   ├── campanas/          # FlowBuilder (React Flow)
│   │   │   ├── configuracion/     # OAuth LinkedIn + Gmail + SMTP
│   │   │   ├── crm/               # Kanban + nuevo lead desde URL
│   │   │   ├── equipo/
│   │   │   ├── inbound/           # Creador contenido IA + calendario
│   │   │   ├── perfil/
│   │   │   └── smart-inbox/       # Copiloto IA
│   │   ├── api/auth/              # NextAuth handlers
│   │   ├── login/
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── agentes-ia/            # AgentesView.tsx
│   │   ├── analytics/             # AnalyticsView.tsx
│   │   ├── campaigns/             # CampaignWizard, FlowBuilder, CustomNodes...
│   │   ├── configuracion/         # ConfiguracionView.tsx
│   │   ├── crm/                   # CrmView, Board, LeadCard, CreateLeadModal...
│   │   ├── dashboard/             # DashboardView, GhostEnginePanel (polling)
│   │   ├── equipo/
│   │   ├── layout/
│   │   │   └── inbound/           # InboundView.tsx (generador + calendario)
│   │   ├── perfil/
│   │   ├── smart-inbox/           # InboxLayout, ChatView, ConversationList...
│   │   ├── auth/                  # login-form, sign-out-button
│   │   └── providers/
│   │
│   ├── lib/
│   │   ├── supabase/              # Cliente Supabase SSR
│   │   └── users.ts               # validateDemoUser (bcrypt)
│   │
│   ├── auth.ts                    # NextAuth config (Credentials + Google)
│   └── middleware.ts              # Protección rutas /dashboard
│
├── extension-chrome/
│   ├── manifest.json              # MV3, permisos linkedin.com
│   ├── background.js              # Ghost Engine: Task Queue + broadcastStatus→sync
│   ├── content.js                 # DOM: extract_profile, send_connection, etc.
│   ├── popup.html / popup.js      # UI popup: Estado, Cola, LinkedIn, Ajustes
│   └── icons/
│
├── supabase/
│   ├── schema_v2.sql              # Schema anterior (referencia)
│   └── schema_v3.sql              # Schema actual V3.0 (20 tablas)
│
├── .env                           # Variables de entorno frontend
├── .env.local                     # Supabase keys + Auth secrets
├── CLAUDE.md → AGENTS.md
└── PRD_ARQUITECTURA_NEXUSAI.md    # Este archivo
```

---

## 10. BASE DE DATOS — RESUMEN V3.0

| Grupo | Tablas | Notas |
|-------|--------|-------|
| Core | `workspaces`, `profiles` | Auto-creados en registro |
| LinkedIn | `linkedin_accounts` | Campos OAuth añadidos V3.0 |
| Campañas | `campaigns` | Campo `type` añadido V3.0 |
| CRM | `leads`, `crm_columns`, `crm_automations` | |
| Inbox | `messages`, `conversations`, `lead_notes`, `quick_reply_templates` | |
| Agentes | `agents` | |
| Inbound | `inbound_posts` | **NUEVO V3.0** |
| Email | `email_connections` | **NUEVO V3.0** |
| Ghost Engine | `ghost_engine_sessions` | **NUEVO V3.0** |
| Config | `workspace_settings`, `webhooks` | |
| Equipo | `team_invitations` | |
| Log | `activity_log` | |

**Total: 20 tablas · RLS habilitado: 100% · Trigger auto-setup: ✅**

---

## 11. PENDIENTE / ROADMAP

| Ítem | Prioridad | Bloqueo |
|------|-----------|---------|
| LinkedIn OAuth API (publicar Inbound) | Alta | Aprobación app LinkedIn developer |
| Gmail OAuth (email marketing real) | Alta | Google Cloud Console config |
| Ghost Engine → Cloud 24/7 (Playwright + Proxy) | Alta | Plan PRO |
| WebSockets (estado engine en tiempo real) | Media | — |
| CRM / Smart Inbox → backend real (Supabase) | Media | — |
| A/B Testing en campañas | Media | — |
| Multi-workspace / Equipo multi-SDR | Baja | Plan Enterprise |
| Analytics → datos reales de Supabase | Baja | — |

---

## 12. VARIABLES DE ENTORNO REQUERIDAS

### Frontend (`.env` / `.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=http://localhost:3000
DEMO_USER_EMAIL=demo@nexusai.app
DEMO_USER_PASSWORD=demo1234
# Opcional — Google OAuth
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
```

### Backend (`backend/.env`)
```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxx
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
```

---

## 13. INSTRUCCIONES — APLICAR SCHEMA V3 EN SUPABASE

### Instalación nueva (sin datos previos)
```
1. Abre Supabase → tu proyecto → SQL Editor
2. Clic en "New query"
3. Pega TODO el contenido de supabase/schema_v3.sql
4. Clic en "Run" (▶)
5. Verifica en Table Editor que aparecen 20 tablas
```

### Migración desde V2.1 (ya tienes datos)
```
1. Abre Supabase → SQL Editor → New query
2. Ejecuta SOLO el bloque comentado al final de schema_v3.sql:
   "MIGRACIONES INCREMENTALES V2.1 → V3.0"
   (Son ALTER TABLE y CREATE TABLE seguros con IF NOT EXISTS)
3. Verifica que no hay errores
4. Las tablas nuevas serán: inbound_posts, email_connections, ghost_engine_sessions
5. Las columnas nuevas en linkedin_accounts: oauth_client_id, oauth_access_token, etc.
6. Las columnas nuevas en campaigns: type varchar(50)
7. Las columnas nuevas en workspace_settings: default_email_connection_id
```

### Verificación post-migración
```sql
-- Ejecuta esto para confirmar las 20 tablas:
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;

-- Confirmar RLS activo en todas:
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
order by tablename;
```
