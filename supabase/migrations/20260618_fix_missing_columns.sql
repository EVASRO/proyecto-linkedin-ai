-- ============================================================
-- MIGRACIÓN: 20260618_fix_missing_columns
-- Agrega columnas faltantes en linkedin_accounts y workspace_settings
-- que causaban ERROR 400 en el heartbeat de la extensión.
-- EJECUTAR EN: Supabase SQL Editor (Project → SQL Editor → New Query)
-- ============================================================

-- ── 1. linkedin_accounts: columnas que pueden faltar en DB existente ──────────
alter table linkedin_accounts
  add column if not exists headline        varchar(500),
  add column if not exists profile_url     varchar(500),
  add column if not exists avatar_url      varchar(500),
  add column if not exists last_synced_at  timestamptz default now(),
  add column if not exists error_message   text;

-- Columnas legacy que se eliminaron del upsert (ya no se usan):
-- connection_mode, daily_connection_limit, daily_message_limit
-- Se mantienen en schema para compatibilidad pero NO se upsertean desde la extensión.
-- Si la DB las tiene, no hay problema. Si no las tiene, tampoco (no las enviamos).

-- ── 2. workspace_settings: asegurar que exista la fila por defecto ────────────
-- La tabla ya debe tener workspace_id como PK. Solo asegurar columnas:
alter table workspace_settings
  add column if not exists ultra_safe_mode     boolean default true,
  add column if not exists pause_on_weekends   boolean default true,
  add column if not exists active_hours_start  integer default 8,
  add column if not exists active_hours_end    integer default 20,
  add column if not exists timezone            varchar(100) default 'America/Lima',
  add column if not exists warmup_enabled      boolean default false,
  add column if not exists daily_inmails_limit integer default 10,
  add column if not exists daily_likes_limit   integer default 30,
  add column if not exists action_delay_min_sec integer default 180,
  add column if not exists action_delay_max_sec integer default 480;

-- ── 3. settings_events: crear tabla si no existe ─────────────────────────────
create table if not exists settings_events (
  id            uuid         primary key default uuid_generate_v4(),
  workspace_id  uuid         not null references workspaces(id) on delete cascade,
  event_type    text         not null, -- 'RESUME_ENGINE' | 'PAUSE_ENGINE' | 'UPDATE_SETTINGS'
  payload       jsonb        default '{}',
  consumed      boolean      default false,
  created_at    timestamptz  default now() not null
);

create index if not exists idx_settings_events_workspace_consumed
  on settings_events(workspace_id, consumed, created_at desc);

-- RLS
alter table settings_events enable row level security;
drop policy if exists "workspace members settings_events" on settings_events;
create policy "workspace members settings_events" on settings_events
  for all using (
    workspace_id = (select workspace_id from profiles where id = auth.uid())
  );

-- ── 4. Verificación rápida ────────────────────────────────────────────────────
select
  'linkedin_accounts'   as tabla,
  column_name,
  data_type
from information_schema.columns
where table_name = 'linkedin_accounts'
  and column_name in ('headline', 'profile_url', 'avatar_url', 'last_synced_at', 'error_message', 'status')
union all
select
  'workspace_settings'  as tabla,
  column_name,
  data_type
from information_schema.columns
where table_name = 'workspace_settings'
  and column_name in ('ultra_safe_mode', 'pause_on_weekends', 'active_hours_start', 'active_hours_end', 'timezone')
order by tabla, column_name;
