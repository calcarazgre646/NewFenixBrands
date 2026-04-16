-- ============================================================================
-- 015_decision_traceability.sql
--
-- Nuevas tablas para trazabilidad de decisiones y historial de configuraciones.
-- Incluye: config_versions, decision_runs, decision_actions, config_audit_log,
-- índices asociados, políticas RLS y triggers de auditoría de configuración.
-- ============================================================================

-- ─── config_versions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.config_versions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             UUID NOT NULL REFERENCES auth.users(id),
  app_params_snapshot    JSONB NOT NULL,
  store_config_snapshot  JSONB NOT NULL,
  commission_snapshot    JSONB NOT NULL,
  changes_diff           JSONB,
  reason                 TEXT,
  is_active              BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_config_versions_active_created_at
  ON public.config_versions (is_active, created_at DESC);

ALTER TABLE public.config_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read config_versions" ON public.config_versions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert config_versions" ON public.config_versions
  FOR INSERT TO authenticated WITH CHECK (true);

-- ─── decision_runs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.decision_runs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type                 TEXT NOT NULL
                             CHECK (run_type IN ('waterfall', 'purchase_planning', 'commissions')),
  triggered_by             UUID NOT NULL REFERENCES auth.users(id),
  triggered_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  filters_snapshot         JSONB NOT NULL,
  config_version_id        UUID REFERENCES public.config_versions(id),
  total_actions            INT NOT NULL DEFAULT 0,
  total_gap_units          INT NOT NULL DEFAULT 0,
  total_impact_gs          NUMERIC NOT NULL DEFAULT 0,
  pareto_count             INT NOT NULL DEFAULT 0,
  critical_count           INT NOT NULL DEFAULT 0,
  computation_ms           INT,
  inventory_row_count      INT,
  sales_history_row_count  INT,
  doi_age_row_count        INT,
  metadata                 JSONB
);

CREATE INDEX IF NOT EXISTS idx_decision_runs_triggered_at
  ON public.decision_runs (triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_decision_runs_triggered_by
  ON public.decision_runs (triggered_by);

CREATE INDEX IF NOT EXISTS idx_decision_runs_run_type
  ON public.decision_runs (run_type);

ALTER TABLE public.decision_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read decision_runs" ON public.decision_runs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert decision_runs" ON public.decision_runs
  FOR INSERT TO authenticated WITH CHECK (true);

-- ─── decision_actions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.decision_actions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id             UUID NOT NULL REFERENCES public.decision_runs(id) ON DELETE CASCADE,
  rank               INT NOT NULL,
  sku                TEXT NOT NULL,
  sku_comercial      TEXT,
  talle              TEXT NOT NULL,
  brand              TEXT NOT NULL,
  description        TEXT,
  linea              TEXT,
  categoria          TEXT,
  store              TEXT NOT NULL,
  target_store       TEXT,
  store_cluster      TEXT,
  current_stock      INT NOT NULL,
  suggested_units    INT NOT NULL,
  ideal_units        INT NOT NULL,
  gap_units          INT NOT NULL,
  days_of_inventory  INT NOT NULL DEFAULT 0,
  historical_avg     NUMERIC NOT NULL DEFAULT 0,
  cover_weeks        INT NOT NULL,
  current_mos        NUMERIC NOT NULL DEFAULT 0,
  risk               TEXT NOT NULL
                       CHECK (risk IN ('critical', 'low', 'balanced', 'overstock')),
  waterfall_level    TEXT NOT NULL
                       CHECK (waterfall_level IN ('store_to_store', 'depot_to_store', 'central_to_depot', 'central_to_b2b')),
  action_type        TEXT NOT NULL,
  impact_score       NUMERIC NOT NULL DEFAULT 0,
  pareto_flag        BOOLEAN NOT NULL DEFAULT false,
  recommended_action TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'expired')),
  reviewed_by        UUID REFERENCES auth.users(id),
  reviewed_at        TIMESTAMPTZ,
  review_notes       TEXT,
  executed_at        TIMESTAMPTZ,
  executed_by        UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_actions_run_id
  ON public.decision_actions (run_id);

CREATE INDEX IF NOT EXISTS idx_decision_actions_status
  ON public.decision_actions (status);

CREATE INDEX IF NOT EXISTS idx_decision_actions_sku_talle
  ON public.decision_actions (sku, talle);

CREATE INDEX IF NOT EXISTS idx_decision_actions_store
  ON public.decision_actions (store);

ALTER TABLE public.decision_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read decision_actions" ON public.decision_actions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert decision_actions" ON public.decision_actions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Super user update decision_actions" ON public.decision_actions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_user'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_user'
    )
  );

-- ─── config_audit_log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.config_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT NOT NULL,
  record_key  TEXT NOT NULL,
  field_name  TEXT NOT NULL,
  old_value   JSONB,
  new_value   JSONB,
  changed_by  UUID REFERENCES auth.users(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_config_audit_table_changed_at
  ON public.config_audit_log (table_name, changed_at DESC);

ALTER TABLE public.config_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read config_audit_log" ON public.config_audit_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert config_audit_log" ON public.config_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- ─── Trigger function: Config audit ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_config_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  record_key  TEXT;
  column_name TEXT;
  old_record  JSONB;
  new_record  JSONB;
  actor_id    UUID;
BEGIN
  IF TG_TABLE_NAME = 'app_params' THEN
    record_key := NEW.key::TEXT;
  ELSIF TG_TABLE_NAME = 'config_store' THEN
    record_key := NEW.store_code::TEXT;
  ELSIF TG_TABLE_NAME = 'config_commission_scale' THEN
    record_key := NEW.role::TEXT;
  ELSE
    RAISE EXCEPTION 'fn_config_audit_trigger no configurado para la tabla %', TG_TABLE_NAME;
  END IF;

  old_record := to_jsonb(OLD);
  new_record := to_jsonb(NEW);
  actor_id := COALESCE(NEW.updated_by, OLD.updated_by, auth.uid());

  FOR column_name IN SELECT jsonb_object_keys(new_record)
  LOOP
    IF column_name IN ('updated_at', 'updated_by') THEN
      CONTINUE;
    END IF;

    IF old_record -> column_name IS DISTINCT FROM new_record -> column_name THEN
      INSERT INTO public.config_audit_log (table_name, record_key, field_name, old_value, new_value, changed_by)
      VALUES (TG_TABLE_NAME, record_key, column_name, old_record -> column_name, new_record -> column_name, actor_id);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Triggers por tabla ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_app_params_audit ON public.app_params;
CREATE TRIGGER trg_app_params_audit
  AFTER UPDATE ON public.app_params
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_config_audit_trigger();

DROP TRIGGER IF EXISTS trg_config_store_audit ON public.config_store;
CREATE TRIGGER trg_config_store_audit
  AFTER UPDATE ON public.config_store
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_config_audit_trigger();

DROP TRIGGER IF EXISTS trg_config_commission_audit ON public.config_commission_scale;
CREATE TRIGGER trg_config_commission_audit
  AFTER UPDATE ON public.config_commission_scale
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_config_audit_trigger();
