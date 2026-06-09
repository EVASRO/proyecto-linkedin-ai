-- Índice para acelerar query de tareas programadas
CREATE INDEX IF NOT EXISTS idx_engine_queue_scheduled
  ON engine_queue (workspace_id, status, scheduled_at, priority);

-- Asegurar scheduled_at en engine_queue
ALTER TABLE engine_queue
  ALTER COLUMN scheduled_at SET DEFAULT NOW();

-- Campos de estado de scraping en campaigns
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS scraping_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_scraped_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_leads      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leads_total      INTEGER DEFAULT 0;
