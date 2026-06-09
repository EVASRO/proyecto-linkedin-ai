ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS onboarding_completed  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step       int     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS linkedin_connected    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS linkedin_cookie       text,
  ADD COLUMN IF NOT EXISTS workspace_name        text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workspaces' AND policyname = 'workspace_owner_update'
  ) THEN
    CREATE POLICY "workspace_owner_update"
      ON workspaces FOR UPDATE
      USING (id IN (
        SELECT workspace_id FROM profiles WHERE user_id = auth.uid()
      ));
  END IF;
END
$$;
