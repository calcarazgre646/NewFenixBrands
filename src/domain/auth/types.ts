/**
 * domain/auth/types.ts
 *
 * Tipos canónicos para el sistema de roles y permisos.
 *
 * REGLA: Todo lo relacionado a roles, permisos y scoping de canal
 * se define aquí. No hay strings mágicos "super_user"/"gerencia"/"negocio"
 * dispersos en el código.
 */

// ─── Roles ──────────────────────────────────────────────────────────────────────

/** Roles del sistema. Ordenados de mayor a menor privilegio. */
export type Role = "super_user" | "gerencia" | "negocio";

/**
 * Scope de canal para usuarios con rol 'negocio'.
 * - null    → no aplica (super_user / gerencia)
 * - 'total' → ve todos los canales (pero solo páginas permitidas)
 * - 'b2c'   → solo datos de canal B2C
 * - 'b2b'   → todo B2B (Mayoristas + UTP)
 * - 'b2b_mayoristas' → solo datos B2B Mayoristas
 * - 'b2b_utp'        → solo datos B2B UTP/Uniformes
 */
export type ChannelScope = "b2c" | "b2b" | "b2b_mayoristas" | "b2b_utp" | "total" | null;

// ─── Profile ────────────────────────────────────────────────────────────────────

/** Perfil del usuario autenticado (tabla public.profiles) */
export interface UserProfile {
  id:                 string;
  role:               Role;
  channelScope:       ChannelScope;
  fullName:           string;
  cargo:              string | null;
  isActive:           boolean;
  mustChangePassword: boolean;
}

// ─── Permissions ────────────────────────────────────────────────────────────────

/** Permisos derivados del perfil. Computados una vez, consumidos por toda la app. */
export interface Permissions {
  /** Páginas visibles */
  canViewExecutive: boolean;
  canViewKpis:      boolean;
  canViewSales:     boolean;
  canViewActions:   boolean;
  canViewLogistics: boolean;
  canViewDepots:    boolean;
  canViewCalendar:  boolean;
  /** Gestión (futuro SettingsPage) */
  canManageUsers:   boolean;
  /** Filtro de canal bloqueado (usuario no puede cambiarlo) */
  isChannelLocked:  boolean;
  /** Canal forzado para el usuario. null = libre */
  lockedChannel:    ChannelScope;
}

// ─── Derivación de permisos ─────────────────────────────────────────────────────

/**
 * Deriva permisos a partir del perfil.
 * Esta es la ÚNICA fuente de verdad para "quién puede qué".
 */
export function derivePermissions(profile: UserProfile | null): Permissions {
  if (!profile || !profile.isActive) {
    return EMPTY_PERMISSIONS;
  }

  const { role, channelScope } = profile;

  if (role === "super_user" || role === "gerencia") {
    return {
      canViewExecutive: true,
      canViewKpis:      true,
      canViewSales:     true,
      canViewActions:   true,
      canViewLogistics: true,
      canViewDepots:    true,
      canViewCalendar:  true,
      canManageUsers:   role === "super_user",
      isChannelLocked:  false,
      lockedChannel:    null,
    };
  }

  // rol === 'negocio'
  return {
    canViewExecutive: false,
    canViewKpis:      false,
    canViewSales:     true,
    canViewActions:   true,
    canViewLogistics: true,
    canViewDepots:    false,
    canViewCalendar:  true,
    canManageUsers:   false,
    isChannelLocked:  channelScope !== "total" && channelScope !== null,
    lockedChannel:    channelScope,
  };
}

/** Permisos vacíos para usuarios no autenticados o inactivos */
const EMPTY_PERMISSIONS: Permissions = {
  canViewExecutive: false,
  canViewKpis:      false,
  canViewSales:     false,
  canViewActions:   false,
  canViewLogistics: false,
  canViewDepots:    false,
  canViewCalendar:  false,
  canManageUsers:   false,
  isChannelLocked:  true,
  lockedChannel:    null,
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Ruta por defecto según rol */
export function getDefaultRoute(permissions: Permissions): string {
  if (permissions.canViewExecutive) return "/";
  if (permissions.canViewSales) return "/ventas";
  if (permissions.canViewCalendar) return "/calendario";
  return "/signin";
}

/** Label legible para el rol */
export function getRoleLabel(role: Role): string {
  switch (role) {
    case "super_user": return "Super User";
    case "gerencia":   return "Gerencia";
    case "negocio":    return "Negocio";
  }
}
