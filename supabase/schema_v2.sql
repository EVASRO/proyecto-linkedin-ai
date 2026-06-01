-- ============================================================
-- NEXUSAI — SCHEMA COMPLETO V2.1
-- Ejecutar en: Supabase → SQL Editor → New Query
-- Versión: 2026-05-29
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLAS BASE (PRD original)
-- ============================================================

create table if not exists workspaces (
    id           uuid default uuid_generate_v4() primary key,
    name         varchar(255) not null,
    plan_type    varchar(50)  default 'growth',  -- growth | pro | enterprise
    logo_url     text,
    created_at   timestamptz  default now() not null
);

create table if not exists profiles (
    id              uuid references auth.users on delete cascade primary key,
    workspace_id    uuid references workspaces(id) on delete set null,
    full_name       varchar(255),
    email           varchar(255) unique not null,
    role            varchar(50)  default 'vendedor', -- admin | vendedor | observador
    job_title       varchar(255),
    company         varchar(255),
    phone           varchar(50),
    avatar_gradient integer      default 0,
    created_at      timestamptz  default now() not null
);

create table if not exists linkedin_accounts (
    id                      uuid default uuid_generate_v4() primary key,
    workspace_id            uuid references workspaces(id) on delete cascade,
    name                    varchar(255) not null,
    li_at_cookie            text,
    connection_mode         varchar(50)  default 'extension', -- extension | direct
    status                  varchar(50)  default 'connected', -- connected | disconnected | expired
    daily_connection_limit  integer default 30,
    daily_message_limit     integer default 50,
    use_ultra_safe_mode     boolean default true,
    created_at              timestamptz default now() not null
);

create table if not exists campaigns (
    id                  uuid default uuid_generate_v4() primary key,
    workspace_id        uuid references workspaces(id) on delete cascade,
    linkedin_account_id uuid references linkedin_accounts(id) on delete set null,
    name                varchar(255) not null,
    status              varchar(50)  default 'draft', -- draft | active | paused | completed
    workflow_json       jsonb        not null default '{}',
    total_leads         integer      default 0,
    segment_count       integer      default 1,
    created_at          timestamptz  default now() not null
);

create table if not exists leads (
    id            uuid default uuid_generate_v4() primary key,
    campaign_id   uuid references campaigns(id) on delete cascade,
    workspace_id  uuid references workspaces(id) on delete cascade,
    assigned_to   uuid references profiles(id) on delete set null,
    linkedin_id   varchar(255),
    linkedin_url  text,
    full_name     varchar(255) not null,
    headline      text,
    email         varchar(255),
    phone         varchar(50),
    company       varchar(255),
    ai_summary    text,
    status        varchar(50)  default 'nuevo', -- nuevo | contactado | respondio | demo | cerrado | perdido
    value         integer      default 0,
    score         integer      default 0,       -- 0-100 lead score
    custom_tags   text[]       default '{}',
    next_task     text,
    created_at    timestamptz  default now() not null
);

create table if not exists messages (
    id           uuid default uuid_generate_v4() primary key,
    lead_id      uuid references leads(id) on delete cascade,
    sender       varchar(50)  not null, -- user | ai | prospect
    message_text text         not null,
    is_read      boolean      default false,
    status       varchar(50)  default 'sent', -- sending | sent | delivered | read
    timestamp    timestamptz  default now() not null
);

-- ============================================================
-- MÓDULO AGENTES IA
-- ============================================================

create table if not exists agents (
    id                uuid default uuid_generate_v4() primary key,
    workspace_id      uuid references workspaces(id) on delete cascade,
    name              varchar(255) not null,
    avatar_emoji      varchar(10)  default '🤖',
    status            varchar(50)  default 'active', -- active | paused | draft
    tone              varchar(50)  default 'consultivo', -- formal | consultivo | amigable | directo
    objective         varchar(50)  default 'agendar_reunion',
    icp_industries    text[]       default '{}',
    icp_roles         text[]       default '{}',
    icp_company_sizes text[]       default '{}',
    value_proposition text,
    objections        jsonb        default '[]', -- [{question:"...", answer:"..."}]
    system_prompt     text,
    conversations_count integer    default 0,
    meetings_count      integer    default 0,
    created_at        timestamptz  default now() not null
);

