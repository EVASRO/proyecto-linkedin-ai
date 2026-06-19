ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS enrichment_source TEXT,
  ADD COLUMN IF NOT EXISTS enriched_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS twitter           TEXT,
  ADD COLUMN IF NOT EXISTS website           TEXT;

COMMENT ON COLUMN leads.enrichment_source IS
  'voyager_api | dom_contact_overlay | manual | unknown';
COMMENT ON COLUMN leads.enriched_at IS
  'Timestamp de cuando se realizó el enriquecimiento de contacto';
