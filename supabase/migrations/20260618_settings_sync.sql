-- ============================================================
-- MIGRACIÓN: 20260618_settings_sync
-- Unifica el pipeline de settings: dashboard → workspace_settings → extensión
-- EJECUTAR EN: Supabase SQL Editor
-- ============================================================

-- ── 1. workspace_settings: añadir daily_visits_limit ─────────────────────────
alter table workspace_settings
  add column if not exists daily_visits_limit integer default 50;

-- ── 2. workspaces: añadir columnas de settings usadas por /dashboard/settings ─
-- Estas columnas pueden no existir si la tabla fue creada con un schema antiguo
alter table workspaces
  add column if not exists daily_connect_limit  integer default 20,
  add column if not exists daily_message_limit  integer default 50,
  add column if not exists daily_view_limit     integer default 100,
  add column if not exists working_hours_start  integer default 9,
  add column if not exists working_hours_end    integer default 18,
  add column if not exists timezone             varchar(100) default 'America/Lima',
  add column if not exists pause_on_weekends    boolean default true,
  add column if not exists ultra_safe_mode      boolean default false,
  add column if not exists daily_likes_limit    integer default 30,
  add column if not exists daily_inmails_limit  integer default 10;

-- ── 3. Verificación ──────────────────────────────────────────────────────────
select 'workspace_settings' as tabla, column_name
from information_schema.columns
where table_name = 'workspace_settings'
  and column_name in ('daily_visits_limit','daily_likes_limit','daily_inmails_limit',
                      'action_delay_min_sec','action_delay_max_sec','ultra_safe_mode','pause_on_weekends')
union all
select 'workspaces', column_name
from information_schema.columns
where table_name = 'workspaces'
  and column_name in ('daily_connect_limit','daily_message_limit','daily_view_limit',
                      'working_hours_start','working_hours_end','timezone',
                      'daily_likes_limit','daily_inmails_limit')
order by tabla, column_name;
