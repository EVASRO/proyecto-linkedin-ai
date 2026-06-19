ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS last_message_method TEXT;

COMMENT ON COLUMN leads.last_message_method IS
  'voyager_api | dom — método usado para enviar el último mensaje';
