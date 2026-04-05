-- ============================================================================
-- 012_config_tables.sql
--
-- Tablas de configuración de negocio editable.
-- Las tablas se crean VACÍAS. El seed se aplica después de verificar
-- que la app funciona con fallbacks hardcoded.
--
-- Tablas:
--   app_params             — parámetros simples (thresholds, ratios, etc.)
--   config_store           — config por tienda (cluster, capacidad, horarios)
--   config_commission_scale — escalas de comisión (8 roles × tiers)
--
-- RLS:
--   Lectura: todos los autenticados
--   Escritura: solo super_user (via profiles.role)
-- ============================================================================

-- ─── app_params ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_params (
  key          TEXT PRIMARY KEY,
  value        JSONB NOT NULL,
  domain       TEXT NOT NULL,
  description  TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.app_params IS 'Parámetros de negocio editables (thresholds, ratios, factores)';
COMMENT ON COLUMN public.app_params.key IS 'Clave única: dominio.nombre (ej: waterfall.min_impact_gs)';
COMMENT ON COLUMN public.app_params.value IS 'Valor en JSONB (número, string, objeto, array)';
COMMENT ON COLUMN public.app_params.domain IS 'Dominio de negocio (waterfall, depots, freshness, executive, kpis, clusters)';

ALTER TABLE public.app_params ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_params_select" ON public.app_params
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "app_params_insert" ON public.app_params
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

CREATE POLICY "app_params_update" ON public.app_params
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

CREATE POLICY "app_params_delete" ON public.app_params
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

-- ─── config_store ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.config_store (
  store_code       TEXT PRIMARY KEY,
  cluster          TEXT NOT NULL CHECK (cluster IN ('A', 'B', 'OUT')),
  assortment       INTEGER CHECK (assortment IS NULL OR assortment > 0),
  time_restriction TEXT,
  is_excluded      BOOLEAN NOT NULL DEFAULT false,
  is_b2b           BOOLEAN NOT NULL DEFAULT false,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.config_store IS 'Configuración por tienda: cluster, capacidad, horarios, exclusiones';
COMMENT ON COLUMN public.config_store.cluster IS 'Cluster de tienda: A (premium), B (standard), OUT (outlet)';
COMMENT ON COLUMN public.config_store.assortment IS 'Capacidad máxima de unidades (null = sin dato)';
COMMENT ON COLUMN public.config_store.time_restriction IS 'Restricción horaria para recibir transferencias';
COMMENT ON COLUMN public.config_store.is_excluded IS 'Excluida de análisis de red retail (depósitos, fábricas, etc.)';
COMMENT ON COLUMN public.config_store.is_b2b IS 'Tienda de canal B2B (MAYORISTA, UTP, UNIFORMES)';

ALTER TABLE public.config_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_store_select" ON public.config_store
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "config_store_insert" ON public.config_store
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

CREATE POLICY "config_store_update" ON public.config_store
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

CREATE POLICY "config_store_delete" ON public.config_store
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

-- ─── config_commission_scale ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.config_commission_scale (
  role         TEXT PRIMARY KEY,
  channel      TEXT NOT NULL CHECK (channel IN ('mayorista', 'utp', 'retail')),
  type         TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  label        TEXT NOT NULL,
  tiers        JSONB NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.config_commission_scale IS 'Escalas de comisión por rol (8 roles × tiers escalonados)';
COMMENT ON COLUMN public.config_commission_scale.tiers IS 'Array de {minPct, maxPct, value}. maxPct=null para último tramo (Infinity)';

ALTER TABLE public.config_commission_scale ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_commission_select" ON public.config_commission_scale
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "config_commission_insert" ON public.config_commission_scale
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

CREATE POLICY "config_commission_update" ON public.config_commission_scale
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

CREATE POLICY "config_commission_delete" ON public.config_commission_scale
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );
