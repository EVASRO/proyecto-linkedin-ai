-- A/B testing fields on campaigns
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS ab_test_enabled    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ab_variant_a       jsonb   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ab_variant_b       jsonb   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ab_winner          text    CHECK (ab_winner IN ('a', 'b', NULL)),
  ADD COLUMN IF NOT EXISTS ab_min_sample_size int     DEFAULT 30;

-- Track which A/B variant each lead received
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS ab_variant    text CHECK (ab_variant IN ('a', 'b', NULL)),
  ADD COLUMN IF NOT EXISTS sequence_step int  DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_ab_variant     ON leads (workspace_id, ab_variant);
CREATE INDEX IF NOT EXISTS idx_leads_sequence_step  ON leads (workspace_id, campaign_id, sequence_step);
