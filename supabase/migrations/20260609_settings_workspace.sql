-- Columnas de configuración de seguridad LinkedIn en workspaces
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS daily_connect_limit   int  DEFAULT 20,
  ADD COLUMN IF NOT EXISTS daily_message_limit   int  DEFAULT 50,
  ADD COLUMN IF NOT EXISTS daily_view_limit      int  DEFAULT 100,
  ADD COLUMN IF NOT EXISTS working_hours_start   int  DEFAULT 9,
  ADD COLUMN IF NOT EXISTS working_hours_end     int  DEFAULT 18,
  ADD COLUMN IF NOT EXISTS working_days          int[] DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS timezone              text DEFAULT 'America/Lima',
  ADD COLUMN IF NOT EXISTS workspace_name        text,
  ADD COLUMN IF NOT EXISTS logo_url              text;

-- Tabla de blacklist (perfiles a no contactar)
CREATE TABLE IF NOT EXISTS blacklist (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linkedin_url text,
  email        text,
  reason       text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_own_blacklist" ON blacklist
  USING (workspace_id IN (
    SELECT workspace_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "ws_insert_blacklist" ON blacklist
  FOR INSERT WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "ws_delete_blacklist" ON blacklist
  FOR DELETE USING (workspace_id IN (
    SELECT workspace_id FROM profiles WHERE id = auth.uid()
  ));
