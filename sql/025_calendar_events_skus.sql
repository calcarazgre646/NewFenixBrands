-- ============================================================================
-- 025_calendar_events_skus.sql
--
-- Vincula SKUs (style-color) y tiendas a eventos del calendario.
-- Habilita generación de allocation proposals versionadas para Fase A del
-- "Event Operational App" (Palantir-style: ontology + actions + audit).
--
-- Modelo:
--   calendar_events (existe)
--     ├── calendar_event_skus       — SKUs (style-color) vinculados al evento
--     ├── calendar_event_stores     — tiendas donde aplica el evento
--     └── allocation_proposals      — propuestas de reposición/carga (versionadas)
--                                     vinculadas al evento, con payload JSONB
--   decision_actions (existe)
--     ├── + calendar_event_id        — FK opcional para trazar acciones a evento
--     └── + allocation_proposal_id   — FK opcional para trazar acciones a propuesta
--
-- Ejecutar en la instancia AUTH (uxtzzcjimvapjpkeruwb).
-- ============================================================================

-- ─── 1. calendar_event_skus ─────────────────────────────────────────────────
-- Style-color (sku_comercial), no per-talle. La curva se deriva en runtime.
-- M:N permitido (un SKU puede estar en varios eventos).
CREATE TABLE IF NOT EXISTS public.calendar_event_skus (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      TEXT NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  sku_comercial TEXT NOT NULL,
  brand         TEXT NOT NULL,
  intent        TEXT NOT NULL DEFAULT 'sale'
                  CHECK (intent IN ('sale', 'display', 'launch')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id),
  UNIQUE (event_id, sku_comercial)
);

CREATE INDEX IF NOT EXISTS idx_event_skus_event
  ON public.calendar_event_skus (event_id);

CREATE INDEX IF NOT EXISTS idx_event_skus_sku
  ON public.calendar_event_skus (sku_comercial);

COMMENT ON TABLE  public.calendar_event_skus IS 'SKUs (style-color) vinculados a un evento del calendario. La curva de tallas se deriva en runtime desde mv_stock_tienda.';
COMMENT ON COLUMN public.calendar_event_skus.sku_comercial IS 'Identificador style-color (no incluye talle). Une con mv_stock_tienda.sku_comercial.';
COMMENT ON COLUMN public.calendar_event_skus.intent IS 'Propósito del SKU en el evento: sale (venta), display (escaparate), launch (lanzamiento).';

-- ─── 2. calendar_event_stores ───────────────────────────────────────────────
-- Declaración explícita de qué tiendas participan del evento (no derivado).
CREATE TABLE IF NOT EXISTS public.calendar_event_stores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    TEXT NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  store_code  TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'activation'
                CHECK (role IN ('activation', 'warehouse', 'support')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES auth.users(id),
  UNIQUE (event_id, store_code)
);

CREATE INDEX IF NOT EXISTS idx_event_stores_event
  ON public.calendar_event_stores (event_id);

COMMENT ON TABLE  public.calendar_event_stores IS 'Tiendas donde se ejecuta el evento. FK lógica a config_store.store_code (cross-feature, no FK física).';
COMMENT ON COLUMN public.calendar_event_stores.role IS 'Rol de la tienda en el evento: activation (donde se activa), warehouse (depósito de respaldo), support (apoyo).';

-- ─── 3. allocation_proposals ────────────────────────────────────────────────
-- Propuestas reificadas (no recálculo efímero). Versionables, comparables, aprobables.
-- payload contiene las líneas de allocation por (sku, talle, fromStore?, toStore).
CREATE TABLE IF NOT EXISTS public.allocation_proposals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           TEXT NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  version            INT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'approved', 'superseded', 'rejected')),
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by       UUID REFERENCES auth.users(id),
  config_version_id  UUID REFERENCES public.config_versions(id),
  payload            JSONB NOT NULL,
  total_lines        INT NOT NULL DEFAULT 0,
  total_units        INT NOT NULL DEFAULT 0,
  readiness_pct      NUMERIC(5, 2),
  notes              TEXT,
  approved_at        TIMESTAMPTZ,
  approved_by        UUID REFERENCES auth.users(id),
  UNIQUE (event_id, version)
);