-- ============================================================
-- MÓDULO CONFIGURACIÓN
-- ============================================================

create table if not exists workspace_settings (
    workspace_id           uuid references workspaces(id) on delete cascade primary key,
    daily_connections_limit  integer  default 30,
    daily_messages_limit     integer  default 50,
    daily_inmails_limit      integer  default 10,
    daily_likes_limit        integer  default 30,
    action_delay_min_sec     integer  default 180,
    action_delay_max_sec     integer  default 480,
    ultra_safe_mode          boolean  default true,
    pause_on_weekends        boolean  default true,
    active_hours_start       integer  default 8,
    active_hours_end         integer  default 20,
    timezone                 varchar(100) default 'America/Lima',
    warmup_enabled           boolean  default false,
    warmup_day               integer  default 1,
    updated_at               timestamptz default now() not null
);

create table if not exists webhooks (
    id           uuid default uuid_generate_v4() primary key,
    workspace_id uuid references workspaces(id) on delete cascade,
    name         varchar(255) not null,
    url          text         not null,
    events       text[]       not null default '{}',
    is_active    boolean      default true,
    secret_token varchar(255),
    created_at   timestamptz  default now() not null
);

create table if not exists oauth_connections (
    id            uuid default uuid_generate_v4() primary key,
    workspace_id  uuid references workspaces(id) on delete cascade,
    provider      varchar(50)  not null, -- linkedin | sales_navigator | gmail | outlook | smtp
    account_email varchar(255),
    account_name  varchar(255),
    li_at_cookie  text,          -- cifrado en prod
    access_token  text,
    refresh_token text,
    expires_at    timestamptz,
    smtp_host     varchar(255),
    smtp_port     integer,
    smtp_user     varchar(255),
    smtp_from     varchar(255),
    metadata      jsonb        default '{}',
    created_at    timestamptz  default now() not null,
    unique(workspace_id, provider)
);

-- ============================================================
-- MÓDULO EQUIPOS (nuevo V2.1)
-- ============================================================

-- Invitaciones pendientes de equipo
create table if not exists team_invitations (
    id            uuid default uuid_generate_v4() primary key,
    workspace_id  uuid references workspaces(id) on delete cascade,
    invited_by    uuid references profiles(id) on delete set null,
    email         varchar(255) not null,
    role          varchar(50)  default 'vendedor', -- admin | vendedor | observador
    token         varchar(255) unique not null default encode(gen_random_bytes(32), 'hex'),
    status        varchar(50)  default 'pending', -- pending | accepted | revoked
    expires_at    timestamptz  default (now() + interval '7 days'),
    created_at    timestamptz  default now() not null
);

-- ============================================================
-- MÓDULO SMART INBOX — mejoras V2.1
-- ============================================================

-- Conversaciones/hilos de mensajes
create table if not exists conversations (
    id             uuid default uuid_generate_v4() primary key,
    workspace_id   uuid references workspaces(id) on delete cascade,
    lead_id        uuid references leads(id) on delete cascade,
    assigned_to    uuid references profiles(id) on delete set null,
    status         varchar(50) default 'active', -- new | active | ai_handling | human | archived
    autopilot_active boolean   default false,
    unread_count   integer     default 0,
    resolved_at    timestamptz,
    created_at     timestamptz default now() not null
);

-- Plantillas rápidas de respuesta (Quick Replies)
create table if not exists quick_reply_templates (
    id           uuid default uuid_generate_v4() primary key,
    workspace_id uuid references workspaces(id) on delete cascade,
    label        varchar(100) not null,
    text         text         not null,
    category     varchar(50)  default 'general', -- seguimiento | calificacion | propuesta | cierre | general
    created_by   uuid references profiles(id) on delete set null,
    created_at   timestamptz  default now() not null
);

