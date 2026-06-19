-- ============================================================
-- CLEANUP: Leads incorrectamente marcados como conexion_aceptada
-- por el bug de 301 → already_connected en connectViaVoyagerAPI
--
-- Ejecutar PASO 1 primero y revisar antes de PASO 2 y 3
-- ============================================================

-- PASO 1: Ver leads afectados (2°/3° grado marcados como ya conectados el 18-19 jun 2026)
-- Revisar este listado antes de ejecutar los UPDATEs
SELECT
  l.id,
  l.full_name,
  l.salesnav_url,
  l.crm_column,
  l.connection_sent_at,
  l.connection_accepted_at,
  l.status
FROM leads l
WHERE l.crm_column = 'conexion_aceptada'
  AND l.connection_accepted_at >= '2026-06-18 00:00:00'
ORDER BY l.connection_accepted_at DESC;

-- PASO 2: Cancelar mensajes de follow-up encolados para estos leads
-- (evitar que se envíen InMails a contactos no conectados)
UPDATE engine_queue
SET status    = 'cancelled',
    last_error = 'cancelled: lead incorrectamente marcado como conexion_aceptada (bug 301→already_connected)'
WHERE status    = 'pending'
  AND task_type IN ('message', 'like')
  AND lead_id IN (
    SELECT id FROM leads
    WHERE crm_column = 'conexion_aceptada'
      AND connection_accepted_at >= '2026-06-18 00:00:00'
  );

-- PASO 3: Revertir leads al estado anterior al bug
-- Los leads afectados son contactos 2°/3° donde NUNCA se envió conexión
-- → volver a 'nuevo' (sin connection_sent_at ni connection_accepted_at)
-- OJO: Si para alguno SÍ se envió conexión anteriormente (connection_sent_at < bug date),
--      cámbialo manualmente a 'conexion_enviada'
UPDATE leads
SET crm_column            = 'nuevo',
    connection_accepted_at = NULL,
    status                 = 'new'
WHERE crm_column            = 'conexion_aceptada'
  AND connection_accepted_at >= '2026-06-18 00:00:00';

-- PASO 4: (Opcional) Si algún lead SÍ tenía conexión enviada antes del bug:
-- UPDATE leads SET crm_column='conexion_enviada', connection_accepted_at=NULL
-- WHERE id = '<lead_id_especifico>';