CREATE INDEX IF NOT EXISTS idx_alloc_event_version
  ON public.allocation_proposals (event_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_alloc_status
  ON public.allocation_proposals (status);

COMMENT ON TABLE  public.allocation_proposals IS 'Propuestas de allocation (reposición/carga) generadas para un evento. Versionadas para comparar y aprobar.';
COMMENT ON COLUMN public.allocation_proposals.payload IS 'JSONB array: [{ sku, talle, fromStore?, toStore, units, reason }]. Estructura definida en domain/events/allocation.ts.';
COMMENT ON COLUMN public.allocation_proposals.readiness_pct IS 'Snapshot del % de readiness al momento de generación (0-100). Permite ver cómo evolucionó la salud del evento.';

-- ─── 4. Trazabilidad: link decision_actions ↔ event/proposal ───────────────
ALTER TABLE public.decision_actions
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT
    REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS allocation_proposal_id UUID
    REFERENCES public.allocation_proposals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_decision_actions_event
  ON public.decision_actions (calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_decision_actions_proposal
  ON public.decision_actions (allocation_proposal_id)
  WHERE allocation_proposal_id IS NOT NULL;

COMMENT ON COLUMN public.decision_actions.calendar_event_id IS 'Evento del calendario que originó/contextualizó la acción. NULL si la acción no proviene de un evento.';
COMMENT ON COLUMN public.decision_actions.allocation_proposal_id IS 'Propuesta de allocation aprobada que generó esta acción. NULL si fue ad-hoc.';

-- ─── 5. RLS — calendar_event_skus ──────────────────────────────────────────
ALTER TABLE public.calendar_event_skus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read event_skus"   ON public.calendar_event_skus;
CREATE POLICY "Authenticated users read event_skus"
  ON public.calendar_event_skus FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users insert event_skus" ON public.calendar_event_skus;
CREATE POLICY "Authenticated users insert event_skus"
  ON public.calendar_event_skus FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users update event_skus" ON public.calendar_event_skus;
CREATE POLICY "Authenticated users update event_skus"
  ON public.calendar_event_skus FOR UPDATE
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users delete event_skus" ON public.calendar_event_skus;
CREATE POLICY "Authenticated users delete event_skus"
  ON public.calendar_event_skus FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ─── 6. RLS — calendar_event_stores ────────────────────────────────────────
ALTER TABLE public.calendar_event_stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read event_stores"   ON public.calendar_event_stores;
CREATE POLICY "Authenticated users read event_stores"
  ON public.calendar_event_stores FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users insert event_stores" ON public.calendar_event_stores;
CREATE POLICY "Authenticated users insert event_stores"
  ON public.calendar_event_stores FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users update event_stores" ON public.calendar_event_stores;
CREATE POLICY "Authenticated users update event_stores"
  ON public.calendar_event_stores FOR UPDATE
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users delete event_stores" ON public.calendar_event_stores;
CREATE POLICY "Authenticated users delete event_stores"
  ON public.calendar_event_stores FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ─── 7. RLS — allocation_proposals ─────────────────────────────────────────
ALTER TABLE public.allocation_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read allocation_proposals"   ON public.allocation_proposals;
CREATE POLICY "Authenticated users read allocation_proposals"
  ON public.allocation_proposals FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users insert allocation_proposals" ON public.allocation_proposals;
CREATE POLICY "Authenticated users insert allocation_proposals"
  ON public.allocation_proposals FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users update allocation_proposals" ON public.allocation_proposals;
CREATE POLICY "Authenticated users update allocation_proposals"
  ON public.allocation_proposals FOR UPDATE
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users delete allocation_proposals" ON public.allocation_proposals;
CREATE POLICY "Authenticated users delete allocation_proposals"
  ON public.allocation_proposals FOR DELETE
  USING (auth.uid() IS NOT NULL);
