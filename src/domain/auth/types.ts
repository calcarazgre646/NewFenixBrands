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
export type Role = "super_user" | "gerencia" | "negocio" | "vendedor";

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
  /** Código de vendedor en la BD operacional (fjdhstvta1.v_vended). null = no es vendedor. */
  vendedorCodigo:     number | null;
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
  canViewPricing:   boolean;
  /** Editar markdown manual sobre la lista de precios (Promoción por SKU). */
  canEditPricing:   boolean;
  canViewCalendar:  boolean;
  canViewCommissions: boolean;
  canViewSellerProjections: boolean;
  /** Vista personal del vendedor (sólo si está mapeado a un vendedor_codigo) */
  canViewMyProjection: boolean;
  canViewMarketing: boolean;
  /** Editar config del remitente de email marketing (from alias, destinatarios de prueba) */
  canConfigureEmailSender: boolean;
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

  const isSeller = profile.vendedorCodigo != null;

  if (role === "super_user" || role === "gerencia") {
    return {
      canViewExecutive: true,
      canViewKpis:      true,
      canViewSales:     true,
      canViewActions:   true,
      canViewLogistics: true,
      canViewDepots:    true,
      canViewPricing:   true,
      canEditPricing:   true,
      canViewCalendar:  true,
      canViewCommissions: true,
      canViewSellerProjections: true,
      // Gerencia/super_user mapeados a un vendedor también pueden ver su vista personal
      canViewMyProjection: isSeller,
      canViewMarketing: true,
      canConfigureEmailSender: role === "super_user",
      canManageUsers:   role === "super_user",
      isChannelLocked:  false,
      lockedChannel:    null,
    };
  }

  if (role === "vendedor") {
    // Vendedor: vista mínima — solo /comisiones (rol-aware: la página filtra
    // por profile.vendedorCodigo). canViewCommissions=true incluso sin código
    // asignado: la página muestra el cartel "vincular código" (mejor UX que
    // mandarlo a /signin).
    return {
      canViewExecutive: false,
      canViewKpis:      false,
      canViewSales:     false,
      canViewActions:   false,
      canViewLogistics: false,
      canViewDepots:    false,
      canViewPricing:   false,
      canEditPricing:   false,
      canViewCalendar:  false,
      canViewCommissions: true,
      // Aliases legacy para deep links / código antiguo. Mantienen el mismo
      // valor que canViewCommissions porque /proyeccion-vendedor y
      // /mi-proyeccion redirigen a /comisiones.
      canViewSellerProjections: true,
      canViewMyProjection: true,
      canViewMarketing: false,
      canConfigureEmailSender: false,
      canManageUsers:   false,
      isChannelLocked:  true,
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
    canViewPricing:   false,
    canEditPricing:   false,
    canViewCalendar:  true,
    canViewCommissions: false,
    canViewSellerProjections: false,
    canViewMyProjection: isSeller,
    canViewMarketing: false,
    canConfigureEmailSender: false,
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
  canViewPricing:   false,
  canEditPricing:   false,
  canViewCalendar:  false,
  canViewCommissions: false,
  canViewSellerProjections: false,
  canViewMyProjection: false,
  canViewMarketing: false,
  canConfigureEmailSender: false,
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
  if (permissions.canViewCommissions) return "/comisiones";
  return "/signin";
}

// ─── View profile (Rule 10: brackets por perfil) ────────────────────────────

export type ViewProfile = "detail" | "executive";

/**
 * Maps app role + cargo to a view profile that determines DOI bracket granularity.
 * - detail (15d): Brand Managers, Gerencia de Producto, Operaciones, Marketing
 * - executive (45d): Gerencia Comercial Retail
 */
export function getUserViewProfile(role: Role, cargo?: string | null): ViewProfile {
  if (role === "gerencia") return "executive";
  if (role === "super_user") return "detail";
  const c = (cargo ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (c.includes("gerencia") || c.includes("gerente")) return "executive";
  return "detail";
}

// ─── Lifecycle role mapping ────────────────────────────────────────────────────

import type { ResponsibleRole } from "@/domain/lifecycle/types";
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";

const ALL_LIFECYCLE_ROLES: ResponsibleRole[] = [
  "marketing_b2c", "brand_manager", "gerencia_retail", "operaciones_retail", "logistica",
];

/**
 * Maps an app role + cargo to lifecycle ResponsibleRoles.
 * super_user and gerencia see everything.
 * negocio maps by cargo field (from profiles table).
 */
export function mapToLifecycleRoles(role: Role, cargo?: string | null): ResponsibleRole[] {
  if (role === "super_user" || role === "gerencia") return ALL_LIFECYCLE_ROLES;

  // Strip accents for matching (e.g. "Logística" → "logistica")
  const c = (cargo ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (c.includes("brand") || c.includes("marca")) return ["brand_manager"];
  if (c.includes("marketing")) return ["marketing_b2c"];
  if (c.includes("operacion")) return ["operaciones_retail", "logistica"];
  if (c.includes("logist")) return ["operaciones_retail", "logistica"];
  if (c.includes("gerencia") || c.includes("gerente")) return ["gerencia_retail"];
  // Default for negocio without specific cargo
  return ["marketing_b2c", "brand_manager"];
}

/**
 * Filters actions by the logged-in user's lifecycle roles.
 * Movement actions without lifecycle roles are always visible (backward compat).
 * Lifecycle actions are only visible if the user has at least one matching role.
 */
export function filterActionsByRole(
  actions: ActionItemFull[],
  role: Role,
  cargo?: string | null,
): ActionItemFull[] {
  if (role === "super_user" || role === "gerencia") return actions;

  const myRoles = new Set(mapToLifecycleRoles(role, cargo));
  return actions.filter(a => {
    // Movement actions without lifecycle roles: always visible
    if (a.category === "movement" && a.responsibleRoles.length === 0) return true;
    // Actions with roles: only if user has at least one matching role
    return a.responsibleRoles.some(r => myRoles.has(r));
  });
}

/** Label legible para el rol */
export function getRoleLabel(role: Role): string {
  switch (role) {
    case "super_user": return "Super User";
    case "gerencia":   return "Gerencia";
    case "negocio":    return "Negocio";
    case "vendedor":   return "Vendedor";
  }
}
