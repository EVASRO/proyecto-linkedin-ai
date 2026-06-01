-- ============================================================
-- NEXUSAI — SCHEMA COMPLETO V3.0
-- Ejecutar en: Supabase → SQL Editor → New Query
-- Versión: 2026-05-30
-- Cambios vs V2.1:
--   + tabla inbound_posts (calendario editorial Inbound)
--   + tabla email_connections (servidores SMTP / OAuth email)
--   + tabla ghost_engine_sessions (historial de sesiones del motor)
--   + campo `session_cookie` en oauth_connections ahora `encrypted_token`
--   + índices adicionales para inbound y email
-- ============================================================

-- ============================================================
-- EJECUTAR PRIMERO: extensiones requeridas
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";   -- para gen_random_bytes en tokens

-- ============================================================
-- INSTRUCCIONES DE ACTUALIZACIÓN DESDE V2.1
-- ============================================================
-- Si ya tienes V2.1 aplicada, ejecuta SOLO el bloque
-- "MIGRACIONES INCREMENTALES V2.1 → V3.0" al final de este archivo.
-- Si es instalación nueva, ejecuta TODO el archivo de arriba a abajo.
-- ============================================================

-- ============================================================
-- TABLAS CORE
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

-- ============================================================
-- LINKEDIN
-- ============================================================

create table if not exists linkedin_accounts (
    id                      uuid default uuid_generate_v4() primary key,
    workspace_id            uuid references workspaces(id) on delete cascade,
    name                    varchar(255) not null,
    li_at_cookie            text,
    connection_mode         varchar(50)  default 'extension', -- extension | oauth_api
    oauth_client_id         varchar(255),  -- LinkedIn API Client ID
    oauth_client_secret     text,          -- LinkedIn API Client Secret (cifrado en prod)
    oauth_access_token      text,          -- Token de acceso OAuth
    oauth_refresh_token     text,
    oauth_expires_at        timestamptz,
    status                  varchar(50)  default 'connected', -- connected | disconnected | expired
    daily_connection_limit  integer default 30,
    daily_message_limit     integer default 50,
    use_ultra_safe_mode     boolean default true,
    created_at              timestamptz default now() not null
);

-- ============================================================
-- CAMPAÑAS
-- ============================================================

create table if not exists campaigns (
    id                  uuid default uuid_generate_v4() primary key,
    workspace_id        uuid references workspaces(id) on delete cascade,
    linkedin_account_id uuid references linkedin_accounts(id) on delete set null,
    name                varchar(255) not null,
    type                varchar(50)  default 'linkedin', -- linkedin | sales_navigator | email
    status              varchar(50)  default 'draft',    -- draft | active | paused | completed
    workflow_json       jsonb        not null default '{}',
    total_leads         integer      default 0,
    segment_count       integer      default 1,
    created_at          timestamptz  default now() not null
);

-- ============================================================
-- LEADS / CRM
-- ============================================================

create table if not exists leads (
    id            uuid default uuid_generate_v4() primary key,
    campaign_id   uuid references campaigns(id) on delete set null,
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
    score         integer      default 0,
    custom_tags   text[]       default '{}',
    next_task     text,
    created_at    timestamptz  default now() not null
);

create table if not exists crm_columns (
    id           uuid default uuid_generate_v4() primary key,
    workspace_id uuid references workspaces(id) on delete cascade,
    title        varchar(100) not null,
    color        varchar(50)  default 'blue',
    position     integer      default 0,
    created_at   timestamptz  default now() not null
);

create table if not exists crm_automations (
    id            uuid default uuid_generate_v4() primary key,
    workspace_id  uuid references workspaces(id) on delete cascade,
    column_id     varchar(100) not null,
    trigger_label text         not null,
    action_label  text         not null,
    action_type   varchar(50)  default 'webhook',
    action_config jsonb        default '{}',
    is_active     boolean      default true,
    created_at    timestamptz  default now() not null
);

-- ============================================================
-- MENSAJES / SMART INBOX
-- ============================================================

create table if not exists messages (
    id           uuid default uuid_generate_v4() primary key,
    lead_id      uuid references leads(id) on delete cascade,
    sender       varchar(50)  not null, -- user | ai | prospect
    message_text text         not null,
    is_read      boolean      default false,
    status       varchar(50)  default 'sent',
    timestamp    timestamptz  default now() not null
);

