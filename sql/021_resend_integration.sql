-- ============================================================================
-- 021_resend_integration.sql — Integración Resend para envío de emails SAM
--
-- Ejecutar en AUTH DB (uxtzzcjimvapjpkeruwb) via Supabase Dashboard.
-- Extiende sam_executions con tracking de Resend + agrega tablas
-- sam_email_events y sam_email_config.
-- ============================================================================

-- ─── 1. Extender sam_executions ──────────────────────────────────────────────

-- Permitir emails de prueba: trigger_id y customer_id nullable cuando is_test=true
ALTER TABLE sam_executions ALTER COLUMN trigger_id  DROP NOT NULL;
ALTER TABLE sam_executions ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE sam_executions
  ADD COLUMN IF NOT EXISTS resend_email_id  TEXT,
  ADD COLUMN IF NOT EXISTS to_email         TEXT,
  ADD COLUMN IF NOT EXISTS from_email       TEXT,
  ADD COLUMN IF NOT EXISTS subject_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS html_snapshot    TEXT,
  ADD COLUMN IF NOT EXISTS variables_used   JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bounce_reason    TEXT,
  ADD COLUMN IF NOT EXISTS is_test          BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sam_executions_resend_id ON sam_executions (resend_email_id);
CREATE INDEX IF NOT EXISTS idx_sam_executions_is_test   ON sam_executions (is_test);

-- ─── 2. sam_email_events — Timeline de eventos del webhook ───────────────────

CREATE TABLE IF NOT EXISTS sam_email_events (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES sam_executions(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sam_email_events_exec
  ON sam_email_events (execution_id, created_at);

ALTER TABLE sam_email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY sam_email_events_select
  ON sam_email_events FOR SELECT TO authenticated
  USING (get_my_role() IN ('super_user', 'gerencia'));

-- Insert/update/delete: service role only (el webhook de Resend lo hace via EF)
-- No necesita policies para authenticated.

-- ─── 3. sam_email_config — Config del remitente y destinatarios de prueba ────

CREATE TABLE IF NOT EXISTS sam_email_config (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_email       TEXT NOT NULL,
  from_name        TEXT NOT NULL DEFAULT '',
  reply_to         TEXT,
  test_recipients  TEXT[] NOT NULL DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  updated_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solo una row activa a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_sam_email_config_active_single
  ON sam_email_config (is_active) WHERE is_active = true;

ALTER TABLE sam_email_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY sam_email_config_select
  ON sam_email_config FOR SELECT TO authenticated
  USING (get_my_role() IN ('super_user', 'gerencia'));

CREATE POLICY sam_email_config_insert
  ON sam_email_config FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'super_user');

CREATE POLICY sam_email_config_update
  ON sam_email_config FOR UPDATE TO authenticated
  USING (get_my_role() = 'super_user')
  WITH CHECK (get_my_role() = 'super_user');

CREATE POLICY sam_email_config_delete
  ON sam_email_config FOR DELETE TO authenticated
  USING (get_my_role() = 'super_user');

-- ─── 4. Seed inicial ─────────────────────────────────────────────────────────

INSERT INTO sam_email_config (from_email, from_name, reply_to, test_recipients, is_active)
SELECT 'marketing@fenixbrands.com.py',
       'FenixBrands Marketing',
       'no-reply@fenixbrands.com.py',
       ARRAY[]::TEXT[],
       true
WHERE NOT EXISTS (SELECT 1 FROM sam_email_config WHERE is_active = true);
