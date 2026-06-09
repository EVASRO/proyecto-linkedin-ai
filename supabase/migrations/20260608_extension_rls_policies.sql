-- ── Leads: la extensión debe poder leer y actualizar ─────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='leads'
    AND policyname='extension_update_leads'
  ) THEN
    CREATE POLICY "extension_update_leads" ON leads
      FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Conversations: la extensión crea y actualiza ──────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='conversations'
    AND policyname='extension_insert_conversations'
  ) THEN
    CREATE POLICY "extension_insert_conversations" ON conversations
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='conversations'
    AND policyname='extension_update_conversations'
  ) THEN
    CREATE POLICY "extension_update_conversations" ON conversations
      FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Messages: la extensión inserta mensajes ───────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='messages'
    AND policyname='extension_insert_messages'
  ) THEN
    CREATE POLICY "extension_insert_messages" ON messages
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='messages'
    AND policyname='extension_update_messages'
  ) THEN
    CREATE POLICY "extension_update_messages" ON messages
      FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Activity log: la extensión inserta eventos ────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='activity_log'
    AND policyname='extension_insert_activity'
  ) THEN
    CREATE POLICY "extension_insert_activity" ON activity_log
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ── Engine queue: la extensión lee y actualiza tasks ─────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='engine_queue'
    AND policyname='extension_all_engine_queue'
  ) THEN
    CREATE POLICY "extension_all_engine_queue" ON engine_queue
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
