-- Add key column to crm_columns and backfill default column keys
ALTER TABLE crm_columns ADD COLUMN IF NOT EXISTS key TEXT;

UPDATE crm_columns SET key = 'extraido'           WHERE title = 'Extraídos';
UPDATE crm_columns SET key = 'conexion_enviada'   WHERE title = 'Conexión Enviada';
UPDATE crm_columns SET key = 'conexion_aceptada'  WHERE title = 'Conexión Aceptada';
UPDATE crm_columns SET key = 'en_conversacion'    WHERE title = 'En Conversación';
UPDATE crm_columns SET key = 'reunion_agendada'   WHERE title = 'Reunión Agendada';
UPDATE crm_columns SET key = 'cliente'            WHERE title = 'Cliente';
