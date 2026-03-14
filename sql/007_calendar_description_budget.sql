-- ============================================================================
-- 007_calendar_description_budget.sql
--
-- Agrega description y budget a calendar_events.
-- budget es NUMERIC para precisión monetaria (trazable y medible).
-- currency default 'PYG' para futuro soporte multi-moneda.
--
-- Ejecutar en la instancia AUTH (uxtzzcjimvapjpkeruwb).
-- ============================================================================

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS budget NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'PYG'
    CHECK (currency IN ('PYG', 'USD'));

-- Índice para queries de análisis de presupuesto por período
CREATE INDEX IF NOT EXISTS idx_calendar_events_budget
  ON public.calendar_events(start_date)
  WHERE budget IS NOT NULL;

COMMENT ON COLUMN public.calendar_events.budget IS 'Presupuesto asignado al evento. NULL = sin presupuesto. NUMERIC para precisión monetaria.';
COMMENT ON COLUMN public.calendar_events.currency IS 'Moneda del presupuesto. PYG (Guaraníes) o USD (Dólares).';
COMMENT ON COLUMN public.calendar_events.description IS 'Descripción libre del evento. Contexto, objetivos, notas.';
