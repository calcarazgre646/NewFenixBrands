-- ════════════════════════════════════════════════════════════════════════════
-- 023 — Mapeo user → vendedor para "Mi Proyección"
-- ════════════════════════════════════════════════════════════════════════════
--
-- Objetivo: permitir que un usuario del sistema (auth.users / public.profiles)
-- vea SU propia proyección de ventas y comisiones del mes en la página
-- /mi-proyeccion.
--
-- Decisión de modelo: columna `vendedor_codigo` en `profiles` (mapeo 1:1).
-- Si en el futuro un usuario representa a varios vendedores, se promueve a
-- tabla aparte sin cambios en el contrato de la app (basta con poblar la
-- columna con el "principal" y consultar la tabla nueva).
--
-- vendedor_codigo se corresponde con `fjdhstvta1.v_vended` (INTEGER) en la BD
-- operacional. NO hay FK porque las dos BD están en proyectos Supabase
-- distintos (auth vs operacional/dataClient).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vendedor_codigo INTEGER;

COMMENT ON COLUMN public.profiles.vendedor_codigo IS
  'Código del vendedor (fjdhstvta1.v_vended). NULL = el usuario no es un vendedor (super_user, gerencia o staff sin venta).';

-- Índice para búsquedas inversas (raras, pero baratas)
CREATE INDEX IF NOT EXISTS profiles_vendedor_codigo_idx
  ON public.profiles (vendedor_codigo)
  WHERE vendedor_codigo IS NOT NULL;
