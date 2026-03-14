-- ============================================================================
-- 006_calendar_rls.sql
--
-- RLS policies para las tablas del calendario.
-- Ejecutar en la instancia AUTH (uxtzzcjimvapjpkeruwb).
--
-- Verificar estado actual con:
--   SELECT policyname, cmd, qual FROM pg_policies
--   WHERE tablename IN ('calendar_events', 'calendar_categories');
--
-- Si ya hay policies, este script las dropea y recrea.
-- ============================================================================

-- ── calendar_events ──────────────────────────────────────────────────────────

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver todos los eventos (compartidos)
DROP POLICY IF EXISTS "Authenticated users read events" ON public.calendar_events;
CREATE POLICY "Authenticated users read events"
  ON public.calendar_events FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden crear eventos
DROP POLICY IF EXISTS "Authenticated users insert events" ON public.calendar_events;
CREATE POLICY "Authenticated users insert events"
  ON public.calendar_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden editar eventos
DROP POLICY IF EXISTS "Authenticated users update events" ON public.calendar_events;
CREATE POLICY "Authenticated users update events"
  ON public.calendar_events FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden eliminar eventos
DROP POLICY IF EXISTS "Authenticated users delete events" ON public.calendar_events;
CREATE POLICY "Authenticated users delete events"
  ON public.calendar_events FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ── calendar_categories ──────────────────────────────────────────────────────

ALTER TABLE public.calendar_categories ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver todas las categorías (compartidas)
DROP POLICY IF EXISTS "Authenticated users read categories" ON public.calendar_categories;
CREATE POLICY "Authenticated users read categories"
  ON public.calendar_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden crear categorías
DROP POLICY IF EXISTS "Authenticated users insert categories" ON public.calendar_categories;
CREATE POLICY "Authenticated users insert categories"
  ON public.calendar_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden editar categorías
DROP POLICY IF EXISTS "Authenticated users update categories" ON public.calendar_categories;
CREATE POLICY "Authenticated users update categories"
  ON public.calendar_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden eliminar categorías
DROP POLICY IF EXISTS "Authenticated users delete categories" ON public.calendar_categories;
CREATE POLICY "Authenticated users delete categories"
  ON public.calendar_categories FOR DELETE
  USING (auth.uid() IS NOT NULL);
