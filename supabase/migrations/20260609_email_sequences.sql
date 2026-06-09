CREATE TABLE IF NOT EXISTS email_providers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_type  text NOT NULL CHECK (provider_type IN ('smtp','mailgun','sendgrid','resend')),
  config         jsonb NOT NULL DEFAULT '{}',
  is_active      boolean DEFAULT true,
  verified       boolean DEFAULT false,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(workspace_id)
);

CREATE TABLE IF NOT EXISTS email_queue (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES workspaces(id),
  campaign_id    uuid REFERENCES campaigns(id),
  lead_id        uuid REFERENCES leads(id),
  to_email       text NOT NULL,
  to_name        text,
  subject        text NOT NULL,
  body_html      text NOT NULL,
  body_text      text,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','sent','failed','bounced')),
  scheduled_at   timestamptz DEFAULT now(),
  sent_at        timestamptz,
  last_error     text,
  message_id     text,
  opened_at      timestamptz,
  clicked_at     timestamptz,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE email_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_own_email_providers" ON email_providers
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));

CREATE POLICY "ws_own_email_queue" ON email_queue
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));

CREATE POLICY "ext_insert_email_queue" ON email_queue
  FOR INSERT WITH CHECK (true);

CREATE POLICY "ext_update_email_queue" ON email_queue
  FOR UPDATE USING (true);
