-- ============================================================================
-- 008_sam_tables.sql — Motor de Marketing (SAM)
--
-- Ejecutar en AUTH DB (uxtzzcjimvapjpkeruwb) via Supabase Dashboard.
-- Toda la persistencia SAM vive aquí. La CLIENT DB solo se consume read-only.
-- ============================================================================

-- ─── 1. sam_customers — CRM unificado ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sam_customers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  erp_code      TEXT NOT NULL UNIQUE,
  ruc           TEXT,
  razon_social  TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  tipo_cliente  TEXT,
  tier          TEXT NOT NULL DEFAULT 'inactive'
    CHECK (tier IN ('vip', 'frequent', 'occasional', 'at_risk', 'inactive')),
  total_spent      NUMERIC NOT NULL DEFAULT 0,
  purchase_count   INTEGER NOT NULL DEFAULT 0,
  avg_ticket       NUMERIC NOT NULL DEFAULT 0,
  last_purchase    TIMESTAMPTZ,
  has_pending_debt BOOLEAN NOT NULL DEFAULT false,
  pending_amount   NUMERIC NOT NULL DEFAULT 0,
  fecha_ingreso    DATE,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sam_customers_erp_code ON sam_customers (erp_code);
CREATE INDEX IF NOT EXISTS idx_sam_customers_tier ON sam_customers (tier);
CREATE INDEX IF NOT EXISTS idx_sam_customers_last_purchase ON sam_customers (last_purchase);

-- ─── 2. sam_templates — Templates de mensaje ─────────────────────────────────

CREATE TABLE IF NOT EXISTS sam_templates (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  channel    TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  subject    TEXT,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. sam_segments — Segmentos de audiencia ────────────────────────────────

CREATE TABLE IF NOT EXISTS sam_segments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  filters     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 4. sam_campaigns — Campañas agrupador ───────────────────────────────────

CREATE TABLE IF NOT EXISTS sam_campaigns (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  segment_id  UUID REFERENCES sam_segments(id),
  start_date  TIMESTAMPTZ,
  end_date    TIMESTAMPTZ,
  budget      NUMERIC,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 5. sam_triggers — Definiciones de triggers ──────────────────────────────

CREATE TABLE IF NOT EXISTS sam_triggers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL
    CHECK (category IN ('inactivity', 'overdue', 'return', 'post_purchase',
                         'first_purchase', 'second_purchase', 'high_ticket',
                         'low_ticket', 'low_stock')),
  description   TEXT,
  channel       TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  template_id   UUID REFERENCES sam_templates(id),
  campaign_id   UUID REFERENCES sam_campaigns(id),
  conditions    JSONB NOT NULL DEFAULT '{}',
  frequency_cap INTEGER NOT NULL DEFAULT 1,
  priority      INTEGER NOT NULL DEFAULT 5,
  is_active     BOOLEAN NOT NULL DEFAULT false,
  fire_count    INTEGER NOT NULL DEFAULT 0,
  last_fired_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 6. sam_executions — Log de ejecuciones ──────────────────────────────────

CREATE TABLE IF NOT EXISTS sam_executions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_id  UUID NOT NULL REFERENCES sam_triggers(id),
  customer_id UUID NOT NULL REFERENCES sam_customers(id),
  campaign_id UUID REFERENCES sam_campaigns(id),
  channel     TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'failed')),
  sent_at      TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at    TIMESTAMPTZ,
  clicked_at   TIMESTAMPTZ,
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sam_executions_trigger ON sam_executions (trigger_id);
CREATE INDEX IF NOT EXISTS idx_sam_executions_customer ON sam_executions (customer_id);
CREATE INDEX IF NOT EXISTS idx_sam_executions_status ON sam_executions (status);
CREATE INDEX IF NOT EXISTS idx_sam_executions_created ON sam_executions (created_at);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE sam_customers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_segments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_triggers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_executions ENABLE ROW LEVEL SECURITY;

-- SELECT/INSERT/UPDATE: super_user + gerencia
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sam_customers','sam_templates','sam_segments','sam_campaigns','sam_triggers','sam_executions']
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (get_my_role() IN (''super_user'',''gerencia''))',
      t || '_select', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (get_my_role() IN (''super_user'',''gerencia''))',
      t || '_insert', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (get_my_role() IN (''super_user'',''gerencia''))',
      t || '_update', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (get_my_role() = ''super_user'')',
      t || '_delete', t
    );
  END LOOP;
END $$;
