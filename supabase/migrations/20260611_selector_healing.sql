-- ============================================================
-- NexusAI — Selector Healing System
-- Tablas para auto-detección y corrección de selectores CSS rotos
-- ============================================================

-- ── selector_failures ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS selector_failures (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id     UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  platform         TEXT NOT NULL CHECK (platform IN ('linkedin', 'salesnav')),
  action           TEXT NOT NULL,
  selector_key     TEXT NOT NULL,
  selector_tried   TEXT NOT NULL,
  html_context     TEXT,
  page_url         TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','analyzing','proposed','approved','rejected')),
  proposed_selector TEXT,
  confidence       FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  approved_at      TIMESTAMPTZ,
  approved_by      TEXT
);

-- ── selector_overrides ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS selector_overrides (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id   UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  platform       TEXT NOT NULL,
  action         TEXT NOT NULL,
  selector_key   TEXT NOT NULL,
  selector_value TEXT NOT NULL,
  active         BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, platform, action, selector_key)
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_selector_failures_workspace
  ON selector_failures (workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_selector_failures_key
  ON selector_failures (workspace_id, platform, action, selector_key);

CREATE INDEX IF NOT EXISTS idx_selector_overrides_workspace
  ON selector_overrides (workspace_id, active);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE selector_failures  ENABLE ROW LEVEL SECURITY;
ALTER TABLE selector_overrides ENABLE ROW LEVEL SECURITY;

-- Policies: cada workspace solo ve sus propios registros
-- El workspace_id en el JWT viene del claim custom "workspace_id" (igual que el resto de tablas)
CREATE POLICY "selector_failures_workspace_isolation"
  ON selector_failures
  FOR ALL
  USING (workspace_id = (auth.jwt() ->> 'workspace_id')::uuid);

CREATE POLICY "selector_overrides_workspace_isolation"
  ON selector_overrides
  FOR ALL
  USING (workspace_id = (auth.jwt() ->> 'workspace_id')::uuid);