create table if not exists conversations (
    id               uuid default uuid_generate_v4() primary key,
    workspace_id     uuid references workspaces(id) on delete cascade,
    lead_id          uuid references leads(id) on delete cascade,
    assigned_to      uuid references profiles(id) on delete set null,
    status           varchar(50) default 'active', -- new | active | ai_handling | human | archived
    autopilot_active boolean     default false,
    unread_count     integer     default 0,
    resolved_at      timestamptz,
    created_at       timestamptz default now() not null
);

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

create table if not exists quick_reply_templates (
    id           uuid default uuid_generate_v4() primary key,
    workspace_id uuid references workspaces(id) on delete cascade,
    label        varchar(100) not null,
    text         text         not null,
    category     varchar(50)  default 'general',
    created_by   uuid references profiles(id) on delete set null,
    created_at   timestamptz  default now() not null
);

-- ============================================================
-- AGENTES IA
-- ============================================================

create table if not exists agents (
    id                  uuid default uuid_generate_v4() primary key,
    workspace_id        uuid references workspaces(id) on delete cascade,
    name                varchar(255) not null,
    avatar_emoji        varchar(10)  default '🤖',
    status              varchar(50)  default 'active', -- active | paused | draft
    tone                varchar(50)  default 'consultivo',
    objective           varchar(50)  default 'agendar_reunion',
    icp_industries      text[]       default '{}',
    icp_roles           text[]       default '{}',
    icp_company_sizes   text[]       default '{}',
    value_proposition   text,
    objections          jsonb        default '[]',
    system_prompt       text,
    conversations_count integer      default 0,
    meetings_count      integer      default 0,
    created_at          timestamptz  default now() not null
);

-- ============================================================
-- INBOUND — NUEVO EN V3.0
-- ============================================================

create table if not exists inbound_posts (
    id             uuid default uuid_generate_v4() primary key,
    workspace_id   uuid references workspaces(id) on delete cascade,
    created_by     uuid references profiles(id) on delete set null,
    type           varchar(50)  not null default 'post', -- post | articulo | carrusel
    tone           varchar(50)  default 'profesional',
    topic          varchar(500) not null,
    content        text         not null,
    status         varchar(50)  default 'draft', -- draft | scheduled | published | failed
    scheduled_at   date,          -- fecha programada de publicación (YYYY-MM-DD)
    published_at   timestamptz,   -- timestamp real de publicación
    linkedin_post_id varchar(255), -- ID del post en LinkedIn una vez publicado
    error_message  text,          -- si status = failed, describe el error
    metadata       jsonb        default '{}',
    created_at     timestamptz  default now() not null
);

-- ============================================================
-- EMAIL MARKETING — NUEVO EN V3.0
-- ============================================================

create table if not exists email_connections (
    id            uuid default uuid_generate_v4() primary key,
    workspace_id  uuid references workspaces(id) on delete cascade,
    provider      varchar(50)  not null, -- gmail | outlook | smtp | sendgrid | ses
    display_name  varchar(255),
    email_from    varchar(255) not null,  -- dirección remitente
    -- OAuth (Gmail / Outlook)
    oauth_client_id     varchar(255),
    oauth_client_secret text,
    oauth_access_token  text,
    oauth_refresh_token text,
    oauth_expires_at    timestamptz,
    -- SMTP manual
    smtp_host     varchar(255),
    smtp_port     integer      default 587,
    smtp_security varchar(50)  default 'starttls', -- starttls | ssl | none
    smtp_user     varchar(255),
    smtp_password text,         -- cifrado en prod con pgcrypto
    -- Estado
    status        varchar(50)  default 'pending', -- pending | verified | error
    verified_at   timestamptz,
    error_message text,
    is_default    boolean      default false,
    created_at    timestamptz  default now() not null,
    unique(workspace_id, email_from)
);

-- ============================================================
-- GHOST ENGINE — NUEVO EN V3.0
-- ============================================================

create table if not exists ghost_engine_sessions (
    id             uuid default uuid_generate_v4() primary key,
    workspace_id   uuid references workspaces(id) on delete cascade,
    linkedin_account_id uuid references linkedin_accounts(id) on delete set null,
    started_at     timestamptz  default now() not null,
    ended_at       timestamptz,
    actions_count  integer      default 0,
    connections_sent integer    default 0,
    messages_sent  integer      default 0,
    errors_count   integer      default 0,
    status         varchar(50)  default 'running', -- running | paused | stopped | error
    metadata       jsonb        default '{}'
);