-- Notas internas por lead (activity log del lead)
create table if not exists lead_notes (
    id           uuid default uuid_generate_v4() primary key,
    lead_id      uuid references leads(id) on delete cascade,
    workspace_id uuid references workspaces(id) on delete cascade,
    author_id    uuid references profiles(id) on delete set null,
    content      text not null,
    note_type    varchar(50) default 'note', -- note | activity | stage_change | meeting | call
    metadata     jsonb       default '{}',
    created_at   timestamptz default now() not null
);

-- ============================================================
-- MÓDULO CRM — mejoras V2.1
-- ============================================================

-- Columnas personalizadas del Kanban CRM por workspace
create table if not exists crm_columns (
    id           uuid default uuid_generate_v4() primary key,
    workspace_id uuid references workspaces(id) on delete cascade,
    title        varchar(100) not null,
    color        varchar(50)  default 'blue',
    position     integer      default 0,
    created_at   timestamptz  default now() not null
);

-- Automatizaciones del CRM (triggers por columna)
create table if not exists crm_automations (
    id            uuid default uuid_generate_v4() primary key,
    workspace_id  uuid references workspaces(id) on delete cascade,
    column_id     varchar(100) not null, -- puede ser id de crm_columns o status string
    trigger_label text         not null,
    action_label  text         not null,
    action_type   varchar(50)  default 'webhook', -- webhook | slack | email | calendar
    action_config jsonb        default '{}',
    is_active     boolean      default true,
    created_at    timestamptz  default now() not null
);

-- ============================================================
-- ACTIVITY LOG (acciones del agente IA y usuarios)
-- ============================================================

