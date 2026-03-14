-- ============================================================================
-- 005_must_change_password.sql
--
-- Agrega columna must_change_password a profiles.
-- Cuando es true, el usuario es redirigido a cambiar su contraseña
-- al iniciar sesión (flujo de primer login con contraseña temporal).
--
-- Ejecutar en la instancia AUTH (uxtzzcjimvapjpkeruwb).
-- ============================================================================

-- 1. Nueva columna
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Los usuarios existentes ya tienen contraseñas propias → false.
-- Los nuevos usuarios creados via Edge Function tendrán must_change_password = true.

-- 2. RPC functions (SECURITY DEFINER — bypassan RLS para que el propio
--    usuario pueda limpiar/setear su flag sin policy de UPDATE)

CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET must_change_password = false
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.set_must_change_password()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET must_change_password = true
  WHERE id = auth.uid();
$$;

-- 3. RLS policy fix: usar get_my_role() en vez de subquery recursivo
--    (ver feedback_supabase_rls.md — la policy original causaba error 500)
--    NOTA: Estas policies ya fueron aplicadas manualmente. Este archivo
--    documenta el estado final correcto.
