ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS autopilot_mode text DEFAULT 'review'
    CHECK (autopilot_mode IN ('auto', 'review'));

-- 'review': Claude genera draft, usuario aprueba antes de enviar
-- 'auto':   Claude genera y encola para envío inmediato
