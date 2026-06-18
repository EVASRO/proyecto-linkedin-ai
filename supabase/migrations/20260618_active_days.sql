-- ============================================================
-- MIGRACIÓN: 20260618_active_days
-- Añade columna active_days a workspace_settings
-- 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb (JS estándar)
-- Default: Lun–Vie = [1,2,3,4,5]
-- ============================================================

alter table workspace_settings
  add column if not exists active_days jsonb default '[1,2,3,4,5]'::jsonb;

-- Verificación
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'workspace_settings'
  and column_name = 'active_days';
