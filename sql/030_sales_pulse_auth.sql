-- =============================================================================
-- 030_sales_pulse_auth.sql
--
-- Sales Pulse Semanal — proyecto AUTH (uxtzzcjimvapjpkeruwb).
--
-- Crea las tablas de subscribers + audit log de envíos, RLS, y el cron job
-- pg_cron que dispara la Edge Function send-sales-pulse cada lunes a las
-- 11:30 UTC (= lunes 8:30 AM PYT, post-refresh de :15 de las MVs).
--
-- La pieza correlativa en el proyecto DATA (RPC compute_sales_pulse) está en
-- sql/029_sales_pulse.sql.
--
-- Pre-requisitos:
--   1. Función helper get_my_role() ya existe (de sql/004_profiles_y_roles.sql).
--   2. Extensiones pg_cron y pg_net habilitadas.
--   3. Edge Function send-sales-pulse deployada y CRON_SECRET configurado
--      (ver docs/SALES_PULSE_DEPLOY.md).
--
-- Fecha: 2026-05-04
-- =============================================================================


-- ─── 0. Extensiones requeridas ──────────────────────────────────────────────
-- pg_cron + pg_net en el proyecto AUTH. Ojo: el proyecto data ya tiene pg_cron
-- (de sql/011_data_freshness.sql) pero el proyecto AUTH puede no tenerla.
-- Si CREATE EXTENSION pg_cron tira "permission denied", activarla desde el
-- Dashboard → Database → Extensions → pg_cron → toggle ON, y volver a correr.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ─── 1. Tabla sales_pulse_subscribers ───────────────────────────────────────
-- Lista de destinatarios del Sales Pulse semanal. Gestionable desde la UI.

CREATE TABLE IF NOT EXISTS sales_pulse_subscribers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT NOT NULL,
  name          TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_pulse_subscribers_email_unique
  ON sales_pulse_subscribers (lower(email));

CREATE INDEX IF NOT EXISTS idx_sales_pulse_subscribers_active
  ON sales_pulse_subscribers (active) WHERE active = true;

ALTER TABLE sales_pulse_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_pulse_subscribers_select
  ON sales_pulse_subscribers FOR SELECT TO authenticated
  USING (get_my_role() IN ('super_user', 'gerencia'));

CREATE POLICY sales_pulse_subscribers_insert
  ON sales_pulse_subscribers FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'super_user');

CREATE POLICY sales_pulse_subscribers_update
  ON sales_pulse_subscribers FOR UPDATE TO authenticated
  USING (get_my_role() = 'super_user')
  WITH CHECK (get_my_role() = 'super_user');

CREATE POLICY sales_pulse_subscribers_delete
  ON sales_pulse_subscribers FOR DELETE TO authenticated
  USING (get_my_role() = 'super_user');


-- ─── 2. Tabla sales_pulse_runs ──────────────────────────────────────────────
-- Audit log: cada vez que dispara (cron o manual) deja una fila.

CREATE TABLE IF NOT EXISTS sales_pulse_runs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by  TEXT NOT NULL,                -- 'cron' | 'manual'
  triggered_by_user UUID REFERENCES auth.users(id), -- null cuando triggered_by='cron'
  scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at       TIMESTAMPTZ,
  week_start    DATE NOT NULL,
  week_end      DATE NOT NULL,
  recipients    TEXT[] NOT NULL DEFAULT '{}',
  resend_ids    TEXT[] NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'failed' | 'partial'
  error_msg     TEXT,
  payload       JSONB NOT NULL DEFAULT '{}',  -- snapshot del jsonb del RPC
  is_test       BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_sales_pulse_runs_scheduled
  ON sales_pulse_runs (scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_pulse_runs_week
  ON sales_pulse_runs (week_start DESC);

ALTER TABLE sales_pulse_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_pulse_runs_select
  ON sales_pulse_runs FOR SELECT TO authenticated
  USING (get_my_role() IN ('super_user', 'gerencia'));

CREATE POLICY sales_pulse_runs_delete
  ON sales_pulse_runs FOR DELETE TO authenticated
  USING (get_my_role() = 'super_user');

-- Insert/update lo hace solo la EF con service_role (no policies para authenticated).


-- ─── 3. Trigger updated_at ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sales_pulse_subscribers_touch_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_pulse_subscribers_updated ON sales_pulse_subscribers;
CREATE TRIGGER trg_sales_pulse_subscribers_updated
  BEFORE UPDATE ON sales_pulse_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION sales_pulse_subscribers_touch_updated();


-- ─── 4. Vault: secret CRON_SECRET ───────────────────────────────────────────
-- El cron lo lee del vault al disparar el invoke. El operador debe haberlo
-- guardado antes de aplicar esta migration. Ver docs/SALES_PULSE_DEPLOY.md.
--
-- Usar el SQL Editor con:
--   SELECT vault.create_secret('<random-string>', 'sales_pulse_cron_secret');
--
-- y configurar el mismo valor como secret de la EF:
--   supabase secrets set CRON_SECRET=<random-string> --project-ref uxtzzcjimvapjpkeruwb


-- ─── 5. Cron job lunes 17:00 UTC = lunes 14:00 PYT ──────────────────────────
-- El RPC pide semana cerrada (lunes anterior → domingo anterior), así que no
-- depende del refresh del lunes. El refresh corre :15 cada hora; al 17:00 UTC
-- ya hay varias pasadas garantizadas.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sales-pulse-monday') THEN
    PERFORM cron.unschedule('sales-pulse-monday');
  END IF;
END $$;

SELECT cron.schedule(
  'sales-pulse-monday',
  '0 17 * * 1',
  $$
  SELECT net.http_post(
    url     := 'https://uxtzzcjimvapjpkeruwb.supabase.co/functions/v1/send-sales-pulse',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sales_pulse_cron_secret')
    ),
    body    := jsonb_build_object('source', 'cron')
  );
  $$
);


-- ─── 6. Seed inicial de subscribers ─────────────────────────────────────────
-- Carlos (super_user) y Rod (cliente) — solo arranque. La UI permite añadir/
-- desactivar más sin tocar SQL.

INSERT INTO sales_pulse_subscribers (email, name, active)
VALUES
  ('rodrigo@fenixbrands.com.py', 'Rodrigo (Fenix)', true),
  ('carlos@subestatica.com',     'Carlos (Subestática)', true)
ON CONFLICT (lower(email)) DO NOTHING;


-- ─── 7. Verificación post-apply (correr a mano) ─────────────────────────────
-- SELECT jobid, jobname, schedule, active FROM cron.job;
--   → debe mostrar 'sales-pulse-monday' además de 'refresh-all-and-log'.
-- SELECT * FROM sales_pulse_subscribers;
--   → debe mostrar los 2 seeds.
