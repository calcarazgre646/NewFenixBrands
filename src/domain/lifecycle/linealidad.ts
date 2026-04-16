/**
 * domain/lifecycle/linealidad.ts
 *
 * Motor de reglas de linealidad: Edad × STH × TipoProducto → Acción + Responsable.
 *
 * La tabla de linealidad define el STH mínimo esperado para cada tipo de producto
 * en cada tramo de edad. Si el STH real está por debajo, se dispara una acción
 * con responsables asignados.
 *
 * Fuente: Rodrigo Aguayo, email 09/04/2026.
 * No React, no side effects — pure function.
 */
import type {
  ProductType,
  AgeBracket,
  LifecycleAction,
  ResponsibleRole,
  LinealidadResult,
  LinealidadThresholds,
} from "./types";

// Re-export for convenience
export { AGE_BRACKETS } from "./types";

// ─── Action by bracket ──────────────────────────────────────────────────────

const ACTION_BY_BRACKET: Record<AgeBracket, LifecycleAction> = {
  15: "revisar_exhibicion",
  30: "revisar_asignacion",
  45: "accion_comercial",
  60: "markdown_selectivo",
  75: "transferencia_out",
  90: "markdown_liquidacion",
};

// ─── Roles by bracket × product type ────────────────────────────────────────

const ROLES_BY_BRACKET: Record<AgeBracket, Record<ProductType, ResponsibleRole[]>> = {
  15: {
    carry_over: ["marketing_b2c"],
    basicos:    ["marketing_b2c"],
    temporada:  ["marketing_b2c", "brand_manager"],
  },
  30: {
    carry_over: ["brand_manager"],
    basicos:    ["brand_manager"],
    temporada:  ["brand_manager"],
  },
  45: {
    carry_over: ["brand_manager"],
    basicos:    ["brand_manager"],
    temporada:  ["marketing_b2c", "brand_manager"],
  },
  60: {
    carry_over: ["brand_manager", "gerencia_retail"],
    basicos:    ["brand_manager", "gerencia_retail"],
    temporada:  ["brand_manager", "gerencia_retail"],
  },
  75: {
    carry_over: ["brand_manager", "gerencia_retail", "operaciones_retail", "logistica"],
    basicos:    ["brand_manager", "gerencia_retail", "operaciones_retail", "logistica"],
    temporada:  ["brand_manager", "gerencia_retail", "operaciones_retail", "logistica"],
  },
  90: {
    carry_over: ["gerencia_retail"],
    basicos:    ["gerencia_retail"],
    temporada:  ["gerencia_retail"],
  },
};

// ─── Default thresholds (Rodrigo's matrix, 09/04/2026) ─────────────────────

export const DEFAULT_LINEALIDAD_THRESHOLDS: LinealidadThresholds = {
  carry_over: { 15: 20, 30: 40, 45: 50, 60: 65, 75: 80, 90: 95 },
  basicos:    { 15: 15, 30: 30, 45: 40, 60: 55, 75: 70, 90: 85 },
  temporada:  { 15: 10, 30: 20, 45: 30, 60: 45, 75: 60, 90: 75 },
};

// ─── Core evaluation ────────────────────────────────────────────────────────

/**
 * Determines which age bracket an SKU falls into.
 * Returns the highest bracket the age meets or exceeds.
 * E.g., age=47 → bracket 45, age=90 → bracket 90, age=10 → bracket 15 (if any threshold met).
 */
export function findBracket(ageDays: number): AgeBracket | null {
  // Walk backwards: 90 → 75 → 60 → 45 → 30 → 15
  const brackets: AgeBracket[] = [90, 75, 60, 45, 30, 15];
  for (const b of brackets) {
    if (ageDays >= b) return b;
  }
  return null; // age < 15 → no bracket applies yet
}

/**
 * Evaluates the linealidad rule for a single SKU at a given age and STH.
 *
 * @param productType - Carry Over / Básicos / Temporada
 * @param ageDays - Age in days (from DOI or cohort)
 * @param sth - Sell-Through Rate in 0-100 scale
 * @param thresholds - Configurable threshold matrix (defaults to Rodrigo's matrix)
 * @returns LinealidadResult with action and roles if below threshold, null action if above
 */
export function evaluateLinealidad(
  productType: ProductType,
  ageDays: number,
  sth: number,
  thresholds: LinealidadThresholds = DEFAULT_LINEALIDAD_THRESHOLDS,
): LinealidadResult {
  const bracket = findBracket(ageDays);

  // SKU too young for any bracket — no evaluation needed
  if (bracket === null) {
    return {
      bracket: 15,
      requiredSth: thresholds[productType][15],
      actualSth: sth,
      isBelowThreshold: false,
      action: null,
      responsibleRoles: [],
    };
  }

  const requiredSth = thresholds[productType][bracket];
  const isBelowThreshold = sth < requiredSth;
  // Rodrigo's rule: at 90d+, ALL SKUs must have a defined action — mandatory exit
  const forcedAt90 = bracket === 90;
  const triggersAction = isBelowThreshold || forcedAt90;

  return {
    bracket,
    requiredSth,
    actualSth: sth,
    isBelowThreshold: triggersAction,
    action: triggersAction ? ACTION_BY_BRACKET[bracket] : null,
    responsibleRoles: triggersAction ? ROLES_BY_BRACKET[bracket][productType] : [],
  };
}
