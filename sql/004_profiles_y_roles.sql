-- ============================================================================
-- 004_profiles_y_roles.sql
--
-- Sistema de perfiles y roles para NewFenixBrands Dashboard.
-- Ejecutar en la instancia AUTH (uxtzzcjimvapjpkeruwb).
--
-- Roles:
--   super_user  → acceso total + gestión de usuarios
--   gerencia    → acceso total a vistas (sin gestión)
--   negocio     → acceso restringido por canal
--
-- channel_scope (solo aplica a rol 'negocio'):
--   null        → N/A (super_user / gerencia)
--   'total'     → ve todo (pero solo páginas permitidas por rol)
--   'b2c'       → solo datos B2C
--   'b2b_mayoristas'   → solo datos B2B Mayoristas
--   'b2b_utp'          → solo datos B2B UTP/Uniformes
-- ============================================================================

-- 1. Tabla de perfiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role           TEXT NOT NULL DEFAULT 'negocio'
                   CHECK (role IN ('super_user', 'gerencia', 'negocio')),
  channel_scope  TEXT DEFAULT NULL
                   CHECK (channel_scope IN ('b2c', 'b2b_mayoristas', 'b2b_utp', 'total', NULL)),
  full_name      TEXT NOT NULL DEFAULT '',
  cargo          TEXT DEFAULT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuario puede leer su propio perfil
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Super users pueden leer todos los perfiles (para futuro SettingsPage)
CREATE POLICY "Super users read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_user'
    )
  );

-- Super users pueden actualizar cualquier perfil
CREATE POLICY "Super users update profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_user'
    )
  );

-- Super users pueden insertar perfiles (onboarding de nuevos usuarios)
CREATE POLICY "Super users insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_user'
    )
  );

-- 3. Trigger: auto-crear perfil cuando se registra un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'negocio'  -- default seguro: mínimo privilegio
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger si ya existe (idempotente)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Trigger: auto-actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active) WHERE is_active = true;

-- ============================================================================
-- SEED: Insertar perfiles para los 3 usuarios existentes.
-- NOTA: Reemplazar los UUIDs con los IDs reales de auth.users.
-- Ejecutar después de verificar los UUIDs con:
--   SELECT id, email FROM auth.users;
-- ============================================================================

-- Los perfiles se insertan con un script separado (seed_profiles.sql)
-- después de confirmar los UUIDs de cada usuario en auth.users.
-- Ver instrucciones en el README del directorio sql/.
