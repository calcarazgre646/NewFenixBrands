-- 009_add_b2b_channel_scope.sql
-- Agrega "b2b" como valor válido de channel_scope en profiles.
-- Permite asignar "todo B2B" (Mayoristas + UTP) a un usuario.
-- Rodrigo: "para algunos usuarios necesito seleccionar B2B UTP y B2B Mayoristas"

-- 1. Drop the existing CHECK constraint
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_channel_scope_check;

-- 2. Re-create with the new "b2b" value included
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_channel_scope_check
  CHECK (channel_scope IN ('b2c', 'b2b', 'b2b_mayoristas', 'b2b_utp', 'total'));
