-- ============================================================================
-- 028_sku_markdowns.sql
--
-- Markdown manual por SKU comercial.
-- Ejecutar en la instancia AUTH (uxtzzcjimvapjpkeruwb).
--
-- Modelo append-only para audit:
--   - Cada edit inserta una fila nueva.
--   - La anterior queda con `superseded_at = now()` y `is_active = false`.
--   - Una sola fila `is_active = true` por (sku_comercial) — enforced por índice
--     parcial UNIQUE.
--
-- Fase 1 (este PR): carga manual.
-- Fase 2 (futuro):  workflow de aprobación → status='pending_approval' antes
--                   de is_active=true. Por eso la columna `status` ya existe.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sku_markdowns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_comercial   TEXT NOT NULL,
  brand           TEXT NOT NULL,
  markdown_pct    NUMERIC(5,2) NOT NULL
                    CHECK (markdown_pct > 0 AND markdown_pct <= 90),
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'pending_approval', 'rejected', 'expired', 'superseded')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id),
  superseded_at   TIMESTAMPTZ,
  superseded_by   UUID REFERENCES auth.users(id),
  CHECK (
    (is_active = true  AND superseded_at IS NULL)
 OR (is_active = false AND (superseded_at IS NOT NULL OR status IN ('rejected','expired')))
  ),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

-- Solo una fila activa por SKU.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sku_markdowns_active
  ON public.sku_markdowns (sku_comercial)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sku_markdowns_brand
  ON public.sku_markdowns (brand)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sku_markdowns_history
  ON public.sku_markdowns (sku_comercial, created_at DESC);

COMMENT ON TABLE  public.sku_markdowns IS 'Markdown manual por SKU comercial. Append-only — una sola fila is_active=true por SKU. Cruce con mv_stock_tienda en frontend (BD distinta).';
COMMENT ON COLUMN public.sku_markdowns.markdown_pct IS 'Porcentaje de descuento sobre PVP (0-90). Ej: 25 = 25%. PVP_efectivo = PVP × (1 − pct/100).';
COMMENT ON COLUMN public.sku_markdowns.status IS 'Fase 1 sólo usa active/superseded/expired. pending_approval/rejected reservados para Fase 2 (workflow de aprobación al Gte Comercial).';

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.sku_markdowns ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado.
CREATE POLICY "Authenticated read markdowns"
  ON public.sku_markdowns FOR SELECT
  TO authenticated
  USING (true);

-- Escritura: super_user + gerencia.
CREATE POLICY "Privileged insert markdowns"
  ON public.sku_markdowns FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_user', 'gerencia')
        AND p.is_active = true
    )
  );

CREATE POLICY "Privileged update markdowns"
  ON public.sku_markdowns FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_user', 'gerencia')
        AND p.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_user', 'gerencia')
        AND p.is_active = true
    )
  );

-- DELETE intencionalmente NO permitido — append-only para audit.