create table if not exists activity_log (
    id           uuid default uuid_generate_v4() primary key,
    workspace_id uuid references workspaces(id) on delete cascade,
    lead_id      uuid references leads(id) on delete set null,
    campaign_id  uuid references campaigns(id) on delete set null,
    agent_id     uuid references agents(id) on delete set null,
    user_id      uuid references profiles(id) on delete set null,
    -- Tipos de acción:
    -- message_sent | connection_sent | connection_accepted | meeting_booked
    -- ai_reply | lead_qualified | campaign_started | campaign_paused
    -- lead_created | lead_stage_changed | note_added | conversation_archived
    action_type  varchar(100) not null,
    description  text,
    metadata     jsonb        default '{}',
    created_at   timestamptz  default now() not null
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table workspaces              enable row level security;
alter table profiles                enable row level security;
alter table linkedin_accounts       enable row level security;
alter table campaigns               enable row level security;
alter table leads                   enable row level security;
alter table messages                enable row level security;
alter table agents                  enable row level security;
alter table workspace_settings      enable row level security;
alter table webhooks                enable row level security;
alter table oauth_connections       enable row level security;
alter table team_invitations        enable row level security;
alter table conversations           enable row level security;
alter table quick_reply_templates   enable row level security;
alter table lead_notes              enable row level security;
alter table crm_columns             enable row level security;
alter table crm_automations         enable row level security;
alter table activity_log            enable row level security;

-- ── Helper: obtener workspace_id del usuario autenticado ─────────────────────
-- Reutilizable en todas las políticas
create or replace function auth_workspace_id()
returns uuid language sql stable security definer as $$
  select workspace_id from profiles where id = auth.uid()
$$;

-- ── Profiles ─────────────────────────────────────────────────────────────────
create policy "profiles: view own"   on profiles for select using (auth.uid() = id);
create policy "profiles: update own" on profiles for update using (auth.uid() = id);

-- ── Workspaces ───────────────────────────────────────────────────────────────
create policy "workspaces: view own" on workspaces for select
  using (id = auth_workspace_id());

create policy "workspaces: update own" on workspaces for update
  using (id = auth_workspace_id());

-- ── Macro: política workspace-scoped ─────────────────────────────────────────
-- Aplica a todas las tablas con workspace_id:

-- linkedin_accounts
create policy "linkedin_accounts: all" on linkedin_accounts for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- campaigns
create policy "campaigns: all" on campaigns for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- leads
create policy "leads: all" on leads for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- messages (acceso via lead)
create policy "messages: select" on messages for select
  using (lead_id in (select id from leads where workspace_id = auth_workspace_id()));
create policy "messages: insert" on messages for insert
  with check (lead_id in (select id from leads where workspace_id = auth_workspace_id()));

-- agents
create policy "agents: all" on agents for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- workspace_settings
create policy "workspace_settings: all" on workspace_settings for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- webhooks
create policy "webhooks: all" on webhooks for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- oauth_connections
create policy "oauth_connections: all" on oauth_connections for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- team_invitations
create policy "team_invitations: all" on team_invitations for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- conversations
create policy "conversations: all" on conversations for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- quick_reply_templates
create policy "quick_reply_templates: all" on quick_reply_templates for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- lead_notes
create policy "lead_notes: all" on lead_notes for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- crm_columns
create policy "crm_columns: all" on crm_columns for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- crm_automations
create policy "crm_automations: all" on crm_automations for all
  using (workspace_id = auth_workspace_id())
  with check (workspace_id = auth_workspace_id());

-- activity_log
create policy "activity_log: select" on activity_log for select
  using (workspace_id = auth_workspace_id());
create policy "activity_log: insert" on activity_log for insert
  with check (workspace_id = auth_workspace_id());

-- ============================================================
-- ÍNDICES (performance)
-- ============================================================

create index if not exists idx_leads_workspace      on leads(workspace_id);
create index if not exists idx_leads_campaign       on leads(campaign_id);
create index if not exists idx_leads_status         on leads(status);
create index if not exists idx_leads_assigned       on leads(assigned_to);
create index if not exists idx_messages_lead        on messages(lead_id);
create index if not exists idx_messages_ts          on messages(timestamp desc);
create index if not exists idx_campaigns_workspace  on campaigns(workspace_id);
create index if not exists idx_campaigns_status     on campaigns(status);
create index if not exists idx_conversations_lead   on conversations(lead_id);
create index if not exists idx_conversations_ws     on conversations(workspace_id);
create index if not exists idx_conversations_assign on conversations(assigned_to);
create index if not exists idx_activity_workspace   on activity_log(workspace_id);
create index if not exists idx_activity_lead        on activity_log(lead_id);
create index if not exists idx_activity_ts          on activity_log(created_at desc);
create index if not exists idx_lead_notes_lead      on lead_notes(lead_id);
create index if not exists idx_invitations_email    on team_invitations(email);
create index if not exists idx_invitations_token    on team_invitations(token);

-- ============================================================
-- FUNCIÓN: Auto-crear perfil + workspace + settings al registrarse
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
declare
  new_workspace_id uuid;
begin
  insert into workspaces (name, plan_type)
  values (
    coalesce(new.raw_user_meta_data->>'company', 'Mi Workspace'),
    'growth'
  )
  returning id into new_workspace_id;

  insert into profiles (id, workspace_id, full_name, email, role)
  values (
    new.id,
    new_workspace_id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'admin'
  );

  insert into workspace_settings (workspace_id)
  values (new_workspace_id);

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- RESUMEN DE TABLAS
-- ============================================================
-- CORE:            workspaces, profiles
-- LINKEDIN:        linkedin_accounts, oauth_connections
-- CAMPAÑAS:        campaigns (+ workflow_json)
-- CRM:             leads, crm_columns, crm_automations
-- MENSAJES:        messages, conversations, lead_notes
-- IA:              agents, quick_reply_templates
-- CONFIGURACIÓN:   workspace_settings, webhooks
-- EQUIPOS:         team_invitations (+ role en profiles)
-- OBSERVABILIDAD:  activity_log
--
-- Total tablas: 17
-- Total con RLS: 17 (100%)
-- ============================================================
