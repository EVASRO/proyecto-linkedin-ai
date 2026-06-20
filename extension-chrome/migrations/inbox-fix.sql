-- ============================================================
-- NexusAI — Inbox Fix Migration
-- Ejecutar en Supabase SQL Editor UNA SOLA VEZ
-- ============================================================

-- 1. Agregar columna linkedin_member_id a leads (si no existe)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS linkedin_member_id TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_member_id
  ON leads(workspace_id, linkedin_member_id)
  WHERE linkedin_member_id IS NOT NULL;

-- ============================================================
-- 2. Limpiar leads duplicados (mismo workspace + misma linkedin_url)
-- PRECAUCIÓN: revisar con el SELECT previo antes de ejecutar el DELETE
-- ============================================================

-- Vista previa — ejecutar primero para revisar qué se va a eliminar:
-- SELECT workspace_id, linkedin_url, COUNT(*) AS cnt
-- FROM leads
-- WHERE linkedin_url IS NOT NULL AND linkedin_url != ''
-- GROUP BY workspace_id, linkedin_url
-- HAVING COUNT(*) > 1
-- ORDER BY cnt DESC;

WITH ranked AS (
  SELECT
    id,
    workspace_id,
    linkedin_url,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id,
        LOWER(TRIM(TRAILING '/' FROM COALESCE(linkedin_url, '')))
      ORDER BY created_at ASC  -- conservar el más antiguo
    ) AS rn
  FROM leads
  WHERE linkedin_url IS NOT NULL AND linkedin_url != ''
),
to_delete AS (SELECT id FROM ranked WHERE rn > 1)

-- Paso 1: reasignar mensajes al lead original antes de eliminar duplicados
UPDATE messages
  SET lead_id = (
    SELECT r2.id
    FROM ranked r2
    WHERE r2.rn = 1
      AND LOWER(TRIM(TRAILING '/' FROM COALESCE(r2.linkedin_url, ''))) =
          LOWER(TRIM(TRAILING '/' FROM COALESCE(
            (SELECT linkedin_url FROM leads WHERE id = messages.lead_id), ''
          )))
    LIMIT 1
  )
  WHERE lead_id IN (SELECT id FROM to_delete);

-- Paso 2: reasignar conversaciones al lead original
WITH ranked AS (
  SELECT
    id,
    workspace_id,
    linkedin_url,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id,
        LOWER(TRIM(TRAILING '/' FROM COALESCE(linkedin_url, '')))
      ORDER BY created_at ASC
    ) AS rn
  FROM leads
  WHERE linkedin_url IS NOT NULL AND linkedin_url != ''
),
to_delete AS (SELECT id FROM ranked WHERE rn > 1)

UPDATE conversations
  SET lead_id = (
    SELECT r2.id
    FROM ranked r2
    WHERE r2.rn = 1
      AND LOWER(TRIM(TRAILING '/' FROM COALESCE(r2.linkedin_url, ''))) =
          LOWER(TRIM(TRAILING '/' FROM COALESCE(
            (SELECT linkedin_url FROM leads WHERE id = conversations.lead_id), ''
          )))
    LIMIT 1
  )
  WHERE lead_id IN (SELECT id FROM to_delete);

-- Paso 3: eliminar leads duplicados
WITH ranked AS (
  SELECT
    id,
    workspace_id,
    linkedin_url,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id,
        LOWER(TRIM(TRAILING '/' FROM COALESCE(linkedin_url, '')))
      ORDER BY created_at ASC
    ) AS rn
  FROM leads
  WHERE linkedin_url IS NOT NULL AND linkedin_url != ''
),
to_delete AS (SELECT id FROM ranked WHERE rn > 1)

DELETE FROM leads WHERE id IN (SELECT id FROM to_delete);

-- ============================================================
-- 3. Unique constraint para prevenir futuros duplicados
-- (comentado — descomentar solo si los datos actuales ya están limpios)
-- ============================================================
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique_url
--   ON leads(workspace_id, LOWER(TRIM(TRAILING '/' FROM linkedin_url)))
--   WHERE linkedin_url IS NOT NULL;
