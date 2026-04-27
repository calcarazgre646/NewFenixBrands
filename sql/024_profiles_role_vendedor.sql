-- ════════════════════════════════════════════════════════════════════════════
-- 024 — Agregar 'vendedor' al CHECK constraint de profiles.role
-- BD: app/auth (uxtzzcjimvapjpkeruwb) — NO la operacional del ERP
-- ════════════════════════════════════════════════════════════════════════════
--
-- Contexto: la migration 004 creó `profiles.role` con un CHECK que solo
-- aceptaba ('super_user', 'gerencia', 'negocio'). Al introducir el rol
-- 'vendedor' (vista mínima: solo /mi-proyeccion), cualquier UPDATE/INSERT
-- con role='vendedor' fallaba con:
--   new row for relation "profiles" violates check constraint "profiles_role_check"
--
-- Esta migration dropea el constraint viejo y crea uno nuevo con los 4 roles.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_user', 'gerencia', 'negocio', 'vendedor'));
