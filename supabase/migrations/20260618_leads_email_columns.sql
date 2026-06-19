ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_opt_out      BOOLEAN DEFAULT false;

COMMENT ON COLUMN leads.last_email_sent_at IS
  'Timestamp del último email enviado a este lead';
COMMENT ON COLUMN leads.email_opt_out IS
  'true = lead solicitó no recibir emails (unsubscribe)';

ALTER TABLE email_queue
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN email_queue.metadata IS
  'Datos adicionales del lead para personalización (company, job_title, etc.)';
