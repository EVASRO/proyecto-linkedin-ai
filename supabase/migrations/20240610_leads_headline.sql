-- Add missing columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS connection_sent_at TIMESTAMPTZ;
