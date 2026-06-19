ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS last_followed_at TIMESTAMPTZ;

COMMENT ON COLUMN leads.last_followed_at IS
  'Timestamp del último follow realizado por el engine';
