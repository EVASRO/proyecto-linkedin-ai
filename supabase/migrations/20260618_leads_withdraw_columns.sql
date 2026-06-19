ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS connection_status   TEXT,
  ADD COLUMN IF NOT EXISTS connection_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdraw_method     TEXT,
  ADD COLUMN IF NOT EXISTS last_withdrawn_at   TIMESTAMPTZ;

COMMENT ON COLUMN leads.connection_status IS
  'Estado actual de la conexión: none | pending | connected';
COMMENT ON COLUMN leads.connection_sent_at IS
  'Timestamp del envío de la solicitud de conexión';
COMMENT ON COLUMN leads.withdraw_method IS
  'voyager_api | dom — método usado para el último withdraw';
COMMENT ON COLUMN leads.last_withdrawn_at IS
  'Timestamp del último retiro de invitación';
