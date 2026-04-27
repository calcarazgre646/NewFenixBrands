/**
 * domain/users/validation.ts
 *
 * Lógica pura para la gestión de usuarios.
 * Sin dependencias de React ni side effects.
 */
import type { ChannelScope, Role, UserProfile } from "@/domain/auth/types";

// ─── Validation types ───────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  role: Role;
  channelScope: ChannelScope;
  cargo: string | null;
}

// ─── Edit permissions ────────────────────────────────────────────────────────

interface EditPermissions {
  canChangeRole: boolean;
  canToggleActive: boolean;
}

/**
 * Determina qué puede editar el super_user sobre un perfil target.
 * Self-edit: ambos false (prevenir lockout accidental).
 */
export function canEditProfile(
  currentUserId: string,
  targetProfile: UserProfile,
): EditPermissions {
  if (currentUserId === targetProfile.id) {
    return { canChangeRole: false, canToggleActive: false };
  }
  return { canChangeRole: true, canToggleActive: true };
}

/**
 * Determina si el super_user puede eliminar a un usuario.
 * Self-delete: false (prevenir lockout).
 */
export function canDeleteUser(
  currentUserId: string,
  targetUserId: string,
): boolean {
  return currentUserId !== targetUserId;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/** Validación básica de email */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Validación de contraseña (mínimo 6 caracteres) */
export function validatePassword(password: string): ValidationResult {
  if (!password || !password.trim()) {
    return { valid: false, error: "La contraseña es requerida" };
  }
  if (password.trim().length < 6) {
    return { valid: false, error: "La contraseña debe tener al menos 6 caracteres" };
  }
  return { valid: true };
}

/** Validación de datos para crear un usuario */
export function validateCreateUser(input: CreateUserInput): ValidationResult {
  if (!input.email?.trim()) {
    return { valid: false, error: "El email es requerido" };
  }
  if (!validateEmail(input.email)) {
    return { valid: false, error: "El email no es válido" };
  }
  if (!input.fullName?.trim()) {
    return { valid: false, error: "El nombre es requerido" };
  }
  return { valid: true };
}

// ─── Labels ──────────────────────────────────────────────────────────────────

/** Label legible para channel_scope */
export function getChannelScopeLabel(scope: ChannelScope): string {
  switch (scope) {
    case "b2c":            return "B2C";
    case "b2b":            return "B2B (Mayoristas + UTP)";
    case "b2b_mayoristas": return "B2B Mayoristas";
    case "b2b_utp":        return "B2B UTP";
    case "total":          return "Total";
    case null:             return "—";
  }
}

// ─── Badge styles ────────────────────────────────────────────────────────────

/** Clases CSS para el badge de rol */
export function getRoleBadgeStyle(role: Role): string {
  switch (role) {
    case "super_user":
      return "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400";
    case "gerencia":
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400";
    case "negocio":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400";
    case "vendedor":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400";
  }
}

/** Badge de estado activo/inactivo */
export function getStatusBadgeStyle(isActive: boolean): {
  text: string;
  className: string;
} {
  if (isActive) {
    return {
      text: "Activo",
      className:
        "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400",
    };
  }
  return {
    text: "Inactivo",
    className:
      "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  };
}