-- ============================================================
-- CONFIGURACIÓN / EQUIPOS
-- ============================================================

create table if not exists workspace_settings (
    workspace_id             uuid references workspaces(id) on delete cascade primary key,
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
    -- Email settings
    default_email_connection_id uuid references email_connections(id) on delete set null,
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

create table if not exists team_invitations (
    id            uuid default uuid_generate_v4() primary key,
    workspace_id  uuid references workspaces(id) on delete cascade,
    invited_by    uuid references profiles(id) on delete set null,
    email         varchar(255) not null,
    role          varchar(50)  default 'vendedor',
    token         varchar(255) unique not null default encode(gen_random_bytes(32), 'hex'),
    status        varchar(50)  default 'pending', -- pending | accepted | revoked
    expires_at    timestamptz  default (now() + interval '7 days'),
    created_at    timestamptz  default now() not null
);

-- ============================================================
-- OBSERVABILIDAD
-- ============================================================

create table if not exists activity_log (
    id           uuid default uuid_generate_v4() primary key,
    workspace_id uuid references workspaces(id) on delete cascade,
    lead_id      uuid references leads(id) on delete set null,
    campaign_id  uuid references campaigns(id) on delete set null,
    agent_id     uuid references agents(id) on delete set null,
    user_id      uuid references profiles(id) on delete set null,
    action_type  varchar(100) not null,
    description  text,
    metadata     jsonb        default '{}',
    created_at   timestamptz  default now() not null
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table workspaces            enable row level security;
alter table profiles              enable row level security;
alter table linkedin_accounts     enable row level security;
alter table campaigns             enable row level security;
alter table leads                 enable row level security;
alter table crm_columns           enable row level security;
alter table crm_automations       enable row level security;
alter table messages              enable row level security;
alter table conversations         enable row level security;
alter table lead_notes            enable row level security;
alter table quick_reply_templates enable row level security;
alter table agents                enable row level security;
alter table inbound_posts         enable row level security;
alter table email_connections     enable row level security;
alter table ghost_engine_sessions enable row level security;
alter table workspace_settings    enable row level security;
alter table webhooks              enable row level security;
alter table team_invitations      enable row level security;
alter table activity_log          enable row level security;

-- Helper función
create or replace function auth_workspace_id()
returns uuid language sql stable security definer as $$
  select workspace_id from profiles where id = auth.uid()
$$;

-- Profiles
create policy "profiles: view own"   on profiles for select using (auth.uid() = id);
create policy "profiles: update own" on profiles for update using (auth.uid() = id);

-- Workspaces
create policy "workspaces: view own"   on workspaces for select using (id = auth_workspace_id());
create policy "workspaces: update own" on workspaces for update using (id = auth_workspace_id());

-- Macro workspace-scoped (todas las demás tablas)
do $$ declare tbl text;
begin
  foreach tbl in array array[
    'linkedin_accounts','campaigns','leads','crm_columns','crm_automations',
    'agents','inbound_posts','email_connections','ghost_engine_sessions',
    'workspace_settings','webhooks','team_invitations','conversations',
    'quick_reply_templates','lead_notes','crm_automations'
  ] loop
    execute format(
      'create policy "%s: all" on %s for all
       using (workspace_id = auth_workspace_id())
       with check (workspace_id = auth_workspace_id())',
      tbl, tbl
    );
  end loop;
end $$;

-- Messages (acceso via lead)
create policy "messages: select" on messages for select
  using (lead_id in (select id from leads where workspace_id = auth_workspace_id()));
create policy "messages: insert" on messages for insert
  with check (lead_id in (select id from leads where workspace_id = auth_workspace_id()));

-- Lead notes (también via lead)
create policy "lead_notes: select" on lead_notes for select
  using (workspace_id = auth_workspace_id());
create policy "lead_notes: insert" on lead_notes for insert
  with check (workspace_id = auth_workspace_id());

-- Activity log
create policy "activity_log: select" on activity_log for select
  using (workspace_id = auth_workspace_id());
create policy "activity_log: insert" on activity_log for insert
  with check (workspace_id = auth_workspace_id());

-- ============================================================
-- ÍNDICES
-- ============================================================

create index if not exists idx_leads_workspace       on leads(workspace_id);
create index if not exists idx_leads_campaign        on leads(campaign_id);
create index if not exists idx_leads_status          on leads(status);
create index if not exists idx_leads_assigned        on leads(assigned_to);
create index if not exists idx_messages_lead         on messages(lead_id);
create index if not exists idx_messages_ts           on messages(timestamp desc);
create index if not exists idx_campaigns_workspace   on campaigns(workspace_id);
create index if not exists idx_campaigns_status      on campaigns(status);
create index if not exists idx_conversations_lead    on conversations(lead_id);
create index if not exists idx_conversations_ws      on conversations(workspace_id);
create index if not exists idx_activity_workspace    on activity_log(workspace_id);
create index if not exists idx_activity_lead         on activity_log(lead_id);
create index if not exists idx_activity_ts           on activity_log(created_at desc);
create index if not exists idx_lead_notes_lead       on lead_notes(lead_id);
create index if not exists idx_invitations_email     on team_invitations(email);
create index if not exists idx_invitations_token     on team_invitations(token);
-- Nuevos V3.0
create index if not exists idx_inbound_workspace     on inbound_posts(workspace_id);
create index if not exists idx_inbound_status        on inbound_posts(status);
create index if not exists idx_inbound_scheduled     on inbound_posts(scheduled_at);
create index if not exists idx_email_conn_workspace  on email_connections(workspace_id);
create index if not exists idx_engine_sessions_ws    on ghost_engine_sessions(workspace_id);
create index if not exists idx_engine_sessions_ts    on ghost_engine_sessions(started_at desc);

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
-- MIGRACIONES INCREMENTALES V2.1 → V3.0
-- (Ejecutar SOLO si ya tienes V2.1 aplicada)
-- ============================================================

-- 1. Nuevas tablas
-- create table if not exists inbound_posts ...       (ver arriba)
-- create table if not exists email_connections ...   (ver arriba)
-- create table if not exists ghost_engine_sessions ...(ver arriba)

-- 2. Columnas nuevas en linkedin_accounts
-- alter table linkedin_accounts add column if not exists oauth_client_id varchar(255);
-- alter table linkedin_accounts add column if not exists oauth_client_secret text;
-- alter table linkedin_accounts add column if not exists oauth_access_token text;
-- alter table linkedin_accounts add column if not exists oauth_refresh_token text;
-- alter table linkedin_accounts add column if not exists oauth_expires_at timestamptz;

-- 3. Columna nueva en campaigns
-- alter table campaigns add column if not exists type varchar(50) default 'linkedin';

-- 4. Columna nueva en workspace_settings
-- alter table workspace_settings add column if not exists default_email_connection_id uuid references email_connections(id) on delete set null;

-- 5. Habilitar RLS en nuevas tablas
-- alter table inbound_posts         enable row level security;
-- alter table email_connections     enable row level security;
-- alter table ghost_engine_sessions enable row level security;

-- 6. Crear políticas para nuevas tablas (copiar del bloque do $$ arriba)

-- 7. Crear índices nuevos (copiar del bloque de índices arriba)

-- ============================================================
-- RESUMEN V3.0
-- ============================================================
-- CORE:            workspaces, profiles
-- LINKEDIN:        linkedin_accounts (+ campos OAuth)
-- CAMPAÑAS:        campaigns (+ tipo email/linkedin/sales_nav)
-- CRM:             leads, crm_columns, crm_automations
-- MENSAJES:        messages, conversations, lead_notes, quick_reply_templates
-- IA:              agents
-- INBOUND:         inbound_posts                          ← NUEVO V3.0
-- EMAIL:           email_connections                      ← NUEVO V3.0
-- GHOST ENGINE:    ghost_engine_sessions                  ← NUEVO V3.0
-- CONFIGURACIÓN:   workspace_settings, webhooks
-- EQUIPOS:         team_invitations
-- OBSERVABILIDAD:  activity_log
--
-- Total tablas: 20 (era 17 en V2.1)
-- Total con RLS: 20 (100%)
-- ============================================================

-- ============================================================
-- MIGRATION: assigned_agent_id on conversations
-- Run in Supabase SQL Editor if not applied yet
-- ============================================================
alter table conversations
  add column if not exists assigned_agent_id uuid references agents(id) on delete set null;

notify pgrst, 'reload schema';
