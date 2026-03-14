/**
 * queries/profile.queries.ts
 *
 * Fetch del perfil del usuario autenticado desde public.profiles.
 *
 * Estrategia simple:
 *   - Un solo fetch directo (sin retry manual, TanStack Query maneja retries)
 *   - PGRST116 (no rows) → fallback gerencia (usuario legacy sin migración)
 *   - Otros errores → throw → TanStack Query reintenta automáticamente
 */
import { authClient } from "@/api/client";
import type { UserProfile } from "@/domain/auth/types";

/**
 * Fallback para usuarios legacy sin fila en `profiles`.
 * isActive: false → derivePermissions() retorna EMPTY_PERMISSIONS
 * → el usuario ve la app en loading y no puede acceder a nada.
 *
 * Esto es intencional: un auth user sin perfil no debería tener
 * acceso automático a gerencia. El admin debe crear su perfil primero.
 */
const FALLBACK_PROFILE: Omit<UserProfile, "id"> = {
  role: "negocio",
  channelScope: null,
  fullName: "",
  cargo: null,
  isActive: false,
  mustChangePassword: false,
};

/**
 * Trae el perfil del usuario autenticado.
 * RLS garantiza que solo puede leer su propio perfil.
 *
 * Si el perfil no existe (PGRST116 — usuario legacy sin migration), retorna fallback.
 * Otros errores se propagan para que TanStack Query los reintente.
 */
export async function fetchProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await authClient
    .from("profiles")
    .select("id, role, channel_scope, full_name, cargo, is_active, must_change_password")
    .eq("id", userId)
    .single();

  if (error) {
    // PGRST116 = no rows returned → usuario sin perfil en tabla
    if (error.code === "PGRST116") {
      return { id: userId, ...FALLBACK_PROFILE };
    }
    // Otros errores → throw para que TanStack Query reintente
    throw new Error(`[fetchProfile] ${error.message} (code: ${error.code})`);
  }

  if (!data) {
    return { id: userId, ...FALLBACK_PROFILE };
  }

  return {
    id:                 data.id,
    role:               data.role,
    channelScope:       data.channel_scope,
    fullName:           data.full_name,
    cargo:              data.cargo,
    isActive:           data.is_active,
    mustChangePassword: data.must_change_password ?? false,
  };
}
